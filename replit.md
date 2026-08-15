# Map App DE

A VET curriculum mapping tool for Australian RTOs. Enter a unit of competency code (e.g. BSBMGT517) or upload a PDF — the app fetches and parses the unit from training.gov.au and presents every element and performance criterion in a structured table. Recent lookups are saved in a history sidebar.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/map-app-de run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, TanStack Query, Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (`lib/db/src/schema/unitHistory.ts`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from `lib/api-spec/openapi.yaml`)
- Scraping: Cheerio (fetches `training.gov.au/Training/Details/{code}`)
- PDF parsing: pdf-parse v1 (CJS via `createRequire`)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for the API contract
- `lib/db/src/schema/unitHistory.ts` — DB schema for lookup history
- `artifacts/api-server/src/routes/units.ts` — all /units/* route handlers
- `artifacts/api-server/src/lib/scraper.ts` — training.gov.au HTML scraper (Cheerio)
- `artifacts/api-server/src/lib/pdfParser.ts` — PDF text extraction and element/PC parsing
- `artifacts/map-app-de/src/` — React frontend

## Architecture decisions

- **Contract-first OpenAPI**: spec in `lib/api-spec/openapi.yaml` gates codegen; frontend and backend both consume generated types.
- **pdf-parse v1 (CJS)**: v2 switched to named ESM exports and broke esbuild's default import resolution; pinned to v1 with `createRequire` for compatibility.
- **`type: number` for IDs in spec**: `type: integer` causes Orval to emit `zod.int()` which is Zod v4 API not available on the v3 default export; using `number` avoids this.
- **Multipart upload outside Orval**: the `/units/upload` endpoint uses multer directly; the OpenAPI schema does not include `format: binary` (which generates `File`/`Blob` types incompatible with the Node.js tsconfig).
- **Lookup history in PostgreSQL**: simple `unit_history` table, 50-row cap on reads, cleared via DELETE endpoint.

## Product

- Enter a unit code → app fetches and scrapes training.gov.au → displays elements + PCs in a table
- Upload a PDF of a unit → app parses text → displays elements + PCs
- History sidebar shows the last 50 lookups (deletable individually or all at once)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- training.gov.au may update its HTML structure; if scraping breaks, update CSS selectors in `artifacts/api-server/src/lib/scraper.ts`
- Do NOT use `type: integer` in OpenAPI spec (generates `zod.int()` which fails typecheck); use `type: number` instead
- Do NOT use `format: binary` in OpenAPI spec (generates `File`/`Blob` which aren't in Node tsconfig); handle file uploads with multer outside the spec's body validation

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
