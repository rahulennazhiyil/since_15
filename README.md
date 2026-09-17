# since060815

> Miles apart. Still in the same frame.

A free, browser-based virtual photo booth for two people who are far away from each
other. Open the site, start a room, send the link, see each other, pick a filter, count
down together, take a photo, keep the memory. No account, no install, nothing uploaded.

**Local first. Private by default.** Video is peer-to-peer over WebRTC and photos are
composed and stored in your own browser.

**Live:** https://rahulennazhiyil.github.io/since_15/

## Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): stack decisions, module layout, camera, filter,
  WebRTC, signaling, synchronized capture, storage, and privacy design.
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md): phased plan with a definition of
  done per phase.

## Stack

Angular 21.2 (standalone, zoneless, signals), TypeScript, SCSS design tokens, WebRTC,
Canvas 2D, IndexedDB. Signaling via Supabase Realtime in production and the browser's
`BroadcastChannel` in development, so the whole two-person flow runs locally in two tabs.

## Requirements

- Node 24.x (Angular 21 accepts 24.0+). Angular 22 needs Node 24.15+, which this
  workspace does not assume.
- npm 11.

## Commands

```bash
npm install
npm start            # dev server on http://localhost:4200
npm run build        # production build to dist/since060815 (with service worker)
npm test             # unit tests (Vitest, jsdom)
npm run e2e          # end-to-end tests (Playwright, headless Chromium, fake camera)
npm run e2e:ui       # the same, in Playwright's UI
npm run ml:models    # (re)download the on-device segmentation model, verify its hash
npm run backgrounds  # rasterise scripts/backgrounds/*.svg into public/backgrounds
```

`E2E_REAL_ML=1 npx playwright test e2e/ml-smoke.spec.ts` runs the one test that loads the
real segmentation model; every other test uses a deterministic fake segmenter through the
development-only key `since060815:dev:segmenter` (`fake` | `cpu` | `gpu` | `none`).
`/dev/segmentation` (development builds only) shows the live cutout with timings.

### End-to-end tests

`npm run e2e` starts its own dev server on port 4311, generates a small fake camera clip
(`e2e/fixtures/fake-cam.y4m`, git-ignored) and drives the real app: landing, solo booth,
filter editor, two-tab rooms with WebRTC and a synchronized photo, and the activities.
Chromium's built-in synthetic camera stops after about 1.5 s in current headless builds,
which is why the clip is required. Set `PW_CHANNEL=msedge` or `PW_CHANNEL=chrome` to run
against an installed browser instead of Playwright's Chromium.

## Deployment

The app is static. `.github/workflows/deploy.yml` builds it on every push to `main` and
publishes it to GitHub Pages at `https://<user>.github.io/<repo>/`. One-time setup in the
repository settings:

1. **Pages**: Source = "GitHub Actions".
2. **Secrets and variables → Actions**: add `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `TURN_USERNAME`, `TURN_CREDENTIAL` (see `.env.example`). Without them the site still
   builds, but rooms only work between two tabs of one browser and there is no TURN relay.

The workflow passes `--base-href /<repo>/`, copies `index.html` to `404.html` so deep links
such as `/room/ABC123` boot the app, and invite links are built from the document base so
they include the sub-path. Fonts are bundled from `src/fonts` for the same reason.

Any other static host works too (Cloudflare Pages, Netlify, Vercel, S3) with two settings:

- serve `index.html` for unknown paths (single-page app fallback), so `/room/ABC123` links work;
- serve over HTTPS, which cameras require.

The service worker (`ngsw-worker.js`) caches the app shell and fonts so the solo camera
and filters open instantly on repeat visits; rooms always need a network connection.

## Status

All ten phases are complete: workspace, design system, app shell, landing, privacy and about pages, theme switching, the solo camera booth at `/booth` (permission flow, live preview, countdown, flash, single/strip/burst modes, photo reveal with save and share), and the filter engine with 31 presets, live preview and re-filtering after capture. Custom filters can be created, edited, duplicated and deleted at `/filters` and are stored in IndexedDB. Rooms can be created and joined at `/room/new` and `/room/join` with presence, invite links, capacity and friendly end states, with peer-to-peer video and audio between the two participants, mic mute and camera flip. The couple booth is live: either person presses the shutter, both count down together and both get the same photo in side-by-side, stacked, polaroid, heart, picture-in-picture or strip layouts. Photos are kept in the browser: an "Our moments" strip in the booth and room, a Memories page with viewer, delete and download, and "Clear my data" on the Privacy page. Eight peer-to-peer activities (question cards, this or that, would you rather, message cards, shared drawing, bucket list, countdown, distance) live in a sheet inside the room and, for the solo ones, at `/activities`. The app installs as a PWA, ships an end-to-end suite, and scores 91 / 100 / 100 / 100 on Lighthouse mobile (performance / accessibility / best practices / SEO).

**Shared scene (2026-09-17).** When both devices can run the on-device person segmenter
(MediaPipe, self-hosted, nothing leaves the device), the room shows one scene instead of
two tiles: both people cut out over a shared background (ten built-in scenes or your own
photo, softened or dimmed), moved and resized by either person, with one filter over the
whole picture. Both devices still produce the same photo. The solo booth gets the same
backgrounds. Devices that cannot run the model fall back to the classic two tiles.
See `IMPLEMENTATION_PLAN.md` for what comes next.

## Signaling setup (production)

Development uses the browser's `BroadcastChannel`, so two tabs of one browser can run a
whole room with no account. For real rooms across devices, configure Supabase Realtime:

1. Create a free project at supabase.com. Realtime Broadcast and Presence are on by
   default; no tables are needed.
2. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   (the anon key is designed to be public; it grants nothing beyond joining Realtime
   channels). `scripts/write-env.mjs` turns that file, or the same environment variables,
   into the git-ignored `src/environments/env.secrets.ts` before every install, start,
   build and test. Verified live with two browser profiles on 2026-09-17.
3. Build with `npm run build`. The Supabase client is loaded lazily, only when a room is
   joined, and only when both values are set. Without them the production build falls back
   to the same-browser transport.

Video and audio never touch Supabase: it only introduces the two browsers to each other.

### Connectivity note

`environment.webrtc.iceServers` ships with public STUN servers and a Metered.ca TURN relay
(free tier, static credential). Roughly one in eight real-world pairs (symmetric NAT,
strict corporate networks) cannot connect directly and falls back to the relay, which
only forwards encrypted packets. Verified on 2026-09-17 by forcing relay-only ICE in two
browser profiles. The username and credential come from `TURN_USERNAME` and
`TURN_CREDENTIAL` (`.env.local` locally, repository secrets on GitHub); to use another
relay, change the `turn:`/`turns:` URLs in `environment.ts`. Metered's usage page shows
how much relayed traffic is used.
