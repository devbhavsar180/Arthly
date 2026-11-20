from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import Category
from app.models.reconciliation import (
    BankStatement,
    BankStatementTransaction,
    ReconciliationMatch,
    ReconciliationSession,
)
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.reconciliation import (
    AppTransactionBrief,
    BankStatementOut,
    BankStatementTransactionOut,
    MatchActionRequest,
    ReconciliationMatchOut,
    ReconciliationSessionOut,
)
from app.services.reconciliation_service import ReconciliationEngine
from app.services.reports import (
    generate_reconciliation_csv,
    generate_reconciliation_excel,
    generate_reconciliation_pdf,
)
from app.services.statement_parser import BankStatementParser

router = APIRouter(prefix="/reconciliation", tags=["Bank Statement Reconciliation"])


def _format_session_out(session: ReconciliationSession) -> ReconciliationSessionOut:
    matches_out = []
    for m in session.matches:
        b_out = None
        if m.bank_transaction:
            b_out = BankStatementTransactionOut.model_validate(m.bank_transaction)

        a_out = None
        if m.app_transaction:
            a_out = AppTransactionBrief(
                id=m.app_transaction.id,
                transaction_type=m.app_transaction.transaction_type,
                title=m.app_transaction.title,
                amount=m.app_transaction.amount,
                payment_mode=m.app_transaction.payment_mode,
                transaction_date=m.app_transaction.transaction_date,
                notes=m.app_transaction.notes,
                category_name=m.app_transaction.category.name if m.app_transaction.category else "Other",
            )

        matches_out.append(
            ReconciliationMatchOut(
                id=m.id,
                session_id=m.session_id,
                status=m.status,
                match_score=float(m.match_score),
                review_action=m.review_action,
                notes=m.notes,
                bank_transaction=b_out,
                app_transaction=a_out,
            )
        )

    stmt_out = None
    if session.statement:
        stmt_out = BankStatementOut.model_validate(session.statement)

    return ReconciliationSessionOut(
        id=session.id,
        month=session.month,
        year=session.year,
        status=session.status,
        summary_stats=session.summary_stats or {},
        date_tolerance_days=session.date_tolerance_days,
        created_at=session.created_at,
        statement=stmt_out,
        matches=matches_out,
    )


