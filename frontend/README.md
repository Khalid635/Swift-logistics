# SwiftLogistics Frontend

React frontend for **SwiftLogistics**, a parcel booking and tracking system with an admin panel.

- **Live site:** https://swift-logistics-frontend.vercel.app
- **Public tracking page:** https://swift-logistics-frontend.vercel.app/#/track
- **Backend API:** https://swift-logistics-api.onrender.com
- **Backend repository:** https://github.com/Khalid635/swift-logistics-backend

> The backend runs on a free Render instance that sleeps after 15 minutes of inactivity. The first login or request can take about a minute while it wakes up. The free database expires on **20 October 2026**.

## Features

- Login, signup and logout with a real token from the backend
- New accounts wait for **admin approval** before they can log in
- **Admin dashboard**
  - Summary cards for each shipment status (click a card to filter)
  - Add, edit and delete any parcel and change its shipping status
  - **Users tab** to approve, block, unblock or remove users, with a badge for accounts waiting for approval
- **User dashboard:** book parcels, see only your own parcels, and edit or delete them while they are `Pending`
- Search, sort by column, status filter, pagination and CSV export
- Cascading District → Sub-district → Thana selection
- Form validation with clear error messages
- **Public parcel tracking page** (built with Tailwind CSS): enter a tracking ID and see the current status and progress

## Tech stack

React 19, Tailwind CSS 3, Axios, custom CSS for the dashboard and login screens, deployed on Vercel.

## Run it locally

```bash
npm install
npm start
```

The app opens at http://localhost:3000 and talks to `http://127.0.0.1:8000` by default, so start the backend from the backend repository first. To use another backend, set the environment variable below before starting.

## Environment variable

| Name | Purpose |
|---|---|
| `REACT_APP_API_URL` | Address of the backend API, without a trailing slash (for example `https://swift-logistics-api.onrender.com`) |

## Project structure

```
src/
├── api/axios.js            Axios instance, adds the login token to every request
├── pages/
│   ├── Login.jsx
│   ├── Signup.jsx
│   ├── Dashboard.jsx       Parcels table, form, filters, summary cards
│   └── TrackingPage.jsx    Public tracking page
├── components/UsersPanel.jsx   Admin user management
├── styles/                 Custom CSS files
└── App.js                  Switches between login, signup, dashboard and tracking
```
