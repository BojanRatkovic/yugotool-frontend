# yugotool-frontend

React 19 + Vite SPA for YugoTool, the software factory. TypeScript strict,
bulletproof-react feature structure, TanStack Router (file-based) + Query +
DB + Form, React Flow (xyflow) line canvas, dnd-kit board, shadcn/ui +
Tailwind v4, sonner, lucide.

## Before coding

Conventions follow stagemill-frontend — load the skills (read "stagemill" as "yugotool"):

- `Skill(stagemill-repos:frontend)` — structure, import boundaries, naming, shadcn, state buckets, React Flow rules
- `Skill(stagemill-repos:tanstack)` — queryOptions factories, mutations, error handling, routes, typed search params

Specs live in the sibling `yugotool-work` repo (`specs/0001-mvp.md`). The API
contract is `yugotool-backend/packages/contracts`; `src/lib/contracts.ts` mirrors it.

## Commands

```bash
pnpm install
pnpm dev          # Vite on :4800, proxies /api -> yugotool-api on :4810 (prefix stripped)
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm fallow:audit   # quality gate — run before every commit
pnpm format       # oxfmt write
pnpm fallow       # full fallow report (dead code, dupes, health, boundaries)
```

`pnpm fallow:audit` gates only what the change introduces. `.fallowrc.json` enforces
the bulletproof boundaries below (features never import each other) and ignores
generated code (`src/components/ui`, `src/lib/contracts.ts`, `routeTree.gen.ts`).

## Rules that override defaults

- kebab-case files/folders; absolute `@/` imports; no barrel files; `routeTree.gen.ts` is generated — never edit.
- Features (`projects`, `work-orders`, `runs`, `pull-requests`, …) never import each other — compose them in `src/app/routes`.
- Server data lives in TanStack DB collections (`features/*/api/*-collection.ts`) or Query (`*-queries.ts`) — never copied into useState.
- Query keys live in `src/lib/query-keys.ts` so `src/lib/realtime.ts` (SSE) can invalidate without importing features.
- Creates use a client-generated `crypto.randomUUID()` id (idempotent, offline-safe).
- `src/lib/contracts.ts` is a copy of `@yugotool/contracts` — change the backend first, then mirror it.
- shadcn primitives only via `pnpm dlx shadcn@latest add <name>`; never hand-edit `src/components/ui`.
- Conventional Commits, English, lowercase imperative subject.
