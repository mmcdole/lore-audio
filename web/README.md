# Flix Audio Web Client

Modern Next.js interface for the Flix Audio audiobook platform. The application follows the domain principles documented in `plan.md` and the UX roadmap defined in `webplan.md`.

## Tech Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS with design tokens inspired by the platform's glassmorphism aesthetic
- Shadcn-style UI primitives (button, card, input) using `class-variance-authority`
- TanStack Query for API cache management
- Zustand for audio player state and persistence
- Next Themes for dark/light mode

## Getting Started

```bash
npm install
npm run dev
```

### Environment
Create a `.env.local` file when integrating with the backend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

**Note**: The backend runs on port 8080 by default. Make sure this matches your backend configuration.

## Project Structure
```
src/
  app/              # App Router routes grouped by domain (auth, dashboard, admin)
  components/       # Reusable UI primitives and layout components
  lib/              # API client, types, utilities, and constants
  providers/        # React context providers (query client, theme)
  state/            # Zustand stores (player state, persisted settings)
```

## Next Steps
- Implement authenticated API calls against the existing backend endpoints (`plan.md`)
- Flesh out admin flows (imports, metadata linking) following `webplan.md`
- Integrate the audio engine (Howler.js) and progress syncing once the player API is connected
