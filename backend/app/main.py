import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app import models  # noqa: F401 - register models
from app.services.seed import seed_admin_from_env, seed_system_defaults

# Configure minimal, privacy-safe logging (no financial bodies or credentials logged)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("expense_tracker")

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Ensure tables exist when running in local dev without manual alembic invocation
    if settings.APP_ENV == "development":
        Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_system_defaults(db)
        seed_admin_from_env(db)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
    logger.info("Application started in %s mode.", settings.APP_ENV)
    yield
    logger.info("Application shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    description="Arthly — AI-Powered Personal Finance Tracker REST API (Web, Mobile & Admin)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": settings.APP_NAME}

@app.get("/", tags=["Root"])
def root():
    return {
        "status": "success",
        "message": "Welcome to My Expense Tracker API",
        "service": settings.APP_NAME,
        "docs": "/docs",
        "health": "/health"
    }


app.include_router(api_router, prefix="/api/v1")
