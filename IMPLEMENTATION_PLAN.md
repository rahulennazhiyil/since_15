# since060815 — Implementation Plan

Companion to `ARCHITECTURE.md`. Work proceeds phase by phase. A phase is done only when
its **Definition of Done** passes; the next phase does not start on an unstable build.

## Working rules for every phase

1. `npm run build` passes with no errors and no new budget warnings.
2. `npm test` passes.
3. The dev server runs with an empty browser console on the pages touched.
4. Every page touched is checked at 390 px wide (phone) and 1280 px wide (desktop).
5. Every resource started in the phase (camera, peer connection, timers, object URLs)
   is verified to stop when its page is left. Check via `chrome://webrtc-internals`,
   the camera indicator light, and the Performance panel where relevant.
6. No user-facing string contains a technical term (see `error-copy.ts`).
7. No dependency is added unless it is listed in `ARCHITECTURE.md` section 2.

---

## Phase 0 — Foundation setup  ✅ (this session)

**Goal:** an empty but correctly configured workspace.

- [x] Scaffold Angular 21.2 workspace `since060815`: standalone, zoneless, SCSS, routing,
      strict, Vitest, no SSR.
- [x] Install dependencies.
- [x] Write `ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md`.
- [x] Verify `npm run build` and `npm test` on this machine and path (both green, 2026-09-15).
- Git: left to the project owner by request; nothing is committed from these sessions.

**Definition of Done:** build and tests green on a clean checkout.

---

## Phase 1 — Design system, shell, landing  ✅ (2026-09-15)

**Goal:** the product looks like itself before any camera code exists.

Outcome notes
- Verified in headless Edge via Playwright at 390 px and 1280 px: no horizontal scroll,
  clean console, theme persists and is applied before first paint on reload, page titles
  correct, all four themes render.
- Lighthouse was run in Phase 10 against the production build: 91 / 100 / 100 / 100.
- Component style budget raised to 6 kB / 12 kB (landing stylesheet is 5 kB).
- `/booth`, `/room/*`, `/filters`, `/memories`, `/activities` are "Coming soon" placeholders.
- The Privacy page "Clear my data" action is deferred to Phase 8 as planned.

Tasks
- `styles/` tokens, themes (`soft`, `night`, `film`, `dream`), typography, reset, motion.
- Self-host fonts in `public/fonts` (Manrope + one decorative serif); preload in `index.html`.
- `index.html`: title "A Photo Booth for People Miles Apart", meta description, Open
  Graph + Twitter card tags, favicon set, theme bootstrap script (reads stored theme
  before first paint to avoid flash).
- `shared/ui`: Button (primary/secondary/ghost, sizes, loading), IconButton, Chip,
  Segmented, Slider, Sheet (bottom sheet on mobile, dialog on desktop), Toast + ToastService,
  Spinner, Avatar (emoji + colour).
- `shared/layout`: PageShell, responsive header nav (Camera, Memories, Activities, About)
  with compact bottom bar on mobile.
- `shared/a11y`: focus trap, live-region announcer. Visible `:focus-visible` styles.
- `app.routes.ts` with lazy placeholders for every route in ARCHITECTURE section 12,
  plus Not Found.
- `features/landing`: hero ("Miles apart. Still in the same frame."), supporting line,
  CTAs (Start a Room, Join a Room, Try the Camera), hero visual (two framed tiles with a
  small heart, one subtle idle animation), three short value points, footer with Privacy.
- `features/privacy`: static page in plain language; "Clear my data" button wired in Phase 8.
- `features/profile/ThemePicker` (stores theme via `ProfileService`).
- `core/storage/storage.service.ts` (typed, versioned localStorage) and `ProfileService`.
- `core/errors`: `AppError`, `error-copy.ts` with every code from the brief, global
  `ErrorHandler` that toasts a friendly message.

**Definition of Done**
- Landing renders at 390 px and 1280 px with no horizontal scroll.
- All four themes switch live and persist across reload with no flash.
- Lighthouse (mobile) on `/`: Performance >= 90, Accessibility >= 95.
- `prefers-reduced-motion: reduce` disables the hero idle animation.
- Unit tests: `StorageService` versioning, `error-copy` has a string for every `AppErrorCode`.

