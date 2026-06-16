# AGENTS.md

A [DaloyJS](https://daloyjs.dev) REST API deployed to **Vercel** on the **Node.js runtime** (Vercel's recommended runtime for standalone functions, running on Fluid Compute). **Contract-first**: routes are defined with Zod schemas and OpenAPI 3.1 is generated from them. When `docs: true` is set in `new App({...})`, three routes are auto-mounted: `GET /openapi.json`, `GET /openapi.yaml`, and `GET /docs` (Scalar UI).

- Package manager: npm.
- Runtime: Vercel Node.js Functions on Fluid Compute (Web Standard `Request`/`Response`).

## Commands

- `npm run dev` — local Vercel dev server on http://localhost:3000
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — run test suite
- `npm run deploy` — deploy to Vercel
- `npm audit` — supply-chain audit

## Project shape

- `api/index.ts` — Vercel Node.js Functions entrypoint. Builds the `App`, registers routes/middleware, and exports `default toFetchHandler(app)` from `@daloyjs/core/vercel` (Node.js Functions expect a default export with a `fetch` method; Node.js is the default runtime, so no `runtime` export is needed). Vercel maps this file to `/api`, so `vercel.json` adds a `/(.*) → /api` rewrite that sends every path to it and lets **DaloyJS own routing at the site root** — without it the root domain returns a Vercel 404. If you specifically need the Edge runtime, add `export const runtime = "edge"` and switch to `default toWebHandler(app)` (the same rewrite applies).
- `vercel.json` — Vercel build/runtime configuration.
- `tests/` — test files.

## Imports

This project uses TypeScript with `"allowImportingTsExtensions"`, so relative imports use the **`.ts` extension** — the actual file you see on disk:

```ts
import handler from "../api/index.ts";
```

You import the file you see. Vercel bundles the `api/` functions at deploy time and resolves `.ts` directly, and the test runner (tsx) does too. Bare-specifier imports from packages (`@daloyjs/core`, `zod`, …) do not need an extension.

## Core rules

1. The route definition is the contract. Method, path, request schemas, and response schemas live in one place — `app.route({...})`.
2. Validate every input with Zod. Use `.strict()` on top-level object schemas to reject unknown keys at the boundary.
3. Preserve literal types in responses: `status: 200 as const`, `z.literal(...)` on discriminator fields.
4. Throw typed errors (`NotFoundError`, `BadRequestError`, etc.) from `@daloyjs/core`.
5. Keep `requestId()`, `secureHeaders()`, and `rateLimit()` enabled. For production traffic, back rate-limiting with Vercel KV or another shared store (the in-memory limiter resets per instance).
6. On the Node.js runtime the full Node API is available (`node:*`, `Buffer`, `fs`), but prefer Web Standards (`Request`/`Response`, `fetch`, Web Crypto) so the same app can also run on the Edge runtime or another adapter unchanged. If you opt into the Edge runtime, drop `node:` modules entirely.
7. `api/index.ts` is the single Vercel Functions entrypoint and `vercel.json` keeps the `/(.*) → /api` rewrite so DaloyJS handles routing at the site root.
8. Every new route ships with a test that covers a happy path and at least one unhappy path.

## Secure-by-default (do not let an AI strip these)

Per Supabase + Aikido on [secure-by-default development](https://www.aikido.dev/blog/supabase-approach-to-secure-by-default-development): *"If you tell an AI to make something work, it might remove the very security checks that protect you."* When a guard rejects a request, **satisfy it, do not delete it.**

- Keep `secureHeaders()`, `requestId()`, `rateLimit()` registered, and `bodyLimitBytes` / `requestTimeoutMs` set on `new App({...})`. For production, back the limiter with Vercel KV **in addition to** the in-memory limiter (which resets per instance).
- Keep `behindProxy` set on `new App({...})`. A Vercel function always runs behind Vercel's edge proxy (one hop), which sends `x-forwarded-for`; the production boot guard refuses to honour that spoofable header until the posture is declared and otherwise returns a 500 on **every** request. `{ hops: 1 }` is correct for Vercel (`TRUST_PROXY_HOPS` overrides it; e.g. Cloudflare → Vercel = `2`). Satisfy the guard, do not delete it.
- Keep Zod `.strict()` on top-level request objects; do not switch to `.passthrough()`. Keep `responses[N].body` schemas tight; never widen to `z.any()` to let a privileged field escape.
- Every protected route attaches an auth `beforeHandle` and ships an unhappy-path test proving an unauthenticated request returns `401` (and wrong scope returns `403`) — the HTTP-boundary equivalent of Supabase's pgTAP policy tests.
- JWT verifiers keep an explicit `algorithms` allowlist; never trust the token's `alg` header, never allow `none`, always check `exp` / `nbf`.
- Credential / HMAC comparisons use a constant-time comparison (the framework's `timingSafeEqual`), never `===`. Throw typed errors from `@daloyjs/core` so problem+json redacts in prod; never return raw stack traces.
- Keep `api/index.ts` as the single entrypoint and keep the `/(.*) → /api` rewrite in `vercel.json` so DaloyJS owns routing at the site root — do not split into per-path files that bypass the middleware chain, and do not drop the rewrite (the root domain 404s without it).
- `.env`, `.env.local`, secrets, private keys: never commit. Use `vercel env` for production secrets.

## Process expectations

- Quality gates must pass before declaring work done: `npm run typecheck` and `npm test`.
- Bug fixes include a regression test.
- For deploys, ensure the user has run `vercel login`; do not authenticate on their behalf.
- Never bypass safety checks without a clear reason.

For the full workflow — adding routes step-by-step, schema conventions, testing patterns, security guidance, and deployment notes — read [.agents/skills/daloyjs-best-practices/SKILL.md](.agents/skills/daloyjs-best-practices/SKILL.md).
