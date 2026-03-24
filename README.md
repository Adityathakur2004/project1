# EduPilot

EduPilot is a full-stack student intelligence platform for academic performance analysis, curriculum gap detection, and personalized improvement planning.

It combines:
- role-based dashboards for mentors, students, and parents
- benchmark comparison for competitive exam readiness
- curriculum comparison against top Indian institute expectations and market skills
- parent-facing reports and PDF export
- Postgres-ready backend with migrations and seed scripts

## What the Product Does

EduPilot helps a student or institute answer:
- where the student is underperforming
- which chapters or routines are causing the gap
- how the student compares against benchmark learning paths
- what should be learned next for exams or job readiness

The app currently includes:
- authenticated access with `mentor`, `student`, and `parent` roles
- student profile CRUD
- intervention tracker and review workflow
- assignment and invite flows
- cohort analytics with charts
- AI-style parent reports
- curriculum comparison page with PDF upload
- platform settings page with environment health checks

## Tech Stack

- Frontend: React 19, Vite
- Backend: Express
- Database: PostgreSQL with JSON fallback for local development
- Charts: Recharts
- PDF export: jsPDF
- AI report integration: OpenAI Responses API

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment file

```bash
copy .env.example .env
```

### 3. Start the app

```bash
npm run dev
```

Default local ports:
- frontend: `http://localhost:5173`
- backend: `http://localhost:4000`

## Demo Accounts

- `mentor@edupilot.demo` / `edupilot123`
- `student@edupilot.demo` / `edupilot123`
- `parent@edupilot.demo` / `edupilot123`

## Environment Variables

Use [.env.example](/Users/LENOVO/Downloads/codex/.env.example) as the template.

- `DATABASE_URL`: enables Postgres storage
- `PGSSL`: set `disable` for local Postgres if needed
- `OPENAI_API_KEY`: enables AI-written reports
- `OPENAI_MODEL`: OpenAI model name for reports
- `VITE_API_BASE_URL`: optional frontend API base URL for deployed environments

If `DATABASE_URL` is not set, the app uses local JSON files in [data](/Users/LENOVO/Downloads/codex/data).

If `OPENAI_API_KEY` is not set, the app uses deterministic fallback reports.

## Postgres Setup

Run migrations first:

```bash
npm run migrate
```

Seed the normalized tables:

```bash
npm run seed:db
```

If you want to reseed from scratch:

```bash
npm run seed:db:reset
```

## Available Scripts

- `npm run dev`: run frontend and backend together
- `npm run client`: run Vite frontend
- `npm run server`: run Express backend
- `npm run migrate`: apply SQL migrations
- `npm run seed:db`: seed Postgres
- `npm run seed:db:reset`: reset and reseed Postgres
- `npm run lint`: run ESLint
- `npm run build`: build frontend for production
- `npm run preview`: preview production frontend build

## Project Structure

```text
src/
  components/
  App.jsx
  App.css
  index.css
db/
  migrations/
  migrate.js
  seed.js
data/
  students.json
  users.json
  invites.json
server.js
vite.config.js
```

## Deployment Notes

For production, use:
- a Postgres database
- the Express server in [server.js](/Users/LENOVO/Downloads/codex/server.js) to serve both API routes and the built frontend

The production server now serves the contents of `dist/` directly, so you can deploy EduPilot as a single full-stack service.

If frontend and backend are deployed on different domains, set:

```bash
VITE_API_BASE_URL=https://your-api-domain.com
```

Recommended deployment flow:

1. Provision Postgres.
2. Set environment variables.
3. Run `npm run migrate`.
4. Run `npm run seed:db`.
5. Run `npm run build`.
6. Start `node server.js`.

## Docker Deployment

This repo includes:
- [Dockerfile](/Users/LENOVO/Downloads/codex/Dockerfile)
- [docker-compose.yml](/Users/LENOVO/Downloads/codex/docker-compose.yml)

To run the full stack with Docker:

```bash
docker compose up --build
```

This starts:
- EduPilot app on `http://localhost:4000`
- Postgres on `localhost:5432`

The compose setup automatically runs:
- migrations
- database seeding
- the production server

## Render Deployment

This repo includes [render.yaml](/Users/LENOVO/Downloads/codex/render.yaml) for a simple hosted setup.

It provisions:
- one Node web service
- one Postgres database

Render start flow:
- `npm run migrate`
- `npm run seed:db`
- `node server.js`

If you want AI-written reports in production, set `OPENAI_API_KEY` in Render.

## Product Areas

### Student Intelligence

- benchmark gap analysis
- routine diagnostics
- subject-level weakness detection
- intervention planning
- cohort analytics

### Curriculum Comparison

- upload or paste college curriculum
- compare with IIT/NIT/IIIT-style expectations
- compare with market role skill clusters
- generate learning focus recommendations
- extract text from PDF syllabus files

### Parent and Mentor Reporting

- parent-friendly progress reports
- mentor summary reports
- PDF export with visual performance comparisons

## Current Runtime Behavior

The app automatically switches between:
- JSON fallback mode for quick local development
- normalized Postgres mode when `DATABASE_URL` is available

You can inspect the live runtime status from the in-app `Platform settings` page.

## Verification

Recent local verification includes:
- `npm run lint`
- `npm run build`
- auth and health API smoke tests

## GitHub Repository

Repository: [project1](https://github.com/Adityathakur2004/project1.git)