---

## Phase 2 — Solo camera booth  ✅ (2026-09-15)

**Goal:** `/booth` is a complete single-person photo booth.

Outcome notes
- Verified end to end in headless Edge with a file-backed fake camera: intro -> permission
  -> live preview -> countdown -> flash -> reveal -> download (`since060815-YYYYMMDD-HHMMSS.jpg`)
  -> retake -> 3-shot strip via the Space key -> leaving the page ends the camera track.
  Denied permission shows the friendly copy with "Try again".
- Front/back flip and iOS background recovery are implemented but need a real phone to
  verify; the fake camera exposes one device so the flip button stays hidden.
- Two real bugs were caught by tests and fixed: cancelling mid-countdown left the capture
  promise hanging, and the permission-error mapper relied on `instanceof Error`, which
  `DOMException` does not satisfy everywhere.
- Camera preview attaches the stream imperatively and calls `play()` with `muted` set
  first; relying on the `autoplay`/`muted` attributes was not reliable.
- Device enumeration happens before the stream is requested; a second pass runs only if
  the first saw no cameras (Safari hides devices until permission is granted).
- **E2E note for Phase 10:** Chromium's synthetic fake camera dies after ~1.5 s in current
  headless Chrome/Edge. Use `--use-file-for-fake-video-capture` with the clip from
  `node e2e/fixtures/make-fake-camera.mjs`.
- Burst mode composes four quick shots into a 2x2 grid (`grid4` layout).

Tasks
- `core/permissions/browser-support.ts` + `BrowserSupportGuard` + unsupported page.
- `core/permissions/media-permissions.ts` (DOMException -> AppError).
- `core/camera/camera.service.ts`: start/stop, facing switch, device enumeration,
  `ended` recovery on `visibilitychange`, signals for stream/status/facing.
- `core/camera/frame-grabber.ts`: reusable canvas, mirrored grab, returns `ImageBitmap`.
- `core/photo/image-encode.ts`: clamp + encode to Blob.
- `core/photo/photo-composer.ts` with `single` layout only (other layouts in Phase 7).
- `core/booth/booth-session.ts`: mode (single, strip3, strip4, burst), countdown
  (0/3/5/10 s), last capture bitmaps, current photo.
- `features/booth`: BoothPage, CameraPermissionIntro (why we ask, big Allow button),
  CameraView (`<video>`, mirrored for front camera, aspect-fit), CameraControls (72 px
  shutter, flip, countdown picker, mode picker, sound toggle), CountdownOverlay,
  FlashOverlay, PhotoReveal (dim, scale-in, Retake / Save / Share), ModeSelector.
- Solo photo strip: N shots at a fixed interval, composed vertically (uses `strip`
  layouts; add them here if Phase 7 has not run, they are pure geometry).
- Shutter and tick sounds via `AudioContext`-generated tones (no audio assets), off by
  default, toggle persisted.
- Keyboard: Space shutter, F flip, Esc cancel.
- Download via `<a download>`; Share via `navigator.share({ files })` when supported.

**Definition of Done**
- Camera starts within one tap after Allow; front/back switch works on a phone.
- Leaving `/booth` turns the camera indicator off within 1 s; returning restarts it.
- Denied permission shows the friendly copy, never a DOMException name.
- Backgrounding on iOS and returning recovers the preview.
- Countdown + flash + reveal feel smooth on a mid-range Android device.
- Unit tests: `frame-grabber` mirroring geometry, `image-encode` clamp, `booth-session`
  mode transitions, `media-permissions` mapping for each DOMException name.

---

## Phase 3 — Filter engine and default filters  ✅ (2026-09-15)

**Goal:** live filters that feel instant, with a clean extensible engine.

Outcome notes
- 31 presets across Natural, Vintage, Dreamy, Black & White, Fun and Couple, defined as
  plain objects in `core/filters/presets/index.ts`.
- Live preview = CSS `filter` on the video + blend layers (`mix-blend-mode`) + HTML
  overlays sized with container query units. The canvas render uses the same layer
  definitions with `globalCompositeOperation`, so preview and photo agree. Pixel and VHS
  use a 15 fps canvas fallback that runs only while such a filter is selected.
