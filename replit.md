# RadDictate - AI Radiology Dictation Tool

## Overview
A professional web-based AI radiology dictation tool for MSK (Musculoskeletal) radiology. Records audio, transcribes using Groq Whisper, and maps findings into structured templates using GPT-4o.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI (dark radiology theme)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM)
- **AI Pipeline**: Groq Whisper (transcription) + OpenAI GPT-4o (structured mapping via AI Integrations)

## Key Features
- Admin Center: Template + AI prompt management
- Audio recording with three-phase AI pipeline
- Auto-generated impressions
- Editable reports with copy-to-clipboard

## Project Structure
- `shared/schema.ts` - Drizzle schema (templates, prompts, dictations)
- `server/ai-pipeline.ts` - Groq + OpenAI AI processing
- `server/routes.ts` - API routes with Zod validation
- `server/seed.ts` - Seed data (4 MSK templates, 3 AI prompts)
- `client/src/pages/dictation.tsx` - Main dictation recording + report view
- `client/src/pages/admin.tsx` - Template + prompt management

## Environment
- `GROQ_API_KEY` - For Whisper transcription
- `AI_INTEGRATIONS_OPENAI_*` - For GPT-4o (managed by Replit)
- `DATABASE_URL` - PostgreSQL

## Design
- Always-dark radiology theme with medical blue (#2563EB) accents
- Inter font for UI, JetBrains Mono for code/reports
- Two-panel layout via Shadcn sidebar
