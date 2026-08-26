# CampusMind — AI-Powered College Assistant

CampusMind is a full-stack, Retrieval-Augmented Generation (RAG) assistant designed for college students and staff. Students can ask natural language questions about admissions, courses, fees, exams, hostels, and campus facilities, receiving accurate, source-grounded answers powered by official college PDF documents.

---

## 🏛️ Architecture & Tech Stack

```
                               ┌─────────────────────────┐
                               │   Next.js 14 Frontend   │
                               │  (Dark Glassmorphism UI)│
                               └────────────┬────────────┘
                                            │ JWT / Bearer
                                            ▼
                               ┌─────────────────────────┐
                               │   Express.js Backend    │
                               │  (In-Memory PDF Parser) │
                               └───────┬─────────┬───────┘
                                       │         │
                   ┌───────────────────┘         └───────────────────┐
                   ▼                                                 ▼
     ┌───────────────────────────┐                     ┌───────────────────────────┐
     │         Supabase          │                     │    AI Provider (RAG)      │
     │  - Auth (JWT / Sessions)  │                     │  - OpenRouter / Groq      │
     │  - pgvector (Embeddings)  │                     │  - @xenova/transformers   │
     │  - Documents & History    │                     │    (all-MiniLM-L6-v2)     │
     └───────────────────────────┘                     └───────────────────────────┘
```

- **Frontend:** Next.js 14 (Pages Router), Tailwind CSS (Custom Dark Theme), Zustand, Axios, Google Inter typography
- **Backend:** Node.js, Express, Multer (in-memory buffer), pdf-parse, `@xenova/transformers` (local 384-dim embeddings)
- **Database & Auth:** Supabase (PostgreSQL with `pgvector` extension, Row-Level Security, Supabase Auth)
- **LLM Engine:** OpenRouter (`openrouter/auto`) with fallback support for Groq (`openai/gpt-oss-120b`)

---

## 📂 Project Organization

```
CampusMind/
│
├── client/                     # Next.js 14 Web Application
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # Reusable UI components (ChatWindow, MessageBubble, etc.)
│   │   ├── pages/              # App routes (/login, /register, /chat, /settings, /admin/documents)
│   │   ├── services/           # Supabase client & Axios API client
│   │   ├── store/              # Zustand stores (authStore, chatStore, documentStore)
│   │   └── styles/             # Global Tailwind & design system styles
│   ├── .env.local.example      # Example environment variables for client
│   ├── package.json
│   └── tailwind.config.js
│
├── server/                     # Express.js REST API & RAG Pipeline
│   ├── src/
│   │   ├── config/             # Environment, Supabase, and RAG configuration
│   │   ├── controllers/        # Route controllers (auth, chat, document)
│   │   ├── middleware/         # Auth JWT verification & role validation
│   │   ├── routes/             # API routes (/api/auth, /api/chat, /api/documents, /api/health)
│   │   ├── services/           # RAG pipeline, local embeddings, in-memory document ingestion
│   │   └── utils/              # RecursiveCharacterTextSplitter
│   ├── .env.local.example      # Example environment variables for server
│   ├── package.json
│   └── src/server.js           # Server entry point
│
├── migrations/                 # PostgreSQL & pgvector schema migrations for Supabase
│   ├── 01_profiles.sql
│   ├── 02_documents.sql
│   ├── 03_document_chunks.sql
│   ├── 04_conversations.sql
│   ├── 05_messages.sql
│   ├── 06_vector_indexes.sql
│   ├── 07_match_chunks_function.sql
│   └── 08_match_function_with_title.sql
│
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Supabase Account**: [supabase.com](https://supabase.com)
- **AI Key**: OpenRouter API Key ([openrouter.ai](https://openrouter.ai)) or Groq API Key ([console.groq.com](https://console.groq.com))

---

### 1. Database Setup (Supabase)

1. Create a new Supabase project.
2. In the Supabase Dashboard, open the **SQL Editor**.
3. Run the SQL migration scripts in [`migrations/`](file:///d:/CampusMind/migrations) in numerical order:
   - `01_profiles.sql`
   - `02_documents.sql`
   - `03_document_chunks.sql`
   - `04_conversations.sql`
   - `05_messages.sql`
   - `06_vector_indexes.sql`
   - `07_match_chunks_function.sql`
   - `08_match_function_with_title.sql`

---

### 2. Backend Setup

```bash
cd server
npm install
cp .env.local.example .env
```

Edit `server/.env`:
```env
PORT=5000
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# AI Provider Configuration
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/auto

# Optional fallback
GROQ_API_KEY=gsk_...
NODE_ENV=development
```

Start the backend server:
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

---

### 3. Frontend Setup

```bash
cd client
npm install
cp .env.local.example .env.local
```

Edit `client/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Start the frontend application:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Testing

To run the automated backend verification suite:
```bash
cd server
node src/test-integration.js
```

This verifies:
1. Environment variables & API credentials
2. Supabase database connectivity & tables
3. OpenRouter LLM completions
4. In-memory vector embedding generation (384-dim)
5. RAG context assembly & graceful fallback
6. Recursive character text chunking

To test the client build:
```bash
cd client
npm run build
```

---

## 🌐 Production Deployment Guide

### 1. Database (Supabase)
- Hosted automatically on Supabase cloud.
- Ensure all migration scripts up to `08_match_function_with_title.sql` have been executed in the SQL Editor.

### 2. Backend (Render / Railway)
1. Create a new **Web Service** pointing to your GitHub repository.
2. Set **Root Directory**: `server`
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `node src/server.js`
5. Configure Environment Variables in Render Dashboard:
   - `PORT`: `5000` (or leave default for Render)
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: `https://your-app.vercel.app`
   - `SUPABASE_URL`: `https://<ref>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your_service_role_key`
   - `AI_PROVIDER`: `openrouter`
   - `OPENROUTER_API_KEY`: `your_openrouter_key`
   - `OPENROUTER_MODEL`: `openrouter/auto`

### 3. Frontend (Vercel)
1. Import your GitHub repository on **Vercel**.
2. Set **Root Directory**: `client`
3. Framework Preset: **Next.js**
4. Configure Environment Variables in Vercel Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `your_anon_key`
   - `NEXT_PUBLIC_API_URL`: `https://your-backend.onrender.com`
5. Deploy!

---

## 🛡️ Security Features
- **Stateless & Ephemeral Processing:** Documents are processed in-memory via buffers; no local disk writes.
- **Row-Level Security:** Supabase tables are secured with user-level policies.
- **Role-Based Access Control:** Document uploading and management restricted to admin users (`requireAdmin` middleware).
- **Hardened HTTP Headers:** Helmet middleware and restricted CORS origin policies.
