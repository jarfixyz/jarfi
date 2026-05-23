# jarfi web

Next.js 15 app deployed to Cloudflare Workers via `@opennextjs/cloudflare`.
Plan 2 ships the backend: D1 schema, indexer cron, and four API routes.
Frontend pages land in Plans 3 and 4.

## Local development

Install and run the dev server:

    pnpm install
    pnpm -F web dev

Copy secrets for local runs:

    cp apps/web/.dev.vars.example apps/web/.dev.vars
    # edit .dev.vars

Run tests:

    pnpm -F web test

## Worker preview

Run the Cloudflare build locally:

    pnpm -F web cf:dev

## Deploy

    pnpm -F web cf:deploy

First-time deploys must run the bootstrap in `docs/cloudflare-bootstrap.md`.

## API routes

- `GET  /api/cron/index` — cron-only, requires `Authorization: Bearer CRON_SECRET`
- `POST /api/shortlink` — `{ jarPda, signature }` → `{ shortId }`, 10/min/IP
- `GET  /api/jars/:shortId` — cached jar payload from D1 + KV
- `PUT  /api/metadata/upload` — multipart `{ jarPda, wallet, signature, nonce, metadata, cover? }`

## Indexer

`lib/indexer.ts::runIndexerOnce` polls `getSignaturesForAddress` for
`PROGRAM_ID` since the last processed signature, decodes Anchor events via
`@jarfi/sdk::parseLogs`, and writes deduped rows into `events`, `jars_cache`,
and `contributions_cache`. Cron fires every 60 seconds.

## D1 migrations

    pnpm -F web db:migrate:local
    pnpm -F web db:migrate:remote

## Design system

Tokens live in `app/globals.css` as Tailwind v4 `@theme` variables. The honey
accent (`--color-honey`), warm stone neutrals, and Geist typography are the
core language. Dark mode follows `prefers-color-scheme` with separate token
values (it is not an inversion).

Primitives under `components/ui/*`:
- `button.tsx` — primary / secondary / ghost
- `input.tsx` — bottom-border with label, hint, error
- `card.tsx` — bordered container, no shadow
- `badge.tsx` — neutral / honey / success / warning tones
- `progress.tsx` — `ProgressBar` + `ProgressRing`
- `jar-cover.tsx` — deterministic duotone fallback or uploaded image
- `icon.tsx` — curated Phosphor set

Chrome under `components/chrome/*`: `site-header`, `site-footer`,
`experimental-banner`.

Landing sections under `components/landing/*` compose into `app/(site)/page.tsx`.

Visit `/design` for a live preview of every primitive.

## App flows

- `/` — landing (Plan 3)
- `/create` — jar creation form and tx sequence: build metadata → sign
  `jarfi-upload:${pda}:${nonce}` → upload to R2 → `create_jar` → shortlink →
  redirect to `/j/:shortId`
- `/j/[shortId]` — public jar view, SSR + OG image, contribute modal (wallet
  path / Solana Pay QR / raw address), recent contributors, owner controls
- `/jar/[pda]` — archival fallback when KV / shortlink is unavailable; fetches
  the jar directly by PDA
- `/dashboard` — wallet-gated owner jar list (live via `fetchJarsByOwner`)

Wallet integration uses `@solana/wallet-adapter-react` with Phantom and
Solflare. The `useJarfiClient()` hook threads the connected `AnchorWallet`
into `JarfiClient` for all chain writes. Client-side errors pass through
`lib/errors.ts::classifyError` and surface via `sonner` toasts plus inline
form messages. Rejected signatures are silent (no toast).

Signature shake: successful contributes trigger a short physical shake on the
jar cover via `lib/design/use-shake.ts` and the `.animate-shake` keyframe in
`app/globals.css`. Respects `prefers-reduced-motion`.

Owner flows (gated on `jar.owner === publicKey`):
- Withdraw: partial or all for flexible, all-only for time-locked
- Cancel: time-locked only; unlocks the donor refund banner
- Edit metadata: reuploads to R2 and calls `update_metadata`
- Refund all donors: fans out sequential refund txs with a progress bar when
  the jar is cancelled

## Component tests

Component tests run under jsdom via Vitest + Testing Library. Pure helpers
(e.g. `lib/design/jar-cover.ts`) are tested in a node environment. Mix:

    pnpm -F web test
