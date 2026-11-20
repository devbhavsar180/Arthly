from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    type: Literal["INCOME", "EXPENSE"] | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Category).filter(Category.user_id == current_user.id)
    if type:
        q = q.filter(Category.type == type)
    categories = q.order_by(Category.type.asc(), Category.is_default.desc(), Category.name.asc()).all()

    counts = dict(
        db.query(Transaction.category_id, func.count(Transaction.id))
        .filter(Transaction.user_id == current_user.id)
        .group_by(Transaction.category_id)
        .all()
    )

    result = []
    for cat in categories:
        out = CategoryOut.model_validate(cat)
        out.transaction_count = int(counts.get(cat.id, 0))
        result.append(out)
    return result


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    duplicate = (
        db.query(Category)
        .filter(
            Category.user_id == current_user.id,
            func.lower(Category.name) == payload.name.lower(),
            Category.type == payload.type,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category '{payload.name}' already exists for {payload.type.lower()}.",
        )

    cat = Category(
        user_id=current_user.id,
        name=payload.name,
        type=payload.type,
        color=payload.color,
        icon=payload.icon,
        is_default=False,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryOut.model_validate(cat)


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: str,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    if payload.name and payload.name.lower() != cat.name.lower():
        duplicate = (
            db.query(Category)
            .filter(
                Category.user_id == current_user.id,
                func.lower(Category.name) == payload.name.lower(),
                Category.type == cat.type,
                Category.id != cat.id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category '{payload.name}' already exists.",
            )
        cat.name = payload.name

    if payload.color is not None:
        cat.color = payload.color
    if payload.icon is not None:
        cat.icon = payload.icon

    db.commit()
    db.refresh(cat)

    tx_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.user_id == current_user.id, Transaction.category_id == cat.id)
        .scalar()
        or 0
    )
    out = CategoryOut.model_validate(cat)
    out.transaction_count = int(tx_count)
    return out


@router.delete("/{category_id}")
def delete_category(
    category_id: str,
    reassign_to_other: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    tx_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.user_id == current_user.id, Transaction.category_id == cat.id)
        .scalar()
        or 0
    )

    if tx_count > 0:
        if not reassign_to_other:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category '{cat.name}' is used by {tx_count} transaction(s). Enable reassignment or update those transactions first.",
            )

        fallback_name = "Other" if cat.type == "EXPENSE" else "Other Income"
        fallback = (
            db.query(Category)
            .filter(
                Category.user_id == current_user.id,
                Category.type == cat.type,
                Category.id != cat.id,
                func.lower(Category.name) == fallback_name.lower(),
            )
            .first()
        )
        if not fallback:
            fallback = (
                db.query(Category)
                .filter(
                    Category.user_id == current_user.id,
                    Category.type == cat.type,
                    Category.id != cat.id,
                )
                .first()
            )
        if not fallback:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last remaining category of this type.",
            )

        db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.category_id == cat.id,
        ).update({"category_id": fallback.id})
        db.flush()

    db.delete(cat)
    db.commit()
    return {"message": f"Category '{cat.name}' deleted successfully."}
