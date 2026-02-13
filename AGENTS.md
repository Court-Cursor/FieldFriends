This repository contains a small Sporting Events application:

- Frontend: React.js
- Backend: FastAPI (Python)
- Database: PostgreSQL

Purpose: users can sign up/log in, create sporting events (timings + location), browse upcoming events, and join events. Optional: map view and Google Maps location picking.

---

## 1. Product requirements (source of truth)

### Core features (MVP)
1. Auth
   - Sign up
   - Log in
   - Protected routes
2. Events
   - Create an event with: title, sport type (optional), start_time, end_time, location_text
   - List available events (upcoming)
   - View event details
3. Participation
   - Join an event
   - Prevent duplicate join
   - Show "My Events" (created + joined)

### Optional features
- Map view (plot events by location)
- Google Maps integration (choose location)
  - Use this only after MVP is stable

---

## 2. Architecture and design rules

### Backend (FastAPI)
- Use a layered approach:
  - `api` layer: request/response, routing, dependency injection
  - `service` layer: business logic (validation beyond schema, permissions, workflows)
  - `repo` layer: database access (queries)
  - `models` layer: ORM models
  - `schemas` layer: Pydantic models
- Keep route handlers thin. Route handlers should:
  - parse request
  - call service functions
  - return response DTOs
- Enforce consistent error handling:
  - Use `HTTPException` with clear status codes
  - Prefer structured validation via Pydantic for input
- Use Pydantic v2 models for request/response
- Prefer async endpoints only if DB driver supports async cleanly. If using SQLAlchemy sync, keep endpoints sync to avoid fake async.

### Database
- PostgreSQL
- Use migrations (Alembic) for all schema changes
- Use constraints for data integrity:
  - unique email
  - unique `(event_id, user_id)` participation to prevent duplicate join

### Frontend (React)
- Keep it simple: Login, Signup, Event List, Event Detail, Create Event, My Events
- Use a single API client module with typed request helpers
- Handle auth token storage securely (see Auth section)

---

## 3. Data model (minimum schema)

### users
- id (uuid)
- email (unique, indexed)
- password_hash
- created_at

### events
- id (uuid)
- creator_id (FK -> users.id)
- title (required)
- sport_type (optional)
- description (optional)
- start_time (timestamp with timezone recommended)
- end_time (timestamp with timezone recommended)
- location_text (required)
- latitude (optional, float)
- longitude (optional, float)
- max_participants (optional, int)
- created_at

### event_participants
- id (uuid) OR composite PK (event_id, user_id)
- event_id (FK -> events.id)
- user_id (FK -> users.id)
- joined_at
- Unique constraint: (event_id, user_id)

---

## 4. API contract (must match requirements)

### Auth
- `POST /auth/signup`
  - body: email, password
  - returns: user + token (or token only)
- `POST /auth/login`
  - body: email, password
  - returns: token + user summary
- `GET /me`
  - protected
  - returns: current user profile

Auth strategy:
- Prefer JWT access token
- For a school project, storing JWT in memory or localStorage is acceptable, but do not store sensitive info in localStorage.
- If using cookies, use HttpOnly cookies and CSRF protection.

### Events
- `POST /events`
  - protected
  - body: title, start_time, end_time, location_text, optional sport_type, description, lat/lng, max_participants
  - validation: end_time > start_time
- `GET /events`
  - public or protected (either ok)
  - query: `q`, `sport`, `date_from`, `date_to`, `limit`, `offset`
  - returns: list with `joined_count` and optionally `is_joined_by_me` if user is logged in
- `GET /events/{event_id}`
  - returns event details + joined_count + is_joined_by_me
- `POST /events/{event_id}/join`
  - protected
  - prevents duplicate join (DB unique constraint + safe handling)
  - optional: block join if event already ended
  - optional: enforce max_participants
- `DELETE /events/{event_id}/leave` (optional)
- `GET /users/me/events`
  - protected
  - returns: created_events + joined_events

---

## 5. Security and validation rules

- Password hashing: use `passlib[bcrypt]` or `argon2-cffi`
- Never store plain passwords
- Validate all user input with Pydantic:
  - email format
  - non-empty title and location_text
  - start_time/end_time ordering
- Authorization:
  - Only authenticated users can create/join
  - If edit/delete is added later: only creator can modify their event

---

## 6. Modern Python and FastAPI best practices

- Prefer SQLAlchemy 2.0 style
- Use dependency injection for DB session:
  - `Depends(get_db)`
- Keep configuration in `pydantic-settings`:
  - `DATABASE_URL`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `CORS_ORIGINS`
- Use structured logging
- Add CORS config for React dev server
- Use type hints everywhere and run mypy (optional but recommended)

---

## 7. Code quality expectations (agents must follow)

When adding or changing code:
- Do not create large files with mixed responsibilities
- Add docstrings for service-level functions
- Avoid duplicated logic across routes
- Keep naming consistent:
  - `snake_case` in Python
  - `PascalCase` for Pydantic classes
- Handle timezone explicitly. Prefer storing timestamps in UTC.
- Return stable response schemas (do not leak internal DB fields like password_hash)

---

## 8. Testing requirements

Minimum testing:
- Unit tests for services:
  - create event validation
  - join event prevents duplicates
- API tests:
  - signup/login flow
  - create event requires auth
  - join event requires auth
- Use `pytest`
- Use a separate test database (or transaction rollbacks)

---

## 9. Migrations and database changes

- All schema changes must go through Alembic migrations
- Never manually change production DB schema without migration
- If adding new columns, consider defaults and backfill

---

## 10. Deployment and local development

Expected local flow:
1. Start Postgres (Docker recommended)
2. Run migrations
3. Start FastAPI
4. Start React

Agents should provide:
- `README` updates when commands or env vars change
- `.env.example` updates when new config is introduced

Suggested env vars:
- `DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/fieldfriends`
- `JWT_SECRET=...`
- `JWT_EXPIRES_MINUTES=60`
- `CORS_ORIGINS=http://localhost:5173,http://localhost:3000`

---

## 11. Map and Google integration guidance (optional scope)

If implementing maps:
- Store `latitude` and `longitude` on event creation
- Do not require maps for core flow
- Do not hardcode API keys in repo
- Prefer environment variables and restrict keys

---

## 12. Agent task checklist (use for each change)

Before coding:
- Identify which requirement you are implementing
- Decide: API, service, repo, schema, migration, frontend

While coding:
- Add/adjust Pydantic schemas
- Add/adjust service logic
- Add/adjust migrations if schema changed
- Add/adjust tests

After coding:
- Run formatting and tests
- Ensure endpoints match contract
- Update README or env example if needed

---

## 13. Output style rules for agents

- Be concise and direct
- Prefer small, reviewable commits
- Avoid introducing unnecessary libraries
- Do not include long dashes (use normal hyphen "-")
- Do not add features beyond the stated requirements unless explicitly requested