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

## Local Setup Requirements (For testing)

1. Python 3.11 and above
2. Node.js
3. Postgres

## Backend setup

1. Create and activate a virtual environment.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# For windows, either give bypass for scripts in powershell or use this in command prompt instead
.\.venv\Scripts\Activate.bat
```

2. Install dependencies.

```powershell
python -m pip install -e .[dev]
```

3. Configure environment. (Use powershell)

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

2. Configure environment. (Use powershell)

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

## AWS deployment

This repo now includes a PowerShell deployment script at [scripts/aws/deploy.ps1](/c:/Users/Ryzen/Projects/FieldFriends/scripts/aws/deploy.ps1). It deploys:
- Database: optional PostgreSQL RDS instance, with private or public access depending on config
- Backend: Docker image to ECR, then create/update an AWS App Runner service
- Frontend: Vite build to S3 static website hosting, with optional CloudFront invalidation

### Prerequisites

1. Install and configure the AWS CLI.
2. Install Docker Desktop and make sure the Docker daemon is running if you plan to deploy the backend.
3. Create an IAM role for App Runner to pull from ECR and attach `AWSAppRunnerServicePolicyForECRAccess`.
   Trust policy principal: `build.apprunner.amazonaws.com`
4. If you plan to use `-DeployDatabase`, use a VPC with at least 2 subnets in different AZs. The script uses your default VPC if you do not specify one.

### Deployment config

1. Copy [scripts/aws/deploy.env.example](/c:/Users/Ryzen/Projects/FieldFriends/scripts/aws/deploy.env.example) to `scripts/aws/deploy.env`.
2. Copy [backend/.env.aws.example](/c:/Users/Ryzen/Projects/FieldFriends/backend/.env.aws.example) to `backend/.env.aws`.
3. Fill in the AWS resource names, the App Runner role ARN, and the production backend environment variables.

Important values:
- `BACKEND_ENV_FILE` points to the runtime env file App Runner receives.
- `DB_MASTER_PASSWORD` is required when you use `-DeployDatabase`.
- `DB_PUBLIC_ACCESS=false` is the safe default for a private RDS instance.
- If you need to connect from your local backend, set `DB_PUBLIC_ACCESS=true` and set `DB_ALLOWED_CIDRS` to your public IP in CIDR form, for example `203.0.113.10/32`.
- `VPC_ID` and `VPC_SUBNET_IDS` are optional. If omitted, the script uses the default VPC and its available subnets.
- `FRONTEND_BUCKET` must be globally unique in S3.
- `FRONTEND_API_URL` can be left blank if you deploy the backend in the same run. The script will reuse the App Runner URL automatically.
- `CLOUDFRONT_DISTRIBUTION_ID` is optional. If set, the script invalidates it after the S3 upload.

### Deploy command

> Use [Action](https://github.com/Court-Cursor/FieldFriends/actions) to deploy to aws


Run from the repo root:

```powershell
# Full stack with AWS RDS provisioning
powershell -ExecutionPolicy Bypass -File .\scripts\aws\deploy.ps1 -DeployDatabase
```

Optional flags:

```powershell
# Backend + frontend, using an existing database URL from backend/.env.aws
powershell -ExecutionPolicy Bypass -File .\scripts\aws\deploy.ps1

# Database only
powershell -ExecutionPolicy Bypass -File .\scripts\aws\deploy.ps1 -DeployDatabase -SkipBackend -SkipFrontend

# Backend only
powershell -ExecutionPolicy Bypass -File .\scripts\aws\deploy.ps1 -SkipFrontend

# Frontend only
powershell -ExecutionPolicy Bypass -File .\scripts\aws\deploy.ps1 -SkipBackend
```

Notes:
- `-DeployDatabase` provisions PostgreSQL RDS, creates security groups, and only creates the App Runner VPC connector when the backend is deployed in the same run.
- If the RDS instance already exists, the script reuses it instead of recreating it.
- The backend container runs `alembic upgrade head` on startup before launching Uvicorn.
- The S3 setup is configured as a public static website for simplicity. If you want HTTPS on the frontend, put CloudFront in front of the bucket.

### Database only on AWS

If you only want the database on AWS, use the dedicated wrapper script:

1. Copy [scripts/aws/deploy-db.env.example](/c:/Users/Ryzen/Projects/FieldFriends/scripts/aws/deploy-db.env.example) to `scripts/aws/deploy-db.env`.
2. Fill in the RDS settings.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\aws\deploy-db.ps1
```

If your backend stays local and needs to reach AWS RDS directly:
- Set `DB_PUBLIC_ACCESS=true`
- Set `DB_ALLOWED_CIDRS` to your public IP with `/32`
