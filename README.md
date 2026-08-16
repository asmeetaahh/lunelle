# Lunelle 🌙🌸

**Lunelle is a gentle, cycle-aware wellness companion designed to make period tracking feel more personal, supportive, and empowering.**

Instead of treating period tracking as just dates and numbers, Lunelle brings together **cycle tracking, insights, journaling, AI-powered emotional support, relaxation, music, and playful self-care** in one caring space.

Built for the **Global Hack Week**, Lunelle combines a polished, anime-inspired experience with a real full-stack architecture and persistent data.

🌸 **Live App:** https://lunelle.onrender.com

---

## 1. Why Lunelle?

Period tracking apps often focus heavily on predictions and statistics.

Lunelle takes a more human approach.

- Track your cycle without overwhelming dashboards.
- Understand your cycle through simple, meaningful insights.
- Record thoughts and feelings through journaling.
- Reflect on journal entries with an **AI Companion**.
- Take a moment to relax with calming music.
- Switch between two carefully designed visual experiences.
- Use small interactive experiences to make self-care feel less clinical and more enjoyable.

**Lunelle is designed around the idea that wellness is not just about tracking what happens to your body — it is also about understanding how you feel.**

---

## 2. Core Features

- **Cycle Tracking**
  - Record period dates.
  - Configure cycle length and period duration.
  - Track the current cycle day and cycle phase.
  - View upcoming and previous period information.

- **Interactive Calendar**
  - Visualize period days directly on the calendar.
  - Navigate through dates and cycles.
  - Quickly log period information.
  - Cycle information stays synchronized with the rest of the application.

- **Cycle Insights**
  - View important cycle information at a glance.
  - Current cycle day.
  - Average cycle length.
  - Next expected period.
  - Cycle-phase information.
  - Insights are connected to the user's actual cycle data.

- **AI Companion**
  - A supportive conversational experience for emotional check-ins.
  - Users can share how they are feeling and receive encouraging reflections.
  - AI responses include supportive suggestions rather than simply returning generic chatbot answers.
  - Built with a dedicated backend API and **Featherless AI**.
  - AI Companion can work alongside the user's journal experience.

- **Journal**
  - Create personal journal entries.
  - Record moods and symptoms.
  - Edit existing entries.
  - Delete entries.
  - Journal data is persisted through **Supabase**.
  - Journal information can be used as context for the broader wellness experience.

- **Relax & Breathe**
  - A dedicated space for slowing down and taking a break.
  - Designed as a simple self-care experience within Lunelle.

- **Music**
  - Includes **two built-in calming music tracks**.
  - Designed to complement the relaxation experience.

- **Memory Match**
  - A lightweight interactive mini-game.
  - Adds a playful element to the wellness experience.

- **Profile & Preferences**
  - Personalize application preferences.
  - Manage cycle-related settings.
  - Configure experience preferences.

- **Blossom & Moonlight Themes**
  - **Lunelle Blossom** — a soft, bright, floral-inspired experience.
  - **Lunelle Moonlight** — a darker, dreamy moonlit experience.
  - The two themes provide distinct visual identities while sharing the same core functionality.

---

## 3. Design Philosophy

Lunelle was intentionally designed to feel different from a traditional health dashboard.

- **Soft anime-inspired visual language**
- **Warm, approachable interactions**
- **Blossom and Moonlight visual identities**
- **Cute bunny mascot**
- **Gentle micro-interactions**
- **Calm colors and rounded UI elements**
- **Wellness-focused language instead of clinical terminology**

The goal is to make opening Lunelle feel less like checking a medical tracker and more like entering a **small personal wellness space**.

---

## 4. Technical Architecture

Lunelle follows a **full-stack client → API → service/data architecture**.

### Frontend

**React 19 + Vite**

The frontend is responsible for:

- UI rendering
- Navigation
- Theme management
- Cycle calculations
- Calendar interactions
- Insights
- Journal interface
- AI Companion interface
- Relaxation experience
- Music
- Memory Match
- Profile preferences

Main frontend code lives inside:

`src/`

Important areas include:

- `src/pages/` — application pages
- `src/lib/` — application logic and API clients
- `src/theme/` — theme management
- `src/assets/` — visual assets

### Backend

**Node.js + Express**

The backend provides a dedicated API layer between the frontend and external services.

Main backend code lives inside:

`server/`

The backend handles:

- Health checks
- Journal CRUD operations
- Supabase communication
- AI Companion requests
- Featherless AI communication
- API-level validation and response handling

### Database

**Supabase**

Supabase provides persistent storage for journal entries.

The backend communicates with Supabase through:

`server/db/supabase.js`

Journal persistence is handled through:

`server/db/journalStore.js`

This keeps database access separated from the frontend.

### AI Layer

**Featherless AI**

AI Companion requests follow this architecture:

**React UI → Express API → AI Service → Featherless AI → Express Response → React UI**

The AI integration is isolated inside the backend so that sensitive API credentials are **never exposed directly to the browser**.

AI-related backend logic lives inside:

`server/services/ai.js`

and

`server/routes/ai.js`

### Journal Data Flow

Journal interactions follow:

**Journal UI → Journal API Client → Express Route → Journal Store → Supabase**

This allows the frontend to remain independent from the database implementation.

---

## 5. High-Level Architecture

```text
                    ┌──────────────────────┐
                    │      Lunelle UI      │
                    │   React + Vite       │
                    └──────────┬───────────┘
                               │
                     HTTP / REST API
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Express Server    │
                    │      Node.js         │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
        ┌─────────────────┐        ┌─────────────────┐
        │    Supabase     │        │  Featherless AI │
        │ Journal Storage │        │  AI Companion   │
        └─────────────────┘        └─────────────────┘
