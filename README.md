# CampusMind

AI-powered college information assistant using RAG (Retrieval-Augmented Generation).

## Tech Stack

- **Frontend:** Next.js 14 (Pages Router), Tailwind CSS, Zustand, Axios
- **Backend:** Node.js + Express, Multer, pdf-parse, @xenova/transformers
- **Database/Vector Store/Auth:** Supabase (Postgres + pgvector + Auth)
- **LLM Provider:** Groq (llama-3.3-70b-versatile)

## Project Structure

```
client/          # Next.js frontend
server/          # Express backend
migrations/      # Supabase SQL migrations
```

## Development Setup

### Prerequisites
- Node.js 18+
- Supabase account and project
- Groq API key

### Frontend Setup

```bash
cd client
npm install
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

Frontend runs on `http://localhost:3000`.

### Backend Setup

```bash
cd server
npm install
cp .env.local.example .env.local
# Edit .env.local with Supabase and Groq credentials
npm run dev
```

Backend runs on `http://localhost:5000`.

### Database Setup

1. Create a Supabase project at https://supabase.com
2. Run all SQL files in `migrations/` folder in order via Supabase SQL editor
3. Enable pgvector extension: `create extension if not exists vector;`

## Development Phases

- **Phase 1:** Project scaffolding, auth wiring
- **Phase 2:** Admin document upload pipeline
- **Phase 3:** RAG chat endpoint
- **Phase 4:** Chat UI and history
- **Phase 5:** Security hardening and polish
- **Phase 6:** Deployment readiness

## Environment Variables

See `client/.env.local.example` and `server/.env.local.example` for required variables.

## Deployment

- Frontend: Vercel
- Backend: Render
- Database: Supabase (hosted)

See deployment docs after Phase 6.
