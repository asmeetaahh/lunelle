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
```

## 6. Project Structure

    lunelle/
    │
    ├── public/
    │   ├── audio/
    │   │   ├── relax-track-1.mp3
    │   │   └── relax-track-2.mp3
    │   ├── _redirects
    │   └── favicon.svg
    │
    ├── server/
    │   ├── db/
    │   │   ├── journalStore.js
    │   │   ├── supabase.js
    │   │   └── testSupabase.js
    │   │
    │   ├── routes/
    │   │   ├── ai.js
    │   │   ├── health.js
    │   │   └── journal.js
    │   │
    │   ├── services/
    │   │   └── ai.js
    │   │
    │   └── server.js
    │
    ├── src/
    │   ├── assets/
    │   ├── lib/
    │   ├── pages/
    │   ├── theme/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── index.css
    │   └── main.jsx
    │
    ├── .env.example
    ├── API.md
    ├── package.json
    └── vite.config.js


## 7. Technology Stack

- **Frontend:** React 19
- **Build Tool:** Vite
- **Styling:** CSS
- **Backend:** Node.js + Express
- **Database:** Supabase
- **AI:** Featherless AI
- **AI Model:** Qwen/Qwen2.5-7B-Instruct
- **API Communication:** REST
- **Deployment:** Render
- **Version Control:** Git + GitHub


## 8. API Layer

The backend exposes dedicated endpoints for the application's dynamic features.

### Health

    GET /api/health

Used to verify that the deployed backend is running correctly.

### Journal

    GET    /api/journal
    GET    /api/journal/:id
    POST   /api/journal
    PUT    /api/journal/:id
    DELETE /api/journal/:id

These endpoints handle journal retrieval, creation, editing, and deletion.

### AI Companion

    POST /api/ai/chat

This endpoint receives the user's message and relevant context, then requests an AI-generated reflection through Featherless AI.


## 9. Environment Variables

Create a local `.env` file based on `.env.example`.

    PORT=3001

    FEATHERLESS_API_KEY=your_api_key
    FEATHERLESS_MODEL=Qwen/Qwen2.5-7B-Instruct

    SUPABASE_URL=your_supabase_url
    SUPABASE_KEY=your_supabase_key

    VITE_API_URL=http://localhost:3001

**Never commit real API keys or secrets to GitHub.**

Production environment variables are configured separately on the hosting platform.


## 10. Running Lunelle Locally

### Install dependencies

    npm install

### Start the backend

    npm run server

The Express API runs on:

    http://localhost:3001

The backend health endpoint is available at:

    http://localhost:3001/api/health

### Start the frontend

In another terminal:

    npm run dev

The Vite development server runs on:

    http://localhost:5173

### Build for production

    npm run build

### Preview the production build

    npm run preview

### Run linting

    npm run lint


## 11. Production Deployment

Lunelle is deployed using **Render** as two separate services.

### Frontend

**Render Static Site**

https://lunelle.onrender.com

### Backend

**Render Web Service**

https://lunelle-api-07hh.onrender.com

The production frontend communicates with the deployed backend through:

    VITE_API_URL=https://lunelle-api-07hh.onrender.com

A SPA fallback is included through:

    public/_redirects

This allows client-side routes such as Calendar, Journal, Insights, and AI Companion to work correctly when users refresh or directly open a route.


## 12. What Makes Lunelle Different?

Lunelle is more than a period calendar.

It brings several parts of everyday wellness together in one connected experience:

**Track → Understand → Reflect → Relax → Care**

- **Track** your cycle.
- **Understand** patterns through cycle insights.
- **Reflect** through journaling.
- **Talk** through the AI Companion.
- **Relax** with calming experiences and music.
- **Play** through Memory Match.
- **Personalize** the experience through themes and preferences.

This creates a more holistic experience where **cycle awareness and emotional well-being exist together**.

Instead of separating physical tracking from emotional wellness, Lunelle connects the two into one experience.


## 13. Built With Empathy

Lunelle was designed around a simple principle:

**Technology should feel supportive, not overwhelming.**

From the bunny mascot and anime-inspired visual language to the AI Companion, journal, music, relaxation features, and calming themes, the product was designed to make wellness feel approachable.

Lunelle aims to turn a routine tracking task into a **gentle, personalized self-care experience**.


## 14. Future Possibilities

Lunelle's architecture provides room for future improvements such as:

- More personalized cycle insights
- Richer AI-powered journal reflections
- Deeper journal-to-insight connections
- Expanded wellness recommendations
- Additional relaxation experiences
- More interactive mini-games
- Enhanced personalization
- More advanced cycle analytics
- Progressive Web App support
- Expanded accessibility features

The goal is to continue making Lunelle more personalized while keeping the experience simple, calming, and user-centered.


## 15. Project Status

**Lunelle is currently deployed and functional.**

The production application includes:

- Cycle tracking
- Interactive calendar
- Cycle insights
- Journal persistence
- AI Companion
- Relax & Breathe
- Two built-in music tracks
- Memory Match
- Profile preferences
- Blossom theme
- Moonlight theme
- Production frontend deployment
- Production backend deployment

🌸 **Live App:** https://lunelle.onrender.com
