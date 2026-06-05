# Bekye Swap API

Node.js + Express + PostgreSQL (Prisma) — battery swap SaaS backend.

## Setup

1. Start Postgres:

```bash
docker compose up -d
```

2. Copy env and migrate:

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

API: http://localhost:4000

## Dev OTP

With `DEV_LOG_OTP=true`, registration OTP is printed in the terminal (no SMTP required).

## Key endpoints

- `POST /api/auth/register` — business registration
- `POST /api/auth/verify-otp` — activate account
- `POST /api/auth/login`
- `GET /api/dashboard/owner` — admin stats
- `CRUD /api/substations`, `/api/employees`
- `POST /api/swaps/analyze-image` — OCR + QR
- `POST /api/swaps` — record swap
- `GET /api/reports/summary`, `GET /api/reports/pdf`
