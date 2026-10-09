# BookNest

A gamified book club platform. Track what you read, build daily reading streaks, climb leaderboards, join public or private clubs with real-time chat, and get book recommendations based on your taste.

**Live demo:** https://booknestfrontendfinal.vercel.app

## Features

- **Accounts:** register and log in with email and password. Passwords are hashed with bcrypt and sessions use JWT.
- **Reading tracker:** keep a planned, current, completed or abandoned shelf, log reading sessions, and set a daily page goal.
- **Streaks and leaderboards:** daily streaks plus weekly, monthly and all-time leaderboards computed with MongoDB aggregation pipelines.
- **Book clubs:** create public or private clubs. Leaders set the club's current book, theme and reading schedule, and invite members. Private clubs are joined through expiring single-use invite tokens.
- **Real-time chat:** per-club chat over Socket.IO with a JWT-authenticated connection, threaded replies, cursor-based pagination, and soft deletes. A message's author or a club leader can delete it, and only the author can edit it.
- **Recommendations:** learns genre preferences from your liked genres and your completed and abandoned books, pulls candidates from Google Books and Open Library, and ranks them. Results are cached in Redis for one hour, with an in-memory fallback if Redis is unavailable.
- **AI assistant and summaries:** a Gemini-powered assistant, plus a separate Flask microservice that summarizes and translates PDF books.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Recharts |
| Backend | Node.js, Express 5, TypeScript, Socket.IO, Mongoose |
| Database | MongoDB |
| Cache | Redis (with in-memory fallback) |
| Summarizer | Python, Flask, Gemini API, PyMuPDF, gunicorn |
| External APIs | Google Books, Open Library, Gemini |
| Hosting | Frontend on Vercel |

## Project structure

```
booknest_final/
├── backend/              Express + Socket.IO API (TypeScript)
│   └── src/
│       ├── routes/       URL → controller wiring
│       ├── controllers/  request handling and validation
│       ├── services/     business logic (gamification, recommender, cache, ...)
│       ├── models/       Mongoose schemas
│       ├── middleware/   auth, club membership and leader checks
│       ├── config/       database and JWT config
│       └── socket.ts     Socket.IO server
├── frontend/             React app (Vite)
└── booknest-summarizer/  Flask microservice for summaries and translation
```

The backend follows a layered design: routes call controllers, controllers call services, and services use models.

## How the pieces fit together

```
React (Vercel) ──REST + WebSocket──▶ Express API ──▶ MongoDB
                                         │
                                         ├──▶ Redis (recommendation cache)
                                         ├──▶ Google Books / Open Library
                                         └──▶ Flask summarizer ──▶ Gemini
```

If the summarizer service is unavailable, the API falls back to calling Gemini directly.

## Getting started

### Prerequisites

- Node.js 18 or newer
- A MongoDB database (local or Atlas)
- Optional: Redis, a Google Books API key, a Gemini API key
- Python 3.10 or newer, only if you run the summarizer

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/booknest
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=7d
GOOGLE_BOOKS_API_KEY=your-key
GEMINI_API_KEY=your-key
REDIS_URL=redis://localhost:6379
SUMMARIZER_URL=http://localhost:5003
```

`MONGO_URI` and `JWT_SECRET` are required. The rest are optional, and the app degrades gracefully without Redis or the summarizer.

```bash
npm run dev        # development with nodemon
npm run build      # compile TypeScript to dist/
npm start          # run the compiled server
```

The API listens on `http://localhost:5001`.

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5001
```

```bash
npm run dev
```

`VITE_API_URL` is read at build time, so rebuild after changing it.

### 3. Summarizer (optional)

```bash
cd booknest-summarizer
pip install -r requirements.txt
export GEMINI_API_KEY=your-key
python app.py          # development, listens on port 5003
```

In production it runs under gunicorn using the included `Procfile`.

## API overview

All routes are under `/api`. Most require an `Authorization: Bearer <token>` header.

| Area | Base path | Examples |
| --- | --- | --- |
| Auth | `/api/auth` | `POST /register`, `POST /login`, `GET /me` |
| Users | `/api/users` | `GET /leaderboard`, `GET /:id/stats`, `PATCH /me`, `PATCH /me/goal` |
| Books | `/api/books` | shelves, reading progress, `GET /stats`, `GET /recommendations` |
| Clubs | `/api/clubs` | create and list clubs, invites, schedule, current book |
| Chat | `/api/clubs/:id/messages` | `POST`, `GET`, `PATCH /:messageId`, `DELETE /:messageId` |
| Recommender | `/api/recommend` | `GET /` (rate limited to 10 requests per minute) |
| Assistant | `/api/gemini-genie` | `POST /`, `POST /summarize-text` |

### Real-time chat events

Clients connect to the same server with `auth: { token }` and emit `join_club` with `{ clubId }`. Messages are saved first and then broadcast to the club's room. Both events use acknowledgement callbacks, and membership is re-checked on every join and send.

## Roles and permissions

- **Member:** read and post in clubs they have joined.
- **Club leader:** everything a member can do, plus managing the club's book, theme, schedule and invites, and deleting any message in their club.
- **Message author:** can edit or delete their own messages.

## Deployment

- The frontend is deployed on Vercel. Set `VITE_API_URL` in the project's environment variables.
- The backend needs a host that keeps a long-running process, because Socket.IO holds open connections. Serverless functions are not suitable for it. Set the environment variables above and use `npm run build` as the build command and `npm start` as the start command.
- On Render's free tier the service sleeps after a period of inactivity, so the first request after a pause can take a while.
- The CORS origin in `backend/src/server.ts` must include your deployed frontend URL.
