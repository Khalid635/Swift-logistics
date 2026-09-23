import os
import uuid
from math import ceil
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
import schemas
from auth import (
    create_access_token,
    get_current_active_user,
    get_password_hash,
    verify_password,
)
from database import engine, get_db

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

models.Base.metadata.create_all(bind=engine)

VALID_STATUSES = ("Pending", "Processing", "In Transit", "Delivered")

# A normal user can edit or delete their own parcel only while it is still in
# one of these statuses. The admin can always edit and delete anything.
USER_CAN_MODIFY_STATUSES = ("Pending",)

# Columns the dashboard is allowed to sort by
SORTABLE_COLUMNS = {
    "created_at": models.Parcel.created_at,
    "tracking_id": models.Parcel.tracking_id,
    "title": models.Parcel.title,
    "receiver_name": models.Parcel.receiver_name,
    "district": models.Parcel.district,
    "status": models.Parcel.status,
    "weight": models.Parcel.weight,
}


def seed_admin() -> None:
    """Make sure the one and only admin account exists and matches the
    ADMIN_EMAIL / ADMIN_PASSWORD settings.

    Locally the defaults below are used. On the live server, set the
    ADMIN_EMAIL and ADMIN_PASSWORD environment variables to real values.
    Because this runs on every start, changing ADMIN_PASSWORD and restarting
    the server changes the admin's password.
    """
    email = os.getenv("ADMIN_EMAIL", "admin@swiftlogistics.com").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "admin1234")

    with Session(engine) as db:
        admin = db.query(models.User).filter(models.User.role == "admin").first()

        if admin is None:
            db.add(
                models.User(
                    email=email,
                    hashed_password=get_password_hash(password),
                    role="admin",
                    status="active",
                )
            )
        else:
            taken = (
                db.query(models.User.id)
                .filter(models.User.email == email, models.User.id != admin.id)
                .first()
            )
            if not taken:
                admin.email = email
            admin.hashed_password = get_password_hash(password)
            admin.status = "active"

        db.commit()


seed_admin()

app = FastAPI(title="SwiftLogistics API", version="3.0.0")

# Only the React dev server may call this API from a browser.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Access control helpers
# ---------------------------------------------------------------------------

def ensure_account_allowed(user: models.User) -> None:
    """Pending and blocked accounts can't use the system."""
    if user.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is waiting for admin approval",
        )
    if user.status == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been blocked by the admin",
        )


def get_approved_user(
    current_user: models.User = Depends(get_current_active_user),
) -> models.User:
    """Checked on every request, so blocking a user takes effect immediately
    even if that user still holds a valid token."""
    ensure_account_allowed(current_user)
    return current_user


def require_admin(
    current_user: models.User = Depends(get_approved_user),
) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return current_user


def generate_tracking_id(db: Session) -> str:
    for _ in range(10):
        tracking_id = f"TRK-{uuid.uuid4().hex[:6].upper()}"
        taken = (
            db.query(models.Parcel.id)
            .filter(models.Parcel.tracking_id == tracking_id)
            .first()
        )
        if not taken:
            return tracking_id
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a tracking ID. Please try again.",
    )


def scope_parcels(query, user: models.User):
    """The admin sees every parcel; a normal user sees only their own."""
    if user.role == "admin":
        return query
    return query.filter(models.Parcel.created_by == user.id)


def get_parcel_or_404(db: Session, parcel_id: int, user: models.User) -> models.Parcel:
    query = db.query(models.Parcel).filter(models.Parcel.id == parcel_id)
    parcel = scope_parcels(query, user).first()
    if not parcel:
        # Same answer whether it doesn't exist or belongs to someone else
        raise HTTPException(status_code=404, detail="Parcel not found")
    return parcel


def ensure_user_can_modify(parcel: models.Parcel, user: models.User) -> None:
    if user.role == "admin":
        return
    if parcel.status not in USER_CAN_MODIFY_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can only change a parcel while it is {', '.join(USER_CAN_MODIFY_STATUSES)}. Ask the admin.",
        )


