from fastapi import APIRouter

from app.api.v1 import auth, categories, dashboard, reconciliation, reports, settings, transactions, voice

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
api_router.include_router(settings.router)
api_router.include_router(voice.router)
api_router.include_router(reconciliation.router)