- Thumbnails render from one 160 px frame refreshed every 3 s; only the visible category
  is in the DOM. Thumbnails use `afterRenderEffect` because a plain `effect` runs before
  the canvas exists on first render.
- Re-filtering on the reveal screen re-composes from the kept raw frames; the last used
  filter is remembered in the profile.
- `ctx.filter` capability is detected once; browsers without it get a colour-matrix
  fallback for the adjustments (blur excluded).
- Verified in the headless drive: Film applies its CSS filter and 4 layers, Pixel enters
  canvas mode, Hearts shows 3 overlays, Mono re-renders the reveal photo, console clean.

Tasks
- `core/filters/filter.model.ts` with documented neutral values.
- `core/filters/filter-engine.ts`: `toCssFilter()`, `render()`, pass ordering,
  `ctx.filter` capability check with colour-matrix fallback.
- `core/filters/passes/`: grain, noise, vignette, fade, glow, light-leak, pixelate, vhs,
  date-stamp, blur, sharpen (unsharp mask).
- `core/filters/overlay-renderer.ts`: emoji, text, shapes (heart, star, circle), stickers.
- `core/filters/presets/`: Natural (Original, Soft, Warm, Cool, Bright, Fade), Vintage
  (Film, Retro, Polaroid, Old Camera, Dusty), Dreamy (Dream, Soft Glow, Cloudy, Pastel,
  Romance), Mono (Mono, Classic, High Contrast, Film Noir), Fun (VHS, Pixel, Disposable,
  Flash, Date Stamp), Couple (Hearts, Tiny Sparkles, Together, Miss You, Made With Love, Stars).
- `core/filters/filter-thumbnails.ts`: throttled, visible-only, from a frozen frame.
- `features/filters/FilterSelector`: horizontal swipeable rail with category chips,
  live thumbnails, active ring, name label, smooth transition on `<video>`.
- Live preview: CSS filter string on the video element; CSS overlay layers for grain,
  vignette and light-leak approximations.
- Capture applies `render()` so saved photos match the exact pipeline.
- Re-filter after capture from the kept bitmaps (PhotoReveal gains a filter rail).

**Definition of Done**
- Switching filters has no visible frame drop on a mid-range phone (no rAF loop running).
- Thumbnails update within 2 s of the scene changing and stop rendering when the rail is hidden.
- Preview and saved photo are visually consistent for every preset (manual check sheet).
- Unit tests: neutral filter renders identity pixels; pass order is stable; each preset
  serialises to JSON and back; `toCssFilter` output for known adjustments.

---

## Phase 4 — Custom filter creator  ✅ (2026-09-15)

**Goal:** users can build, save, edit and delete their own filters without an account.

Outcome notes
- IndexedDB schema v1 (`filters`, `photos`, `thumbs`) via `idb`; `CustomFilterStore`
  keeps `FilterCatalog` in sync so custom filters appear under a "Mine" chip everywhere.
- Editor state lives in `FilterDraft` (pure signals, unit-tested); the page is wiring only.
- Editor tabs: Light, Color, Effects, Stickers. Stickers are positioned by dragging on
  the preview (pointer capture, arrow-key nudging), with size / rotation / opacity /
  colour / font controls for the selected item.
- Preview defaults to a generated sample scene (no camera prompt); "Preview with my
  camera" opts in to the live camera.
- Verified end to end: create -> tweak -> stickers -> live preview -> save -> appears in
  My Filters and in the booth rail -> duplicate -> delete -> survives reload. Console clean.
- Deleting a filter leaves photos untouched; `FilterCatalog.find` falls back to Original.
- Tests use `fake-indexeddb` for the store (dev dependency).

Tasks
- `core/storage/db.ts` (idb schema v1: `filters`, `photos`, `thumbs`) and
  `custom-filter-store.ts`.
- `features/filters/FilterEditor` page (`/filters/new`, `/filters/:id`): live preview on
  camera or on a sample frame, AdjustmentPanel (brightness, contrast, saturation, exposure,
  temperature, tint, blur, grain, fade, vignette, sharpen), ColorPanel (hue, shadows,
  highlights, intensity), EffectsPanel (grain, noise, glow, light leak), OverlayCanvas
  (add emoji/text/shape/sticker, drag to position, pinch/handles to resize, rotate,
  opacity), name + Save My Filter.
