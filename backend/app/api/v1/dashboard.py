from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.services.analytics import build_dashboard_data

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return build_dashboard_data(
        db=db,
        user_id=current_user.id,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
    )
