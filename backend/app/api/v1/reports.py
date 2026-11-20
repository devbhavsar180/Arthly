from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.reports import generate_csv_report, generate_excel_report, generate_pdf_report

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/pdf/expense")
def download_expense_pdf(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_pdf_report(
        db=db,
        user=current_user,
        report_kind="expense",
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/pdf/income")
def download_income_pdf(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_pdf_report(
        db=db,
        user=current_user,
        report_kind="income",
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/pdf/summary")
def download_summary_pdf(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_pdf_report(
        db=db,
        user=current_user,
        report_kind="summary",
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/excel")
def download_excel_report(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_excel_report(
        db=db,
        user=current_user,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/csv")
def download_csv_report(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_csv_report(
        db=db,
        user=current_user,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
