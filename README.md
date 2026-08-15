# Lunelle

Lunelle is a gentle, cycle-aware wellness companion. It's a React + Vite frontend backed by an Express API, with journal entries persisted in Supabase and AI reflections generated via Featherless AI.

## Project structure

- **Frontend** — React 19 + Vite, in `src/`
- **Backend** — Express API, in `server/`. Handles Journal persistence (Supabase) and AI Companion requests (Featherless AI).

The frontend and backend run as two separate local servers during development.

## Prerequisites

- Node.js and npm
- A Supabase project with a `journals` table
- A Featherless AI API key

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

`.env` is git-ignored — never commit real keys. It's read by the backend (via `dotenv`) and by Vite, which also exposes any `VITE_`-prefixed variable to the frontend.

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `PORT` | optional | backend | Port the Express server listens on. Defaults to `3001`. |
| `FEATHERLESS_API_KEY` | required | backend | API key for Featherless AI. Needed for AI Companion to respond. |
| `FEATHERLESS_MODEL` | required | backend | Model id, e.g. `Qwen/Qwen2.5-7B-Instruct`. |
| `SUPABASE_URL` | required | backend | Your Supabase project URL. |
| `SUPABASE_KEY` | required | backend | Your Supabase service/anon key. |
| `VITE_API_URL` | optional | frontend | Base URL the frontend uses to call the backend. Defaults to `http://localhost:3001` if unset. |

## 3. Run the backend

```bash
npm run server
```

Starts the Express API at **http://localhost:3001**. Check it's up with `GET http://localhost:3001/api/health`.

## 4. Run the frontend

In a separate terminal:

```bash
npm run dev
```

Starts the Vite dev server at **http://localhost:5173**.

> **The backend must be running** for Journal (creating, editing, deleting entries) and AI Companion to work — the frontend calls the API directly, and those features won't function without it.

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the frontend dev server (Vite) |
| `npm run server` | Start the backend API (Express) |
| `npm run build` | Build the frontend for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |
