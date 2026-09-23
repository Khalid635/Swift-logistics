from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

ParcelStatus = Literal["Pending", "Processing", "In Transit", "Delivered"]
UserStatus = Literal["pending", "active", "blocked"]


# ---------- Users ----------

class UserCreate(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str
    status: str
    created_at: Optional[datetime] = None


class UserListItem(UserResponse):
    parcel_count: int = 0


class UserList(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    data: List[UserListItem]


class UserStatusUpdate(BaseModel):
    status: UserStatus


class UserStats(BaseModel):
    total: int
    pending: int
    active: int
    blocked: int


# ---------- Parcels ----------

class ParcelBase(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    sender_name: str = Field(min_length=3, max_length=100)
    receiver_name: str = Field(min_length=3, max_length=100)
    weight: float = Field(ge=0.1, le=100)
    district: str = Field(min_length=1, max_length=60)
    sub_district: str = Field(min_length=1, max_length=60)
    thana: str = Field(min_length=1, max_length=60)

    @field_validator("title", "sender_name", "receiver_name")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field can't be blank")
        return v


class ParcelCreate(ParcelBase):
    status: ParcelStatus = "Pending"


class ParcelUpdate(BaseModel):
    """Every field is optional, so the dashboard can change just the status."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    sender_name: Optional[str] = Field(default=None, min_length=3, max_length=100)
    receiver_name: Optional[str] = Field(default=None, min_length=3, max_length=100)
    weight: Optional[float] = Field(default=None, ge=0.1, le=100)
    district: Optional[str] = Field(default=None, min_length=1, max_length=60)
    sub_district: Optional[str] = Field(default=None, min_length=1, max_length=60)
    thana: Optional[str] = Field(default=None, min_length=1, max_length=60)
    status: Optional[ParcelStatus] = None


class ParcelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tracking_id: str
    title: str
    sender_name: str
    receiver_name: str
    weight: float
    district: str
    sub_district: str
    thana: str
    destination: str
    status: str
    created_by: Optional[int] = None
    created_by_email: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ParcelList(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    data: List[ParcelResponse]


class ParcelStats(BaseModel):
    total: int
    pending: int
    processing: int
    in_transit: int
    delivered: int


class TrackingResponse(BaseModel):
    """What the public tracking page may see: no names, no thana."""

    model_config = ConfigDict(from_attributes=True)

    tracking_id: str
    status: str
    district: str
    sub_district: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
