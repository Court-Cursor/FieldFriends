# FieldFriends

FieldFriends is a sporting events MVP with:
- FastAPI backend
- React frontend
- PostgreSQL database

Implemented MVP features:
- Signup and login with JWT
- Protected routes for create/join/my-events
- Create events with timing and location
- List upcoming events
- Event details with joined count and join status
- Join event with duplicate join prevention
- My Events (created and joined)

## Project layout

- `backend` - FastAPI app, SQLAlchemy models, Alembic migrations, tests
- `frontend` - React app (Vite + TypeScript)

## Backend setup

1. Create and activate a virtual environment.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies.

```powershell
python -m pip install -e .[dev]
```

3. Configure environment.

```powershell
Copy-Item .env.example .env
```

4. Run migrations.

```powershell
alembic upgrade head
```

5. Start the API server.

```powershell
uvicorn app.main:app --reload
```

API will be available at `http://localhost:8000`.

## Frontend setup

1. Install dependencies.

```powershell
cd frontend
npm install
```

2. Configure environment.

```powershell
Copy-Item .env.example .env
```

3. Start the frontend.

```powershell
npm run dev
```

Frontend will be available at `http://localhost:5173`.

## Running tests

Run backend tests:

```powershell
cd backend
python -m pytest
```

## Key backend endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `GET /me`
- `POST /events`
- `GET /events`
- `GET /events/{event_id}`
- `POST /events/{event_id}/join`
- `GET /users/me/events`
