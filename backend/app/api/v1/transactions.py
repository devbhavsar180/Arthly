import calendar
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionOut,
    TransactionUpdate,
)
from app.services.analytics import serialize_transaction
from app.services.notification_service import check_unusual_spending, evaluate_budgets_for_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("", response_model=TransactionListResponse)
def list_transactions(
    search: str | None = Query(default=None, max_length=120),
    transaction_type: Literal["INCOME", "EXPENSE"] | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    sort_by: Literal["date", "amount", "created_at"] = Query(default="date"),
    sort_order: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.user_id == current_user.id)
    )

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        q = q.filter(Transaction.title.ilike(pattern))

    if transaction_type:
        q = q.filter(Transaction.transaction_type == transaction_type)

    if category_id:
        q = q.filter(Transaction.category_id == category_id)

    if payment_mode:
        q = q.filter(Transaction.payment_mode == payment_mode)

    if start_date:
        q = q.filter(Transaction.transaction_date >= start_date)
    if end_date:
        q = q.filter(Transaction.transaction_date <= end_date)

    if not start_date and not end_date and month and year:
        last_day = calendar.monthrange(year, month)[1]
        q = q.filter(
            Transaction.transaction_date >= date(year, month, 1),
            Transaction.transaction_date <= date(year, month, last_day),
        )
    elif not start_date and not end_date and year and not month:
        q = q.filter(
            Transaction.transaction_date >= date(year, 1, 1),
            Transaction.transaction_date <= date(year, 12, 31),
        )

    all_matching = q.all()
    total_count = len(all_matching)
    total_income = sum(
        (Decimal(t.amount) for t in all_matching if t.transaction_type == "INCOME"),
        Decimal("0.00"),
    )
    total_expenses = sum(
        (Decimal(t.amount) for t in all_matching if t.transaction_type == "EXPENSE"),
        Decimal("0.00"),
    )

    sort_col = {
        "date": Transaction.transaction_date,
        "amount": Transaction.amount,
        "created_at": Transaction.created_at,
    }[sort_by]
    order_fn = asc if sort_order == "asc" else desc

    offset = (page - 1) * page_size
    items = (
        q.order_by(order_fn(sort_col), desc(Transaction.created_at))
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return TransactionListResponse(
        items=[serialize_transaction(tx) for tx in items],
        total_count=total_count,
        total_income=round(float(total_income), 2),
        total_expenses=round(float(total_expenses), 2),
        net_balance=round(float(total_income - total_expenses), 2),
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = (
        db.query(Category)
        .filter(
            Category.id == payload.category_id,
            Category.user_id == current_user.id,
        )
        .first()
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected category not found.",
        )
    if category.type != payload.transaction_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{category.name}' is a {category.type.lower()} category and cannot be used for {payload.transaction_type.lower()}.",
        )

    tx = Transaction(
        user_id=current_user.id,
        transaction_type=payload.transaction_type,
        title=payload.title,
        amount=payload.amount,
        category_id=category.id,
        payment_mode=payload.payment_mode,
        transaction_date=payload.transaction_date,
        notes=payload.notes,
    )
    db.add(tx)
    db.flush()

    tx = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.id == tx.id)
        .first()
    )
    if tx.transaction_type == "EXPENSE":
        evaluate_budgets_for_user(db, current_user.id, tx.transaction_date.month, tx.transaction_date.year)
        check_unusual_spending(db, tx)
    db.commit()
    return serialize_transaction(tx)


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")
    return serialize_transaction(tx)


@router.put("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")

    target_type = payload.transaction_type or tx.transaction_type
    target_category_id = payload.category_id or tx.category_id

    category = (
        db.query(Category)
        .filter(Category.id == target_category_id, Category.user_id == current_user.id)
        .first()
    )
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected category not found.")
    if category.type != target_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{category.name}' does not match transaction type {target_type}.",
        )

    tx.transaction_type = target_type
    tx.category_id = category.id
    if payload.title is not None:
        tx.title = payload.title
    if payload.amount is not None:
        tx.amount = payload.amount
    if payload.payment_mode is not None:
        tx.payment_mode = payload.payment_mode
    elif target_type == "EXPENSE" and not tx.payment_mode:
        tx.payment_mode = "Other"
    if payload.transaction_date is not None:
        tx.transaction_date = payload.transaction_date
    if payload.notes is not None:
        tx.notes = payload.notes

    db.flush()

    tx = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.id == tx.id)
        .first()
    )
    if tx.transaction_type == "EXPENSE":
        evaluate_budgets_for_user(db, current_user.id, tx.transaction_date.month, tx.transaction_date.year)
    db.commit()
    return serialize_transaction(tx)


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")

    db.delete(tx)
    db.commit()
    return {"message": "Transaction deleted successfully."}
