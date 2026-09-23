# SwiftLogistics API

FastAPI backend for **SwiftLogistics**, a parcel booking and tracking system with an admin panel.

- **Live API:** https://swift-logistics-api.onrender.com (interactive docs at `/docs`)
- **Frontend:** https://swift-logistics-frontend.vercel.app
- **Frontend repository:** https://github.com/Khalid635/swift-logistics-frontend

> The API runs on a free Render instance. After 15 minutes without traffic it goes to sleep, so the first request can take about a minute. The free Postgres database on Render expires on **20 October 2026**.

## Features

- Signup and login with JWT tokens and bcrypt-hashed passwords
- **One admin** account, created automatically from environment variables when the server starts
- **Account approval:** new signups are `pending` until the admin approves them; the admin can also block, unblock or remove users
- **Role-based access**
  - Admin: sees every parcel, edits and deletes any parcel, changes shipping status, manages users
  - User: sees only their own parcels, adds parcels, and edits or deletes them while they are still `Pending`
- Parcel CRUD with validation (name length, weight 0.1 to 100 kg, allowed statuses)
- Search across 7 fields, sorting, status filter and pagination
- Summary statistics for the dashboard cards
- **Public tracking endpoint** that needs no login and never exposes names or exact address

## Tech stack

FastAPI, SQLAlchemy 2, Pydantic 2, python-jose (JWT), passlib + bcrypt, SQLite for local development and PostgreSQL in production.

## API overview

| Method | Path | Access |
|---|---|---|
| GET | `/api/health` | Public |
| GET | `/api/track/{tracking_id}` | Public |
| POST | `/api/auth/signup` | Public |
| POST | `/api/auth/login` | Public (approved accounts only) |
| GET | `/api/auth/me` | Logged in |
| GET | `/api/parcels`, `/api/parcels/stats`, `/api/parcels/{id}` | Logged in (users see only their own) |
| POST | `/api/parcels` | Logged in |
| PUT / DELETE | `/api/parcels/{id}` | Admin, or the owner while the parcel is `Pending` |
| GET | `/api/users`, `/api/users/stats` | Admin |
| PATCH | `/api/users/{id}/status` | Admin |
| DELETE | `/api/users/{id}` | Admin |

## Run it locally

```bash
python -m venv .venv
source .venv/bin/activate        # on Windows Git Bash: source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://127.0.0.1:8000/docs. Without any environment variables the app uses a local SQLite file (`logistics.db`) and creates a local-only admin account `admin@swiftlogistics.com` / `admin1234`. The live site uses different credentials.

## Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (SQLite is used when it is not set) |
| `SECRET_KEY` | Secret used to sign login tokens |
| `ADMIN_EMAIL` | Email of the admin account |
| `ADMIN_PASSWORD` | Password of the admin account |
| `ALLOWED_ORIGINS` | Comma-separated list of frontend addresses allowed by CORS |

## Deployment

Deployed on Render as a Python web service with a Render Postgres database.

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