- `/filters` list: custom filters with thumbnails, edit, duplicate, delete (confirm).
- Custom filters appear in the FilterSelector under a "Mine" chip.

**Definition of Done**
- Create -> save -> reload -> filter still present and identical.
- Deleting a filter used by a saved photo leaves the photo intact (falls back to Original).
- Editor is usable one-handed on a phone; sliders are 44 px tall.
- Unit tests: `custom-filter-store` CRUD, overlay transform maths, editor state reducer.

---

## Phase 5 — Rooms (no media yet)  ✅ (2026-09-16)

**Goal:** create, share, and join a room, with presence, using the dev transport.

Outcome notes
- `RoomService` is signal-based but drives its logic from the transport's Observables,
  so it is fully unit-tested with two or three clients on an in-memory channel hub
  (connect, guest leaves, host leaves, silent host timeout, third person full, unknown
  code not-found, malformed code, host idle timeout).
- Verified in headless Edge across three tabs of one browser: create -> waiting -> copy
  link -> guest deep link hits the identity gate -> both connected with avatars in the
  header -> third tab told the room is full before any camera prompt -> guest leaves
  ("Away", room stays open) -> guest returns -> host leaves -> guest sees "room ended"
  and its camera stops -> unknown code shows "finding" then not-found after 8 s.
- Bug caught and fixed: the room page's join effect tracked room signals and re-joined
  whenever a terminal state cleared the room. Room state is now read `untracked`.
- Capacity is decided from presence on both sides, so a third person is turned away
  without being asked for camera access.
- The Supabase transport is Phase 6; until then `provider: 'supabase'` falls back to the
  BroadcastChannel transport so production builds still run for two tabs of one browser.
- The partner tile shows "Connecting video…" until Phase 6 adds the media link.

Tasks
- `core/room/room-code.ts` (generate, normalise, validate).
- `core/signaling/signaling-transport.ts` interface and message types.
- `core/signaling/broadcast-channel-signaling.ts` with heartbeat presence.
- `core/signaling/signaling.provider.ts` (InjectionToken, picks by environment).
- `core/room/room.service.ts`: state machine (IDLE, WAITING, CONNECTED, DISCONNECTED,
  RECONNECTING, ENDING, ENDED), host logic, capacity enforcement, "room not found" after
  8 s, host idle timeout.
- `features/profile/IdentityForm`: name + vibe emoji + colour, persisted.
- `features/room`: CreateRoom (identity -> camera preview -> code), JoinRoom (code ->
  identity -> camera preview), RoomPage shell, RoomHeader (names, avatars, connection dot,
  settings, exit), RoomWaiting ("Waiting for your person...", Copy Invite Link, share via
  Web Share API, QR omitted for MVP), ShareInvite, ConnectionIndicator.
- Deep link `/room/:code` with guard that collects identity first.
- "They're here" moment: subtle animation + live-region announcement when the partner joins.

**Definition of Done**
- Two tabs in one browser: create in tab A, paste link in tab B, both show CONNECTED
  presence within 2 s; closing B moves A to DISCONNECTED with friendly copy; closing A
  ends the room for B.
- Third tab is told the room is full.
- Wrong code shows "We couldn't find that room" after 8 s, not an infinite spinner.
- Unit/integration tests: `room-code`, `RoomService` state transitions over two
  `BroadcastChannelSignaling` instances, capacity, timeout.

---

## Phase 6 — WebRTC media  ✅ (2026-09-16)

**Goal:** both participants see and hear each other, with resilient reconnection.

Outcome notes
- Verified in headless Edge, two tabs of one browser over the BroadcastChannel transport:
  both sides receive 640x480 video with an audio track, the `booth` and `blobs` data
  channels open, the guest measures a 1 ms round trip to the host clock, and muting on
  the host shows a mic-off badge on the guest within a second.