@router.post("/upload", response_model=ReconciliationSessionOut, status_code=status.HTTP_201_CREATED)
async def upload_and_reconcile(
    month: int = Form(..., ge=1, le=12),
    year: int = Form(..., ge=2000, le=2100),
    date_tolerance_days: int = Form(3, ge=0, le=14),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload PDF, CSV, or Excel bank statement and run automated verification."""
    filename = file.filename or "statement"
    ext = filename.split(".")[-1].lower() if "." in filename else "csv"
    if ext not in ["pdf", "csv", "xlsx", "xls", "txt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported format. Please upload a PDF, CSV, or Excel (.xlsx) file.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded statement file is empty.",
        )

    # 1. Parse statement
    try:
        parsed_data = BankStatementParser.parse_file(filename=filename, content=content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to read bank statement file: {str(e)}",
        )

    tx_list = parsed_data.get("transactions", [])
    if not tx_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid transactions could be extracted from this statement. Please check file columns or formatting.",
        )

    total_debits = sum(t["debit_amount"] for t in tx_list)
    total_credits = sum(t["credit_amount"] for t in tx_list)

    # 2. Save BankStatement
    statement = BankStatement(
        user_id=current_user.id,
        filename=filename,
        file_format=ext,
        month=month,
        year=year,
        opening_balance=parsed_data.get("opening_balance"),
        closing_balance=parsed_data.get("closing_balance"),
        total_debits=total_debits,
        total_credits=total_credits,
        total_transactions=len(tx_list),
    )
    db.add(statement)
    db.flush()

    # 3. Save BankStatementTransactions
    for t in tx_list:
        b_tx = BankStatementTransaction(
            statement_id=statement.id,
            user_id=current_user.id,
            transaction_date=t["transaction_date"],
            description=t["description"],
            reference_no=t.get("reference_no"),
            debit_amount=t["debit_amount"],
            credit_amount=t["credit_amount"],
            raw_type=t["raw_type"],
            balance=t.get("balance"),
        )
        db.add(b_tx)

    db.flush()

    # 4. Run automated reconciliation engine
    session = ReconciliationEngine.run_reconciliation(
        db=db,
        user_id=current_user.id,
        statement=statement,
        date_tolerance_days=date_tolerance_days,
    )

    # Reload with full joins
    full_session = (
        db.query(ReconciliationSession)
        .options(
            joinedload(ReconciliationSession.statement),
            joinedload(ReconciliationSession.matches).joinedload(ReconciliationMatch.bank_transaction),
            joinedload(ReconciliationSession.matches)
            .joinedload(ReconciliationMatch.app_transaction)
            .joinedload(Transaction.category),
        )
        .filter(ReconciliationSession.id == session.id)
        .first()
    )

    return _format_session_out(full_session)


@router.get("/sessions", response_model=list[ReconciliationSessionOut])
def list_reconciliation_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve history of reconciliation sessions for user."""
    sessions = (
        db.query(ReconciliationSession)
        .options(
            joinedload(ReconciliationSession.statement),
            joinedload(ReconciliationSession.matches).joinedload(ReconciliationMatch.bank_transaction),
            joinedload(ReconciliationSession.matches)
            .joinedload(ReconciliationMatch.app_transaction)
            .joinedload(Transaction.category),
        )
        .filter(ReconciliationSession.user_id == current_user.id)
        .order_by(ReconciliationSession.created_at.desc())
        .all()
    )
    return [_format_session_out(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=ReconciliationSessionOut)
def get_reconciliation_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single reconciliation session details with all comparison matches."""
    session = (
        db.query(ReconciliationSession)
        .options(
            joinedload(ReconciliationSession.statement),
            joinedload(ReconciliationSession.matches).joinedload(ReconciliationMatch.bank_transaction),
            joinedload(ReconciliationSession.matches)
            .joinedload(ReconciliationMatch.app_transaction)
            .joinedload(Transaction.category),
        )
        .filter(ReconciliationSession.id == session_id, ReconciliationSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reconciliation session not found.")

    return _format_session_out(session)


@router.post("/matches/{match_id}/action", response_model=ReconciliationMatchOut)
def update_match_action(
    match_id: str,
    payload: MatchActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute manual action on a match: Confirm, Reject, Create in App, or Ignore."""
    match = (
        db.query(ReconciliationMatch)
        .options(
            joinedload(ReconciliationMatch.bank_transaction),
            joinedload(ReconciliationMatch.app_transaction).joinedload(Transaction.category),
            joinedload(ReconciliationMatch.session),
        )
        .filter(ReconciliationMatch.id == match_id, ReconciliationMatch.user_id == current_user.id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match record not found.")

    match.review_action = payload.action
    if payload.notes:
        match.notes = payload.notes

    if payload.action in ["CREATED_EXPENSE", "CREATED_INCOME"]:
        b_tx = match.bank_transaction
        if not b_tx:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No bank transaction associated with this match.")

        tx_type = "EXPENSE" if payload.action == "CREATED_EXPENSE" else "INCOME"
        amount = b_tx.debit_amount if tx_type == "EXPENSE" else b_tx.credit_amount

        # Find or use specified category
        cat_id = payload.category_id
        if not cat_id:
            default_cat_name = "Other" if tx_type == "EXPENSE" else "Other Income"
            cat = (
                db.query(Category)
                .filter(Category.user_id == current_user.id, Category.type == tx_type, Category.name == default_cat_name)
                .first()
            )
            if not cat:
                cat = db.query(Category).filter(Category.user_id == current_user.id, Category.type == tx_type).first()
            if not cat:
                cat = Category(
                    user_id=current_user.id,
                    name=default_cat_name,
                    type=tx_type,
                    color="#64748B",
                    icon="tag",
                )
                db.add(cat)
                db.flush()
            cat_id = cat.id

        new_tx = Transaction(
            user_id=current_user.id,
            transaction_type=tx_type,
            title=b_tx.description[:160],
            amount=amount,
            category_id=cat_id,
            payment_mode="Bank Transfer / UPI",
            transaction_date=b_tx.transaction_date,
            notes=f"Created from bank statement reconciliation (Ref: {b_tx.reference_no or 'N/A'})",
        )
        db.add(new_tx)
        db.flush()

        match.app_transaction_id = new_tx.id
        match.status = "MATCHED"
        match.match_score = 100.0

    elif payload.action == "CONFIRMED":
        match.status = "MATCHED"
        match.match_score = 100.0
    elif payload.action == "REJECTED":
        match.status = "MISMATCH"
    elif payload.action == "IGNORED":
        # Keep original status but marked as ignored
        pass

    db.commit()
    db.refresh(match)

    # Re-fetch with joins
    match = (
        db.query(ReconciliationMatch)
        .options(
            joinedload(ReconciliationMatch.bank_transaction),
            joinedload(ReconciliationMatch.app_transaction).joinedload(Transaction.category),
        )
        .filter(ReconciliationMatch.id == match_id)
        .first()
    )

    b_out = BankStatementTransactionOut.model_validate(match.bank_transaction) if match.bank_transaction else None
    a_out = None
    if match.app_transaction:
        a_out = AppTransactionBrief(
            id=match.app_transaction.id,
            transaction_type=match.app_transaction.transaction_type,
            title=match.app_transaction.title,
            amount=match.app_transaction.amount,
            payment_mode=match.app_transaction.payment_mode,
            transaction_date=match.app_transaction.transaction_date,
            notes=match.app_transaction.notes,
            category_name=match.app_transaction.category.name if match.app_transaction.category else "Other",
        )

    return ReconciliationMatchOut(
        id=match.id,
        session_id=match.session_id,
        status=match.status,
        match_score=float(match.match_score),
        review_action=match.review_action,
        notes=match.notes,
        bank_transaction=b_out,
        app_transaction=a_out,
    )


@router.get("/sessions/{session_id}/report/{report_format}")
def download_reconciliation_report(
    session_id: str,
    report_format: Literal["pdf", "excel", "csv"],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download reconciliation report in PDF, Excel (.xlsx), or CSV."""
    session = (
        db.query(ReconciliationSession)
        .options(joinedload(ReconciliationSession.statement))
        .filter(ReconciliationSession.id == session_id, ReconciliationSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reconciliation session not found.")

    if report_format == "pdf":
        raw, filename = generate_reconciliation_pdf(db=db, user=current_user, session=session)
        media_type = "application/pdf"
    elif report_format == "excel":
        raw, filename = generate_reconciliation_excel(db=db, user=current_user, session=session)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        raw, filename = generate_reconciliation_csv(db=db, user=current_user, session=session)
        media_type = "text/csv; charset=utf-8"

    return Response(
        content=raw,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/sessions/{session_id}")
def delete_reconciliation_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Securely delete a reconciliation session and its uploaded statement data."""
    session = (
        db.query(ReconciliationSession)
        .filter(ReconciliationSession.id == session_id, ReconciliationSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    stmt_id = session.statement_id
    # Cascade delete matches and session
    db.query(ReconciliationMatch).filter(ReconciliationMatch.session_id == session.id).delete()
    db.query(ReconciliationSession).filter(ReconciliationSession.id == session.id).delete()
    if stmt_id:
        db.query(BankStatementTransaction).filter(BankStatementTransaction.statement_id == stmt_id).delete()
        db.query(BankStatement).filter(BankStatement.id == stmt_id).delete()

    db.commit()
    return {"message": "Reconciliation session and bank statement records deleted permanently."}
