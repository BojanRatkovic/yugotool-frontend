# zastava-frontend

React 19 + Vite SPA for ZASTAVA, the software factory. TypeScript strict,
bulletproof-react feature structure, TanStack Router (file-based) + Query +
DB + Form, React Flow (xyflow) line canvas, dnd-kit board, shadcn/ui +
Tailwind v4, sonner, lucide.

## Before coding

Conventions follow stagemill-frontend — load the skills (read "stagemill" as "zastava"):

- `Skill(stagemill-repos:frontend)` — structure, import boundaries, naming, shadcn, state buckets, React Flow rules
- `Skill(stagemill-repos:tanstack)` — queryOptions factories, mutations, error handling, routes, typed search params

Specs live in the sibling `zastava-work` repo (`specs/0001-mvp.md`). The API
contract is `zastava-backend/packages/contracts`; `src/lib/contracts.ts` mirrors it.

## Commands

```bash
pnpm install
pnpm dev          # Vite on :4800, proxies /api -> zastava-api on :4810 (prefix stripped)
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build   # quality gate — run before every commit
pnpm format       # oxfmt write
```

## Rules that override defaults

- kebab-case files/folders; absolute `@/` imports; no barrel files; `routeTree.gen.ts` is generated — never edit.
- Features (`projects`, `work-orders`, `runs`, `pull-requests`, …) never import each other — compose them in `src/app/routes`.
- Server data lives in TanStack DB collections (`features/*/api/*-collection.ts`) or Query (`*-queries.ts`) — never copied into useState.
- Query keys live in `src/lib/query-keys.ts` so `src/lib/realtime.ts` (SSE) can invalidate without importing features.
- Creates use a client-generated `crypto.randomUUID()` id (idempotent, offline-safe).
- `src/lib/contracts.ts` is a copy of `@zastava/contracts` — change the backend first, then mirror it.
- shadcn primitives only via `pnpm dlx shadcn@latest add <name>`; never hand-edit `src/components/ui`.
- Conventional Commits, English, lowercase imperative subject.
