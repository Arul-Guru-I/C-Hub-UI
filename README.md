# CHub — React Frontend

The student-facing web application for **CHub**, a cohort-based learning platform. Connects to the [CHub backend](https://github.com/Arul-Guru-I/C-Hub) via REST API.

## Tech Stack

| Layer | Library / Tool |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Routing | React Router v7 |
| HTTP | Axios |
| Animations | Framer Motion |
| Charts | Recharts |
| Markdown | react-markdown + remark-gfm |
| Auth | JWT (jwt-decode) |

## Features

### For Students
- **Home** — personal performance dashboard with score trend charts
- **Learning Path** — adaptive 3-round MCQ assessment; LLM-generated personalised curriculum
- **Tasks** — GitHub PR tracking and review status
- **Tests** — topic-based MCQ tests with instant results
- **Reviews** — combined view of AI code review feedback and performance scores
- **Forum** — cohort-scoped discussion board with nested replies
- **Doubts** — RAG-powered Q&A against course material
- **Attendance** — QR code check-in with session history

### For Trainers
- **Cohorts Analytics** — per-cohort overview: student count, avg score, attendance, forum activity
- **Users** — full user list with cohort filtering
- **Trainer Curriculum** — manage and publish learning path content per cohort

## Project Structure

```
src/
├── components/
│   ├── auth/           # ProtectedRoute
│   ├── charts/         # Recharts wrappers
│   ├── layout/         # Sidebar, Topbar, Layout
│   └── ui/             # Icons, CodeBackground
├── contexts/
│   └── AuthContext.tsx # JWT auth state, login/logout
├── pages/              # One file per route
├── services/
│   └── api.ts          # Typed Axios API client
├── styles/
│   └── index.css       # Global design tokens (CSS variables)
└── types/
    └── index.ts        # Shared TypeScript types
```

## Getting Started

### Prerequisites
- Node.js 18+
- CHub backend running on `http://localhost:8000`

### Install & Run

```bash
npm install
npm run dev
```

App starts at `http://localhost:5173`.

### Environment

No `.env` file needed for local dev — the API base URL defaults to `http://localhost:8000` in [src/services/api.ts](src/services/api.ts). Update it there if your backend runs on a different port or host.

### Build for Production

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

## Authentication Flow

1. User logs in via `POST /auth/token` (OAuth2 password grant)
2. JWT stored in `localStorage`
3. `AuthContext` calls `GET /users/me` on load to hydrate user profile
4. `ProtectedRoute` redirects to `/login` if no valid token
5. Role (`trainer` | student) gates sidebar items and page-level access checks

## Role-Based Access

| Route | Student | Trainer |
|---|---|---|
| `/` Home | own data | — |
| `/learning-path` | own path | curriculum editor |
| `/reviews` | own reviews | all students |
| `/cohorts` | — | all cohorts |
| `/users` | — | all users |
| All others | own cohort | all cohorts |
