from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    budgets,
    categories,
    dashboard,
    notifications,
    reconciliation,
    reports,
    savings,
    screenshots,
    settings,
    transactions,
    voice,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(dashboard.router)
api_router.include_router(savings.router)
api_router.include_router(budgets.router)
api_router.include_router(notifications.router)
api_router.include_router(screenshots.router)
api_router.include_router(reports.router)
api_router.include_router(settings.router)
api_router.include_router(voice.router)
api_router.include_router(reconciliation.router)
api_router.include_router(admin.router)