- Two real bugs found by the drive: offers carried the platform `RTCSessionDescription`
  object, which `BroadcastChannel` cannot clone (now a plain `{type, sdp}`); and an
  explicit rollback added for late joiners made Chrome drop the data-channel section from
  every later offer, causing a renegotiation storm. The fix is a `peer-ready` handshake:
  tracks and channels are added only once both peers are listening, so the first offer is
  complete and nothing is ever rolled back.
- `RoomMediaService` (provided by the room page) turns room presence + camera state into
  peer start/stop, swaps tracks on camera flip, relays mic state and re-syncs the guest
  clock every minute.
- Supabase transport implemented (`supabase-signaling.ts`) behind `LazySignaling`, so the
  Supabase client is a separate lazy chunk (about 50 kB transferred) that never loads in
  development or when no keys are configured. Verified live on 2026-09-17: two separate
  browser profiles (which cannot share the local fallback channel) connected through the
  configured Supabase project in 2.7 s, exchanged video in 3.0 s, produced a byte-identical
  photo, and the room-ended message travelled over Supabase broadcast. TURN added the same
  day (Metered free tier, static credential): with both profiles forced to relay-only ICE
  the room connected in under a second over `relay/udp` on both ends and delivered the
  synchronized photo, so pairs that cannot connect directly are covered. Cross-network
  testing on real devices remains open.
- Font preloads removed from index.html: self-hosted fonts with `font-display: swap`
  load fast enough and the preload produced browser warnings on some pages.

Tasks
- `core/webrtc/ice-config.ts`, `peer-connection.service.ts` (perfect negotiation,
  polite = joiner), `data-channel.ts` (typed messages), `blob-transfer.ts`,
  `clock-sync.ts`.
- `CameraService` requests audio in room mode; mic mute toggle; camera flip uses
  `replaceTrack`.
- Remote `<video>` in `ParticipantView`; local tile muted; audio output for remote only.
- Failure handling: `disconnected` -> RECONNECTING copy, `failed` -> `restartIce()`,
  then renegotiate, then DISCONNECTED with Retry.
- Full cleanup on leave, tab close (`pagehide`), and route change.
- `core/signaling/supabase-signaling.ts` implementing the same interface; environment
  wiring; README section on creating a Supabase project and enabling Realtime.

**Definition of Done**
- Two tabs (dev transport) show each other's video with audio within 3 s of join.
- Two devices on different networks connect via Supabase transport (STUN only) or
  clearly show the friendly failure with Retry.
- Camera flip on one side is seen by the other without a reconnect.
- Killing the network for 5 s shows "Connection interrupted. Trying again..." and recovers.
- `chrome://webrtc-internals` shows the connection closed after leaving the room.
- Unit tests: `clock-sync` offset median, `blob-transfer` chunk/reassemble round trip,
  `data-channel` message validation; integration test of negotiation against a stub.

---

## Phase 7 — Couple photo booth  ✅ (2026-09-16)

**Goal:** the core loop: shared filter, synchronized countdown, one high-quality photo on both sides.

Outcome notes
- `CaptureCoordinator` implements the host-authoritative protocol (request -> scheduled
  -> cancel) over the booth channel; `CoupleSession` runs the agreed schedule against the
  local clock (host time converted through the measured offset), grabs its own frame,
  swaps JPEG frames over the blob channel and composes with the host on the left.
- Both sides compose from the **same encoded frames** (each side keeps the JPEG it sends
  rather than its raw frame) and the film grain is seeded, so on the same browser the two
  photos are byte-identical; across different browsers the composition is identical and
  only the JPEG encoder differs.
- Layouts: side by side, stacked, polaroid, heart (clip), picture in picture, and paired
  strips of 3 and 4. Filter and frame choices broadcast to the partner; either side can
  press the shutter or cancel; a partner frame that arrives late upgrades a preview
  composite in place.
- Verified in headless Edge across two tabs: guest presses the shutter, both count down
  in step, both reveal a full-quality Polaroid, frame change re-composes, paired strip of
  3 works, and the whole earlier room flow still passes.

Tasks
- `core/booth/capture-coordinator.ts`: request/schedule/countdown/fire/exchange/fallback/
  cancel exactly as ARCHITECTURE section 10.
- Filter, layout, frame and theme sync over the data channel (host authoritative,
  optional per-person filter toggle).
