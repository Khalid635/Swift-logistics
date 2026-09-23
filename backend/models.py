from database import Base
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # "admin" (only one, created by seed_admin) or "user"
    role = Column(String, default="user", nullable=False)

    # "pending" (waiting for the admin), "active" (approved) or "blocked"
    status = Column(String, default="pending", nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parcels = relationship("Parcel", back_populates="creator")


class Parcel(Base):
    __tablename__ = "parcels"

    id = Column(Integer, primary_key=True, index=True)
    tracking_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    sender_name = Column(String, nullable=False)
    receiver_name = Column(String, nullable=False, index=True)
    weight = Column(Float, nullable=False)

    # Location (matches the dropdowns in the dashboard form)
    district = Column(String, nullable=False, index=True)
    sub_district = Column(String, nullable=False)
    thana = Column(String, nullable=False)

    status = Column(String, default="Pending", nullable=False, index=True)

    # Who created this parcel. Becomes NULL if that user is deleted.
    created_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    creator = relationship("User", back_populates="parcels")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def destination(self) -> str:
        """Readable one-line address, e.g. 'Zindabazar, Sylhet Sadar, Sylhet'."""
        return f"{self.thana}, {self.sub_district}, {self.district}"

    @property
    def created_by_email(self):
        return self.creator.email if self.creator else None
