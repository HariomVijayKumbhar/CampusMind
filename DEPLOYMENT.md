# CampusMind Deployment Guide (Vercel + Render)

Architecture: **Next.js frontend → Vercel**, **Express API → Render**, **Supabase** (DB + auth + pgvector) stays hosted as-is.

---

## 1. Backend on Render

1. Push this repo to GitHub.
2. Render Dashboard → **New → Blueprint** → select the repo. Render reads `render.yaml` at the repo root and creates the `campusmind-api` web service (root directory: `server`).
3. Fill in the env vars marked `sync: false`:
   - `FRONTEND_URL` = your Vercel URL (step 2), e.g. `https://campusmind.vercel.app` (comma-separate multiple URLs for previews)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (secret — never expose to frontend)
   - `GROQ_API_KEY`
   - `GROQ_MODEL` (optional)
4. Deploy. Health check is `GET /api/health` → verify it returns `{"status":"ok"}`.
5. Copy the service URL, e.g. `https://campusmind-api.onrender.com`.

## 2. Frontend on Vercel

1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory**: `client` (the Next.js app lives in a subfolder).
3. Framework preset: Next.js (auto-detected; config in `client/vercel.json`).
4. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_API_URL` = `https://campusmind-api.onrender.com` (backend URL from step 1.5, no trailing slash)
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase **anon** key (public — safe for frontend)
5. Deploy.

## 3. After first deploy

- Update `FRONTEND_URL` on Render with the actual Vercel domain (CORS whitelist lives in `server/src/server.js`).
- Redeploy Render so the new value takes effect.
- Note: Render free tier spins down after ~15 min idle — first request after sleep takes ~30s (cold start). Use a cron ping or upgrade if that's an issue.

## 4. Environment variables summary

| Variable                        | Where             | Value                              |
| ------------------------------- | ----------------- | ---------------------------------- |
| `FRONTEND_URL`                  | Render            | Vercel domain(s), comma-separated  |
| `SUPABASE_URL`                  | Render            | Supabase project URL               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Render            | Supabase service-role key (SECRET) |
| `GROQ_API_KEY`                  | Render            | Groq API key                       |
| `GROQ_MODEL`                    | Render (optional) | defaults to `qwen/qwen3.8-27b`     |
| `NEXT_PUBLIC_API_URL`           | Vercel            | Render backend URL                 |
| `NEXT_PUBLIC_SUPABASE_URL`      | Vercel            | Supabase project URL               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel            | Supabase anon key                  |

Local templates: `server/.env.local.example`, `client/.env.local.example`.

## 5. Database

Run the SQL migrations in `migrations/` (in filename order) against your Supabase project (SQL Editor) once — they apply to all environments.
