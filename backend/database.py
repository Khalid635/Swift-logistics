import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Locally this stays SQLite (logistics.db). On the live server we set the
# DATABASE_URL environment variable to the Postgres address.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./logistics.db")

# Some hosts give the address as "postgres://...", but SQLAlchemy needs
# "postgresql://...".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # pool_pre_ping reconnects if the database dropped an idle connection
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