- Layouts: `sideBySide`, `stacked`, `pip`, `polaroid`, `strip3`, `strip4`, `heart`;
  frames with caption ("Our Moment"), names, date stamp.
- Room booth UI: two ParticipantViews (side-by-side desktop, stacked mobile), shared
  FilterSelector, LayoutPicker, shutter available to both, synchronized
  CountdownOverlay + FlashOverlay, PhotoReveal showing the same composed photo on both
  sides with "Your photo is ready".
- Post-capture: Download, Retake, Change filter, Change frame, Share, Add text/sticker
  (overlay editor reused from Phase 4).
- Quality upgrade: preview-quality composite swapped for full-quality when the partner's
  frame arrives.

**Definition of Done**
- Pressing the shutter on either side starts a countdown on both within perceptible
  simultaneity (target < 100 ms skew, measured with clock-sync logs in dev).
- Both sides end with byte-identical photos (same layout, same frames) in the common case.
- Partner frame fallback works when the blob channel is throttled in dev tools.
- Strips and burst work in couple mode.
- Cancel during countdown cancels on both sides.
- Unit tests: coordinator schedule maths with a fake clock, layout slot geometry for every
  layout at two aspect ratios, composer produces the expected dimensions.

---

## Phase 8 — Memories  ✅ (2026-09-16)

**Goal:** photos persist locally and can be managed.

Outcome notes
- `PhotoStore` (IndexedDB) keeps metadata in a signal and loads blobs on demand; a
  320 px thumbnail is generated once per photo and cached in the `thumbs` store.
- Every captured photo carries a stable id, so re-filtering on the reveal screen replaces
  the saved copy instead of adding one. Auto-save is a preference (on by default) in the
  Settings sheet alongside booth sounds.
- "Our moments" strip in the booth and the room (per visit), `/memories` grouped by day
  with a viewer (save / share / delete), and "Clear my data" on the Privacy page which
  wipes IndexedDB and preferences and reloads.
- Storage pressure: after a save, if the origin is over 80 % of quota, a one-time toast
  asks the user to download and delete a few photos.
- Verified: booth photos appear on the wall (1, then 2 after a strip), the Memories page
  shows them under "Today", delete works and survives reload; in a room both tabs save
  the shared photo. Unit tests cover the store with `fake-indexeddb` (which cannot clone
  Blob bytes, so byte-level checks are left to the browser drive).
- PhotoEditor beyond re-filter/frame on the reveal screen was not built; the reveal
  already covers "change filter / change frame" without a retake.

Tasks
- `core/storage/photo-store.ts` (IndexedDB, thumbnails cache, sessionId index).
- Auto-save every captured photo locally (with a setting to turn auto-save off).
- `features/memories/MemoryWall` inside the room ("Our Moments" strip) and `/memories`
  page (grid, date groups, select, delete, download, share).
- PhotoEditor: re-apply filter/frame from stored data where the raw bitmaps are still in
  memory, otherwise offer filter-on-top of the composed image.
- Privacy page "Clear my data" wipes IndexedDB and localStorage.
- Storage-pressure handling: warn when `navigator.storage.estimate()` is above 80 %.

**Definition of Done**
- 50 photos in IndexedDB scroll smoothly; thumbnails load lazily.
- Delete requires confirmation and revokes object URLs.
- Reload keeps photos; "Clear my data" leaves nothing behind.
- Unit tests: `photo-store` CRUD and index queries with fake-indexeddb.

---

## Phase 9 — Couple activities (modular)  ✅ (2026-09-16)

**Goal:** an activity framework plus a first set of activities, all peer-to-peer.

Outcome notes
- One registry (`features/activities/activity.model.ts`) lists each activity with a lazy
  `load()`, an icon, copy and whether it works solo. `ActivityHost` renders the picker and
  the chosen component through `NgComponentOutlet`; `ActivityChannel` wraps the booth
  data channel with a single `activity` message envelope and per-activity payload guards.
- Activities: Question cards, This or that, Would you rather (same component, two decks),
  Message cards, Draw together, Our bucket list (persisted locally, merged by newest edit
  with tombstones), Countdown (persisted, shared), Distance (hand-picked cities, great-circle
  distance, no location permission).
