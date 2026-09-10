# KruMath Flash — operator checklist

Feature app for **krumath.com/krumath-flash**. Soft gate: anyone can play; **Stats** requires a signed-in non-anonymous Supabase user.

Follow the full playbook in [KRUMATH_GAME_INTEGRATION.md](./KRUMATH_GAME_INTEGRATION.md). This file is the app-specific checklist.

## Feature repo (done in code)

- [x] Path: `/krumath-flash` (Vite `base` + Nitro `baseURL`)
- [x] Soft gate on Stats → `/sign-in?returnUrl=/krumath-flash`
- [x] Go-home → `/home` (or `VITE_KRUMATH_ORIGIN`)
- [x] `.env.example` documents `VITE_SUPABASE_*`
- [x] Does not edit the KruMath monorepo

## Phase B — Cloudflare (operator)

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same project as KruMath).
2. Deploy: `npm run deploy` (build + `wrangler deploy` with Worker name `krumath-flash`).
3. Route is configured in Nitro/wrangler:

   ```text
   krumath.com/krumath-flash*  →  krumath-flash
   ```

4. Smoke-test:
   - Unsigned: can play; opening Stats redirects to `/sign-in?returnUrl=/krumath-flash`
   - After sign-in: returns to `/krumath-flash` and Stats opens
   - Assets load from `/krumath-flash/assets/...` (not `/assets/...` on the main site)
   - Go home reaches `krumath.com/home`

**Status (2026-09-10):** Worker `krumath-flash` deployed; route live. HTML/CSS/JS return 200 under `/krumath-flash/`. Soft-gate redirect needs a browser check while signed out.

## Phase C — Maintainer only (not this repo)

After the URL works, add a home entry on **krumath.com/home** linking to `/krumath-flash` in a separate KruMath PR. Do not implement that from this feature repo.
