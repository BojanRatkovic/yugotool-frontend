# zastava-frontend

The UI of **ZASTAVA**, a local software factory: a board of work orders moving
down an assembly line of Claude Code agents, a canvas editor for the line, and a
live run panel with activity, diffs, QA screenshots and gate approvals.

React 19 · Vite · TypeScript · TanStack Router / Query / DB / Form · React Flow ·
dnd-kit · shadcn/ui · Tailwind v4.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:4800 — proxies /api → the API on :4810 (zastava-backend)
```

In production the API serves `dist/` itself (`pnpm build`), from the supervisor
or the desktop app in `zastava-backend`. Inside the desktop app the page also
gets `window.zastavaDesktop` (native folder picker); in a browser it is absent.

## Map

| Concern                                                                    | Where                                          |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| Routes (`/`, `/settings`, `/projects/$projectId?view=board\|line&wo=<id>`) | `src/app/routes`                               |
| Projects, line canvas, preview + routes settings, offer-QA                 | `src/features/projects`                        |
| Work orders: board, panel, queue actions                                   | `src/features/work-orders`                     |
| Runs: stepper, activity, diff, QA review, gates                            | `src/features/runs`                            |
| Settings, Doctor, plan usage, dispatcher                                   | `src/features/settings`, `src/features/system` |
| HTTP client + error shape                                                  | `src/lib/api-client.ts`                        |
| SSE → cache invalidation                                                   | `src/lib/realtime.ts`                          |
| Offline cache (Query → IndexedDB)                                          | `src/lib/persister.ts`, `src/app/provider.tsx` |
| API contract mirror                                                        | `src/lib/contracts.ts`                         |

Design rules: `zastava-work/knowledge/design-system.md`. Conventions: [`CLAUDE.md`](CLAUDE.md).

## Quality gate

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```
