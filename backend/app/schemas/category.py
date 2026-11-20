from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

CategoryType = Literal["INCOME", "EXPENSE"]


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    type: CategoryType
    color: str = Field(default="#2563EB", pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str = Field(default="tag", min_length=1, max_length=40)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Category name cannot be empty")
        return cleaned


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str | None = Field(default=None, min_length=1, max_length=40)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Category name cannot be empty")
        return cleaned


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: CategoryType
    color: str
    icon: str
    is_default: bool
    created_at: datetime
    transaction_count: int = 0