- In a room the activities live in a bottom sheet so both cameras stay visible; the sheet
  resumes the last activity when reopened. `/activities` offers the solo-capable ones.
- Verified across two tabs: same card on both, picks reveal only when both answered, notes
  arrive with the sender's name, strokes render identically (same inked pixel count),
  bucket lists merge and ticks sync, distance and countdown propagate. Console clean.
- Pure logic (rounds, merge, haversine, countdown text, stroke validation) is unit-tested.

Tasks
- `features/activities/ActivityHost`: registry of activities, routed as room children,
  state synced over a dedicated `activity:*` data-channel message family.
- Activities (each its own folder, each independently removable):
  Question Cards, This or That / Would You Rather, Message Cards, Shared Drawing (simple
  stroke sync), Shared Bucket List (local + synced), Countdown to a date, Distance
  (manual city pick from a bundled list, great-circle calculation, no geolocation).
- Activities are an overlay on the room so the cameras stay visible.

**Definition of Done**
- Adding an activity requires only a new folder and one registry entry.
- Leaving an activity leaves no timers or listeners behind.
- Each activity has a unit test for its reducer/sync logic.

---

## Phase 10 — Hardening, PWA, tests, polish  ✅ (2026-09-16)

Outcome notes
- PWA: `@angular/pwa` service worker (production only), manifest with the brand icons at
  eight sizes (rendered from the favicon mark, full-bleed so "maskable" works), and an
  Install button in Settings that appears only when the browser offers the prompt.
- E2E suite in `e2e/` (Playwright, `npm run e2e`): landing/shell, solo booth incl.
  memories, filter editor, two-tab rooms with WebRTC and byte-identical couple photos,
  activities. Runs on Playwright's bundled Chromium with the file-backed fake camera;
  a global setup generates the clip. 10 tests, about 2 minutes.
- Lighthouse (mobile, production build on a compressing static server):
  performance 91, accessibility 100, best practices 100, SEO 100. FCP 2.2 s, LCP 3.1 s,
  CLS 0. Remaining opportunities are host-side (long cache TTL).
- Fixes from the audit: muted text and accent tokens darkened for 4.5:1 contrast in all
  four themes (primary buttons now use dark text on the soft pink), `robots.txt` added,
  initial bundle trimmed from 96 kB to 89.5 kB transferred by deferring the custom filter
  store to the camera pages and loading the Settings sheet contents with `@defer`.
- Robustness found by the suite: activity messages could be lost while a component was
  still loading. Activities now ask the partner for state on open (host answers), and
  the channel relays through a service-level subject so subscriptions have no gap.
- Not done: a real-device pass (iOS Safari camera flip and background recovery), a
  cross-network room over Supabase with STUN/TURN, and a long-session memory profile.
  These need hardware and accounts this environment does not have.

Tasks
- `ng add @angular/pwa`: manifest (name "since060815", icons, theme colour per theme),
  service worker caching the shell and `/booth` assets only; install prompt on landing
  after first successful photo.
- Playwright E2E: the full flow from ARCHITECTURE section 18 using the dev transport and
  fake camera; run in CI.
- Performance pass: bundle analysis, lazy chunk check, memory profile of a 10-minute room
  session (no growth), mid-range Android test.
- Accessibility pass: keyboard-only run through the core loop, screen reader on room
  status changes, contrast check per theme.
- Empty, loading, error, reconnecting states reviewed on every page.
- Final copy review: no technical vocabulary anywhere user-visible.
- README: setup, environment variables, Supabase Realtime setup, TURN note, deployment
  to a static host.

**Definition of Done**
- E2E green in CI. Lighthouse PWA installable. No console errors on any route.
- Every item in the brief's Success Criteria checked off in a short report at the end of
  this document.

---

## Sequencing summary

```
0 Foundation  ->  1 Design/Landing  ->  2 Solo Camera  ->  3 Filters  ->  4 Custom Filters
      ->  5 Rooms  ->  6 WebRTC  ->  7 Couple Booth  ->  8 Memories  ->  9 Activities  ->  10 Hardening
```

Phases 3 and 4 can be developed against the solo booth alone, so the room and media work
(5 to 7) never blocks the visual and filter work. Phase 6's Supabase transport is the
only step that needs an external account; everything else runs offline with the
`BroadcastChannel` transport.

