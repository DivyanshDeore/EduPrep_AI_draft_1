# EduPrep AI – Smart Academic Assistant

EduPrep AI is a full-stack academic planning and study assistant that unifies weekly class schedules, course syllabi, topic progression, structured study notes, summaries, grounded web learning resources, and automated pre-lecture briefings (**Lecture Pre-Caps**).

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, React Router, Lucide Icons, Light / Dark / System theme support.
- **Backend API Gateway**: Express (`server.ts`) on port `3000` handling secure file parsing (`unpdf`, `mammoth`, UTF-8 text) and server-side Google Gemini SDK calls (`@google/genai`).
- **Database & Authentication**: Firebase Authentication (Google Sign-In) and Cloud Firestore with owner-scoped security rules (`firestore.rules`) across 11 collections (`students`, `notificationPreferences`, `subjects`, `topics`, `syllabi`, `timetableEntries`, `notifications`, `precaps`, `notes`, `summaries`, `resources`).
- **AI Engine**: Server-side `@google/genai` integration with configurable model selection (`GEMINI_MODEL`), structured JSON schemas, bounded retry handling, and Google Search Grounding for verified learning resource URLs.

## Core Modules

1. **Authentication & Student Profile**: Google Sign-In, isolated student profile records, preferred Gemini model selection, daily study goal, and Light/Dark/System workspace themes.
2. **Student Dashboard**: Live overview of today's classes, countdown to the next upcoming lecture, upcoming Lecture Pre-Cap, recent notes & summaries, saved resources, and academic progress metrics derived from database records.
3. **Academic Timetable**: Weekly 7-day grid and daily list views with automatic validation for missing fields, reversed time ranges, and same-day overlapping class sessions.
4. **Smart Class Notifications**: Configurable lead times (`5–180` minutes), active in-app scheduler, read/unread history, and optional browser `Notification` API alerts (with transparent browser limitations when the tab is closed).
5. **Syllabus Ingestion**: Upload `.pdf`, `.docx`, or `.txt` files (up to 10 MB, verified via magic bytes) or paste raw syllabus text. Extracts ordered topics and course metadata into an interactive review editor before saving.
6. **Subjects & Topics Management**: Manage courses, reorder syllabus topics, track `pending` / `in_progress` / `completed` status, and deep-link directly into notes and resource search.
7. **AI Study Notes & Summaries**: Generate 7-section structured study notes (Introduction, Important Concepts, Detailed Explanations, Key Definitions, Worked Examples, Important Points, Conclusion) and concise/balanced/exam summaries with Markdown export. All AI outputs are clearly labeled as AI-assisted.
8. **Learning Resources Hub**: Uses Gemini Google Search Grounding to retrieve verified educational URLs (YouTube, documentation, tutorials, open courses) plus verified direct search links without fabricating URLs.
9. **Lecture Pre-Caps**: Automatically maps your next upcoming timetable class to the next incomplete syllabus topic, prevents duplicate pre-caps by default, and builds a pre-class briefing with prerequisites, definitions, and guiding questions.

## Gemini API Key Setup (Required for AI Features)

All non-AI features (Authentication, Timetable, Notifications, Manual Subjects/Topics, and manual Notes/Resources browsing) work immediately without an API key.

To enable live AI generation and Google Search Grounding:

1. Generate a Gemini API key at **https://aistudio.google.com/apikey**.
2. Configure `GEMINI_API_KEY` in the secure backend environment or **Settings > Secrets** panel (never paste private keys into frontend source files, client environment variables, or public commits).
3. Optionally configure `GEMINI_MODEL` (supported values: `gemini-4-hydrogen` or `gemini-3.1-flash-lite`).

See `.env.example` for the expected backend environment variables.

## Local Development & Scripts

```bash
# Install dependencies
npm install

# Run full-stack development server (Express + Vite on port 3000)
npm run dev

# Run TypeScript type check
npm run lint

# Run automated unit and component tests
npm test

# Build production frontend bundle
npm run build

# Start production server
npm start
```

## API Reference

An importable Postman collection is available at `docs/EduPrep_AI.postman_collection.json`.

- `GET /api/health` — Server health and AI readiness flag
- `GET /api/ai/status` — Configured status and supported Gemini model aliases (never exposes secrets)
- `POST /api/syllabus/parse` — Multipart file upload (`.pdf`, `.docx`, `.txt`) or raw text syllabus extraction
- `POST /api/ai/notes` — Generates 7-section structured study notes
- `POST /api/ai/summary` — Generates concise, balanced, or exam-focused study summaries
- `POST /api/ai/precap` — Generates a Lecture Pre-Cap with optional grounded resources
- `POST /api/ai/resources` — Searches grounded web resources and returns verified direct search links

## Security & Production Notes

- **API Key Isolation**: `GEMINI_API_KEY` is read exclusively inside `server/geminiService.ts` and is never returned in API responses or bundled into frontend assets.
- **Upload Validation**: `server/syllabusParser.ts` enforces a 10 MB limit, filename sanitization, PDF (`%PDF-`) and DOCX (`PK\x03\x04`) magic-byte checks, and binary null-byte rejection on `.txt` uploads without executing uploaded content.
- **Data Isolation**: `firestore.rules` enforces verified ownership (`request.auth.uid == studentId`), schema validation, immutable audit timestamps, and cross-collection ownership checks.
- **HTTPS & CORS**: Deploy behind TLS/HTTPS in production and configure `VITE_API_BASE_URL` or reverse-proxy `/api/*` on the same origin so credentials and bearer tokens travel strictly over HTTPS.
