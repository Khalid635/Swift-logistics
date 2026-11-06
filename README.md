# Swift Logistics

Full-stack parcel booking and delivery tracking platform.

- **Live demo:** https://swift-logistics-frontend.vercel.app
- **Backend API:** https://swift-logistics-api.onrender.com (interactive docs at `/docs`)
- **Backend repo:** https://github.com/Khalid635/swift-logistics-backend
- **Frontend repo:** https://github.com/Khalid635/swift-logistics-frontend

> The API runs on a free Render instance. After 15 minutes without traffic it goes to sleep, so the first request can take about a minute.

## 🚀 Features

- User registration and login (JWT); new accounts wait for admin approval
- Parcel booking and management (CRUD, validation: weight 0.1–100 kg)
- Delivery status tracking, including a public tracking page that needs no login
- Admin dashboard: summary cards, user approval / block / remove, edit any parcel
- Search across 7 fields, sorting, status filter and pagination
- CSV export of the current parcel list from the dashboard
- Cascading District → Sub-district → Thana selection

## 🛠️ Tech stack

Frontend: React 19, Tailwind CSS 3, Axios (deployed on Vercel)
Backend: FastAPI, SQLAlchemy 2, Pydantic 2, PyJWT (JWT), PostgreSQL in production / SQLite locally (deployed on Render)

## 📁 Project structure

```
frontend/   React frontend application (see frontend/README.md)
backend/    FastAPI backend API (see backend/README.md)
```

## Run it locally

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # on Windows Git Bash: source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://127.0.0.1:8000/docs. Without environment variables the app uses a local SQLite file (`logistics.db`); set `SECRET_KEY`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` first (see `backend/README.md`).

Frontend:

```bash
cd frontend
npm install
npm start
```

Opens at http://localhost:3000 and talks to `http://127.0.0.1:8000` by default. To use another backend, set `REACT_APP_API_URL` before starting (see `frontend/README.md`).

## Environment variables

Backend:

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (SQLite is used when it is not set) |
| `SECRET_KEY` | Secret used to sign login tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Email and password of the auto-created admin account |
| `ALLOWED_ORIGINS` | Comma-separated list of frontend addresses allowed by CORS |

Frontend:

| Name | Purpose |
|---|---|
| `REACT_APP_API_URL` | Address of the backend API, without a trailing slash |

## 👨‍💻 Author

**Khalid Bin Masud**

[GitHub](https://github.com/Khalid635) · [LinkedIn](https://linkedin.com/in/khalid-bin-masud-817a913b9)