---

## Open decisions to confirm with the product owner

These do not block Phases 0 to 4.

1. **TURN server.** Done on 2026-09-17: Metered.ca free tier with a static credential,
   four transports (udp/tcp on 80, udp on 443, TLS on 443) in `environment.webrtc.iceServers`.
   Verified with relay-only ICE on both sides (see Phase 6 notes). The free plan caps
   relayed traffic per month; only pairs without a direct path use it.
2. **Supabase project.** Done on 2026-09-17: URL and anon key are supplied through
   `.env.local` / GitHub Actions secrets (see README "Signaling setup"); the live transport
   is verified (see Phase 6 notes).
5. **Hosting.** GitHub Pages from `rahulennazhiyil/since_15` via `.github/workflows/deploy.yml`
   (decided 2026-09-17). Project-site sub-path handled by `--base-href`, `404.html` fallback,
   bundled fonts and base-relative invite links; verified locally against a Pages-like server.
3. **Display wordmark.** Package name is `since060815`. The on-screen wordmark can be the
   same string or a styled variant such as "since 06·08·15". Recommendation: styled variant
   in the decorative serif on the landing page, plain string everywhere else.
4. **Host leaves = room ends** in MVP. Confirm this is acceptable versus host hand-off.

---

## Success criteria report (2026-09-16)

Checked against the brief's success criteria. "Verified" means exercised by the unit or
end-to-end suites in this repository or measured with Lighthouse; "on device" means it
still needs a real phone or a second network.

| Area | Criterion | Status |
| --- | --- | --- |
| UX | Product understood immediately | Landing hero, three CTAs, "how it works" in three steps |
| UX | Creating a room is extremely easy | Name + vibe, one tap; code and link on screen (verified) |
| UX | Joining takes seconds | Deep link or code; identity gate only when needed (verified) |
| UX | Camera starts smoothly | Explained before the prompt; friendly errors for every failure (verified) |
| UX | Two participants see each other | WebRTC both ways, mic state relayed (verified, same browser) |
| UX | Capture feels synchronized | Host-scheduled fire time, clock offset measured, countdown in step (verified) |
| UX | Filters feel instant | CSS filters + blend layers; no per-frame JS (verified) |
| UX | Photos look polished | Polaroid, heart, strips with caption and date (screenshots) |
| UX | Mobile feels natural | 390 px layouts, 72 px shutter, bottom controls, sheet for activities (verified) |
| Engineering | No major memory leaks | Tracks, peer connection, timers, object URLs released on destroy (verified for tracks and photos; long profile pending) |
| Engineering | No unnecessary network usage | Signaling carries only SDP/ICE/presence; everything else peer-to-peer |
| Engineering | WebRTC cleaned up | close() on leave, state 'closed' (verified) |
| Engineering | Camera tracks stop | Track readyState 'ended' after leaving (verified) |
| Engineering | Filters modular | Definition + passes + presets; custom filters are the same type (verified) |
| Engineering | Photo processing modular | Layouts are pure geometry; composer is drawing only (verified) |
| Engineering | Room logic isolated | RoomService tested with two and three clients on an in-memory hub (verified) |
| Engineering | Testable | 146 unit tests, 10 end-to-end tests |
| Engineering | Architecture supports future features | See ARCHITECTURE.md section 20 |
| Design | Premium, original, not a dashboard | Own type pairing, tokens, four themes |
| Design | Beautiful on mobile | Screenshots at 390 px throughout |
| Design | Intentional animations | Countdown pop, flash, reveal; reduced motion respected |
| Design | Empty/loading/error states | Booth, rooms, filters, memories, activities all have them |
| Privacy | Transparent permissions | Intro screen before every prompt; mic only in rooms |
| Privacy | Photos local by default | IndexedDB only; Clear my data (verified) |
| Privacy | No recording, no collection | No servers of our own; no analytics; Privacy page says so |
| On device | iOS camera flip and background recovery | Implemented, untested on hardware |
| On device | Cross-network room (Supabase + STUN/TURN) | Supabase and TURN relay verified in two browser profiles; untested on two devices |
