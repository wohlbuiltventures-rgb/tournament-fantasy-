# March Madness Fantasy League

A full-stack fantasy basketball app for March Madness with real-time snake drafts, live scoring, and leaderboards.

## Tech Stack

- **Backend**: Node.js + Express + SQLite (better-sqlite3) + Socket.io
- **Frontend**: React + Vite + Tailwind CSS
- **Payments**: Stripe (test mode)
- **Auth**: JWT

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd tournament-fantasy
```

### 2. Install all dependencies

```bash
npm run install:all
```

### 3. Configure environment variables

```bash
cp .env.example server/.env
```

Edit `server/.env` and fill in:
- `JWT_SECRET` — any random string (e.g., run `openssl rand -base64 32`)
- `STRIPE_SECRET_KEY` — from your Stripe dashboard (test mode)
- `STRIPE_WEBHOOK_SECRET` — from Stripe CLI or webhook dashboard
- `CLIENT_URL` — keep as `http://localhost:5173` for local dev
- `PORT` — keep as `3001`

### 4. Run the development server

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Stripe Test Cards

Use these card numbers in Stripe's test checkout:

| Card | Number |
|------|--------|
| Visa (success) | `4242 4242 4242 4242` |
| Visa (decline) | `4000 0000 0000 0002` |
| 3D Secure | `4000 0025 0000 3155` |

Use any future expiry date (e.g., `12/34`), any 3-digit CVC, and any ZIP code.

## Features

- **User Auth** — Register/login with JWT tokens
- **League Creation** — Pay $19.99 via Stripe to become commissioner
- **Snake Draft** — Real-time snake draft via Socket.io with countdown timer
- **Live Scoring** — Commissioner enters game stats; fantasy points auto-calculated
- **Leaderboard** — Live standings with expandable roster details
- **Admin Panel** — Game management, stat entry, scoring settings

## Scoring (defaults)

| Stat | Points |
|------|--------|
| Point | 1.0 |
| Rebound | 1.2 |
| Assist | 1.5 |
| Steal | 3.0 |
| Block | 3.0 |
| Turnover | -1.0 |

## Project Structure

```
tournament-fantasy/
├── package.json
├── server/
│   ├── index.js        # Express + Socket.io server
│   ├── db.js           # SQLite schema
│   ├── seed.js         # 2025 tournament teams/players
│   ├── middleware/auth.js
│   └── routes/
│       ├── auth.js
│       ├── leagues.js
│       ├── players.js
│       ├── draft.js
│       ├── scores.js
│       └── admin.js
└── client/
    └── src/
        ├── pages/      # React pages
        ├── components/ # Navbar, ProtectedRoute
        ├── contexts/   # AuthContext
        ├── api.js      # Axios instance
        └── socket.js   # Socket.io client
```
