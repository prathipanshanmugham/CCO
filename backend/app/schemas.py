from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class StaffVerifyInput(BaseModel):
    email: EmailStr
    password: str
    otp: str = Field(min_length=6, max_length=6)


class DesignInput(BaseModel):
    jewellery_type: str
    prompt: str = Field(min_length=12, max_length=1200)
    model: Literal["gpt-image-1", "gemini-nano-banana"]
    specs: dict[str, Any] = {}
    references: list[str] = []


class QuoteInput(BaseModel):
    design_id: str
    budget: str | None = None
    delivery_city: str | None = None
    note: str | None = None


class StatusUpdateInput(BaseModel):
    production_status: str
    internal_note: str | None = None


class DesignGuidanceInput(BaseModel):
    session_id: str = Field(min_length=8, max_length=120)
    jewellery_type: str = Field(min_length=2, max_length=60)
    description: str = Field(min_length=12, max_length=1600)
    specifications: dict[str, Any] = {}