def get_normal_user_or_404(db: Session, user_id: int) -> models.User:
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="The admin account can't be changed")
    return target


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post(
    "/api/auth/signup",
    response_model=schemas.UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Public signup creates a normal user who must wait for the admin to
    # approve the account. There is only one admin (see seed_admin), and
    # nothing in the API can create or promote another one.
    new_user = models.User(
        email=user.email,
        hashed_password=get_password_hash(user.password),
        role="user",
        status="pending",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/api/auth/login")
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    email = credentials.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Only checked after the password is correct, so strangers can't probe
    # which emails are registered or pending.
    ensure_account_allowed(user)

    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
    }


@app.get("/api/auth/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(get_approved_user)):
    return current_user


# ---------------------------------------------------------------------------
# User management (admin only)
# ---------------------------------------------------------------------------

@app.get("/api/users/stats", response_model=schemas.UserStats)
def get_user_stats(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    rows = (
        db.query(models.User.status, func.count(models.User.id))
        .filter(models.User.role == "user")
        .group_by(models.User.status)
        .all()
    )
    counts = {name: count for name, count in rows}
    return schemas.UserStats(
        total=sum(counts.values()),
        pending=counts.get("pending", 0),
        active=counts.get("active", 0),
        blocked=counts.get("blocked", 0),
    )


@app.get("/api/users", response_model=schemas.UserList)
def list_users(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    query = db.query(models.User).filter(models.User.role == "user")

    if search and search.strip():
        query = query.filter(models.User.email.ilike(f"%{search.strip()}%"))

    if status_filter and status_filter != "All":
        if status_filter not in ("pending", "active", "blocked"):
            raise HTTPException(
                status_code=400, detail="Status must be pending, active or blocked"
            )
        query = query.filter(models.User.status == status_filter)

    total = query.count()
    users = (
        query.order_by(models.User.created_at.desc(), models.User.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    parcel_counts = dict(
        db.query(models.Parcel.created_by, func.count(models.Parcel.id))
        .group_by(models.Parcel.created_by)
        .all()
    )

    data = [
        schemas.UserListItem(
            id=u.id,
            email=u.email,
            role=u.role,
            status=u.status,
            created_at=u.created_at,
            parcel_count=parcel_counts.get(u.id, 0),
        )
        for u in users
    ]

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, ceil(total / limit)),
        "data": data,
    }


@app.patch("/api/users/{user_id}/status", response_model=schemas.UserResponse)
def update_user_status(
    user_id: int,
    body: schemas.UserStatusUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    target = get_normal_user_or_404(db, user_id)
    target.status = body.status
    db.commit()
    db.refresh(target)
    return target


@app.delete("/api/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    target = get_normal_user_or_404(db, user_id)
    email = target.email

    # Keep the parcels (the company still has to deliver them); they just
    # lose their owner and are then visible only to the admin.
    db.query(models.Parcel).filter(models.Parcel.created_by == target.id).update(
        {models.Parcel.created_by: None}
    )
    db.delete(target)
    db.commit()
    return {"message": f"User {email} deleted successfully"}


# ---------------------------------------------------------------------------
# Public tracking (no login needed)
# ---------------------------------------------------------------------------

@app.get("/api/track/{tracking_id}", response_model=schemas.TrackingResponse)
def track_parcel(tracking_id: str, db: Session = Depends(get_db)):
    """Anyone with a tracking ID can see the status and the town, never names."""
    parcel = (
        db.query(models.Parcel)
        .filter(models.Parcel.tracking_id == tracking_id.strip().upper())
        .first()
    )
    if not parcel:
        raise HTTPException(
            status_code=404, detail="No parcel found with this tracking ID"
        )
    return parcel


# ---------------------------------------------------------------------------
# Parcels
# ---------------------------------------------------------------------------

# NOTE: /stats must be declared before /{parcel_id}, otherwise "stats" would be
# read as a parcel id.
@app.get("/api/parcels/stats", response_model=schemas.ParcelStats)
def get_parcel_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_approved_user),
):
    query = db.query(models.Parcel.status, func.count(models.Parcel.id))
    query = scope_parcels(query, current_user)
    rows = query.group_by(models.Parcel.status).all()
    counts = {name: count for name, count in rows}
    return schemas.ParcelStats(
        total=sum(counts.values()),
        pending=counts.get("Pending", 0),
        processing=counts.get("Processing", 0),
        in_transit=counts.get("In Transit", 0),
        delivered=counts.get("Delivered", 0),
    )


@app.get("/api/parcels", response_model=schemas.ParcelList)
def get_parcels(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    sort_by: str = "created_at",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_approved_user),
):
    query = scope_parcels(db.query(models.Parcel), current_user)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Parcel.tracking_id.ilike(pattern),
                models.Parcel.title.ilike(pattern),
                models.Parcel.sender_name.ilike(pattern),
                models.Parcel.receiver_name.ilike(pattern),
                models.Parcel.district.ilike(pattern),
                models.Parcel.sub_district.ilike(pattern),
                models.Parcel.thana.ilike(pattern),
            )
        )

    if status_filter and status_filter != "All":
        if status_filter not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Status must be one of: {', '.join(VALID_STATUSES)}",
            )
        query = query.filter(models.Parcel.status == status_filter)

    sort_column = SORTABLE_COLUMNS.get(sort_by)
    if sort_column is None:
        raise HTTPException(
            status_code=400,
            detail=f"Sort by one of: {', '.join(SORTABLE_COLUMNS)}",
        )
    direction = sort_column.asc() if order == "asc" else sort_column.desc()

    total = query.count()
    parcels = (
        query.order_by(direction, models.Parcel.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, ceil(total / limit)),
        "data": parcels,
    }


@app.get("/api/parcels/{parcel_id}", response_model=schemas.ParcelResponse)
def get_parcel(
    parcel_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_approved_user),
):
    return get_parcel_or_404(db, parcel_id, current_user)


@app.post(
    "/api/parcels",
    response_model=schemas.ParcelResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_parcel(
    parcel: schemas.ParcelCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_approved_user),
):
    data = parcel.model_dump()
    if current_user.role != "admin":
        data["status"] = "Pending"  # only the admin decides the shipping status

    new_parcel = models.Parcel(
        tracking_id=generate_tracking_id(db),
        created_by=current_user.id,
        **data,
    )
    db.add(new_parcel)
    db.commit()
    db.refresh(new_parcel)
    return new_parcel


@app.put("/api/parcels/{parcel_id}", response_model=schemas.ParcelResponse)
def update_parcel(
    parcel_id: int,
    parcel_update: schemas.ParcelUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_approved_user),
):
    parcel = get_parcel_or_404(db, parcel_id, current_user)
    ensure_user_can_modify(parcel, current_user)

    # Ignore nulls so a required column can never be blanked out
    changes = {
        key: value
        for key, value in parcel_update.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")

    if "status" in changes and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the admin can change the shipping status",
        )

    for key, value in changes.items():
        setattr(parcel, key, value)

    db.commit()
    db.refresh(parcel)
    return parcel


@app.delete("/api/parcels/{parcel_id}")
def delete_parcel(
    parcel_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_approved_user),
):
    parcel = get_parcel_or_404(db, parcel_id, current_user)
    ensure_user_can_modify(parcel, current_user)

    tracking_id = parcel.tracking_id
    db.delete(parcel)
    db.commit()
    return {"message": f"Parcel {tracking_id} deleted successfully"}
