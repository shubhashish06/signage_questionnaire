# Questionnaire Signage

Questionnaire signage app with QR-based participation. Configurable per instance—Valentine's couple questionnaire included as the default instance.

## Features

- **Questionnaire**: Single or couple mode (Person 1 + Person 2: name, email, gender, phone)
- **Custom questions**: Configurable per instance (default: Valentine's theme, e.g. "How did you meet?", "Favorite date idea?")
- **Signage display**: QR code + thank-you screen
- **Admin**: Configure questionnaire, Google Sheet ID, validation rules

## Quick Start

### 1. Start PostgreSQL (Docker)

```bash
docker compose -f docker-compose.db.yml up -d
```

### 2. Environment

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Default: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/questionnaire` (port 5433 to avoid conflict with other PostgreSQL on 5432)

### 3. Install & Run

```bash
# Install all dependencies
npm run install:all

# Build frontends (already done if you ran this before)
npm run build

# Start the app
npm start
```

### 4. URLs

- **Signage**: http://localhost:3002/signage?id=DEFAULT
- **Mobile form**: Scan QR code on signage (or http://localhost:3002/play?id=DEFAULT&token=...)
- **Admin**: http://localhost:3002/admin?id=DEFAULT
- **Super Admin**: http://localhost:3002/superadmin

## API

- `POST /api/submit-questionnaire` – Submit questionnaire (requires token from QR scan)
