# Canvas Social (MVP)

Realtime collaborative canvas (Figma-lite) built with **React + Vite + TypeScript**, **TailwindCSS v4.1 (Vite plugin)**, **Konva** for the canvas engine, and **Appwrite 1.8 RC2** as the full backend.

## 1) Requirements

- Node 18+
- pnpm (recommended)
- Appwrite 1.8 RC2 self-hosted or cloud

## 2) Install

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## 3) Tailwind v4.1 setup (already configured)

- Uses `@tailwindcss/vite` plugin in `vite.config.ts`
- Uses `@import "tailwindcss";` in `src/app.css`
- Dark mode is manual via:
  - `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`
  - Toggle sets `document.documentElement.dataset.theme`

## 4) Appwrite

Create a project and configure database/collections/buckets as in `DB_CANVAS_APPWRITE.md`.

Then set:

- `VITE_APPWRITE_ENDPOINT`
- `VITE_APPWRITE_PROJECT_ID`

## 5) Realtime collaboration strategy (MVP)

- The canvas base state is stored in `canvases.canvas_json` (JSON string)
- Each user action emits a small **op** document to `canvas_ops`:
  - add / update / delete / reorder / meta
- Clients subscribe to realtime changes on `canvas_ops` and apply ops in memory
- The full `canvas_json` is **auto-persisted** every ~1.5s to keep state recoverable

This is not CRDT yet, but it’s a good stepping-stone:
- add presence & cursors
- add soft-lock per object
- add version history

## 6) Notes

- For production, you should:
  - add permission checks in Appwrite Functions for invites and membership enforcement
  - move invitations acceptance to a function to guarantee atomicity
  - add snapshot generation and optimize ops retention (cleanup old ops)

