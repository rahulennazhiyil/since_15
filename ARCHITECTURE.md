# since060815 — Architecture

> A tiny virtual photo booth for people who wish they were in the same room.
> Local first. Private by default.

This document describes the technical architecture of **since060815**, a browser-based
virtual photo booth and long-distance couple camera. It is the reference for every
implementation phase in `IMPLEMENTATION_PLAN.md`. When code and this document disagree,
fix one of them in the same change.

---

## 1. Repository analysis (starting point)

The repository was empty at project start. There was no framework, backend, or
convention to inherit, so the stack below was chosen from scratch.

Machine constraints that shaped the choice:

| Constraint | Consequence |
| --- | --- |
| Node 24.13 installed | Angular 22 CLI requires Node >= 24.15. Angular **21.2 (LTS)** accepts 24.x and is used instead. Upgrade to 22 via `ng update` once Node is updated. |
| npm 11 available, no pnpm/yarn | npm is the package manager. |
| Working directory contains a non-ASCII path segment | Build tooling is verified against this path in Phase 0. If a tool fails on it, move the workspace; do not work around it in code. |

---

## 2. Stack decisions

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Angular 21.2**, standalone components, **zoneless**, signals | Dependency injection maps cleanly onto isolated services (camera, WebRTC, filters, storage). Zoneless means `requestAnimationFrame` loops and media events never trigger framework-wide change detection. Signals give fine-grained, boilerplate-free state without a state library. |
| Language | TypeScript 5.9, `strict` + `strictTemplates` | Strong typing is a stated requirement. |
| Styling | Plain **SCSS** + CSS custom properties (design tokens). No Tailwind, no component library. | The product must look original and "creative lifestyle", not like a dashboard. Utility frameworks and UI kits push toward the generic look this project must avoid. Component styles stay small by keeping tokens global; the per-component style budget is 6 kB (warning) and 12 kB (error). |
| Rendering | Client-side only (`ssr: false`) | Camera and WebRTC are browser-only. SEO needs are limited to the landing page and are met with static `index.html` metadata. Prerendering the landing route can be added later without architectural change. |
| Live filter preview | **CSS `filter` on `<video>`** | GPU-composited, zero JavaScript per frame, smooth on mid-range phones. No canvas loop runs during preview. |
| Capture / composition | **Canvas 2D** (`OffscreenCanvas` where available) | Single-frame work; runs once per shot, not per frame. |
| Real-time media | **WebRTC** peer-to-peer (`RTCPeerConnection`) | Video never touches a server. |
| Control channel | **`RTCDataChannel`** | Clock sync, synchronized capture, filter sync, high-quality photo exchange, activities. Peer-to-peer, no server. |
| Signaling | **Supabase Realtime** (Broadcast + Presence) behind a `SignalingTransport` interface; **`BroadcastChannel`** transport for local development and E2E | Zero custom backend. Channels are ephemeral, so empty rooms vanish automatically. Presence gives participant lists for free. The `BroadcastChannel` transport lets two tabs in one browser run the full WebRTC flow with no keys and no network. |
| Persistence | `localStorage` (profile, preferences, theme) + **IndexedDB via `idb`** (photos as `Blob`, custom filters) | Photos are binary and can be several MB; IndexedDB is the only sane browser store for them. `idb` is ~1 kB and removes callback noise. |
| Unit tests | **Vitest** (Angular 21 default) | Fast, jsdom, already wired by the CLI. |
| E2E tests | **Playwright** | Supports fake camera devices (`--use-fake-device-for-media-stream`) and multiple pages, which is how two participants are tested. |
| PWA | `@angular/pwa` (service worker + manifest) | Installable; caches the app shell and the solo camera/filter experience. WebRTC is never expected to work offline. |
| Fonts | Self-hosted woff2 in `public/fonts` (Manrope for UI, one decorative serif for hero headings) | No third-party requests from a privacy-first product. |

### Runtime dependencies added on top of the Angular scaffold

```
@supabase/supabase-js   signaling transport (production, Phase 6)
idb                     IndexedDB wrapper (added in Phase 4)
```

Nothing else. Every other capability (camera, canvas, WebRTC, filters, storage) is
platform API wrapped in project code.

Dev dependencies added: `@playwright/test` (E2E and visual checks), `fake-indexeddb` (store tests), `@fontsource-variable/manrope` and `@fontsource/instrument-serif` (font files copied into `public/fonts`, no runtime code), `@angular/pwa` (schematic, Phase 10).

---

## 3. Application structure

Angular 21 uses the 2025 file-naming style guide (`camera.ts`, not `camera.component.ts`).
Folder names match the conceptual structure in the product brief where it made sense.

```
src/
  index.html                         SEO metadata, theme bootstrap script, font preloads
  main.ts
  styles.scss                        imports design system
  styles/
    _tokens.scss                     colour, spacing, radius, shadow, motion tokens (CSS vars)
    _themes.scss                     [data-theme="soft|night|film|dream"] overrides
    _typography.scss
    _reset.scss
    _motion.scss                     shared keyframes, prefers-reduced-motion guard
    _utilities.scss                  a handful of layout helpers, not a utility framework

  environments/
    environment.ts                   production values (no secrets other than public anon key)
    environment.development.ts       BroadcastChannel signaling, verbose logging

  app/
    app.ts / app.html / app.scss     shell: header/nav, toast outlet, router outlet
    app.config.ts                    providers (router, error handler, signaling transport)
    app.routes.ts                    lazy routes (see section 12)

    core/                            framework-agnostic engines. NO Angular components here.
      camera/
        camera.service.ts            owns the single active MediaStream
        camera-capabilities.ts       facing mode, torch, resolution probing
        frame-grabber.ts             video element -> ImageBitmap (reusable canvas)
      filters/
        filter.model.ts              FilterDefinition, Adjustments, Effects, Overlay
        filter-engine.ts             adjustments -> CSS string; render(source, filter) -> canvas
        passes/                      one file per effect pass (grain, vignette, fade, light-leak...)
        overlay-renderer.ts          draws emoji/text/shapes/stickers onto a canvas
        presets/                     default filter collection, one file per category
        filter-thumbnails.ts         throttled thumbnail rendering from a frozen frame
      photo/
        photo-composer.ts            FrameSource[] + layout + frame -> Blob
        layouts/                     single, side-by-side, stacked, polaroid, strip, heart
        frames/                      frame themes (border, caption, date stamp)
        image-encode.ts              size clamp + JPEG/WebP encoding
      room/
        room.model.ts                Room, Participant, RoomStatus
        room-code.ts                 crypto-random codes, validation, normalisation
        room.service.ts              room state machine (signals), presence, host logic
      signaling/
        signaling-transport.ts       interface + message types
        supabase-signaling.ts        production transport
        broadcast-channel-signaling.ts  dev/E2E transport (same browser, any tabs)
        signaling.provider.ts        picks transport from environment
      webrtc/
        peer-connection.service.ts   perfect negotiation, ICE restart, track replacement
        data-channel.ts              typed message bus over RTCDataChannel
        clock-sync.ts                offset estimation (ping/pong, median of N)
        blob-transfer.ts             chunked binary transfer with reassembly
        ice-config.ts                STUN/TURN from environment
      booth/
        capture-coordinator.ts       synchronized countdown/capture protocol (host-authoritative)
        booth-session.ts             per-room booth state: mode, filter, layout, shots
      storage/
        storage.service.ts           localStorage wrapper with typed keys + versioning
        photo-store.ts               IndexedDB: photos
        custom-filter-store.ts       IndexedDB: user-created filters
        db.ts                        idb schema + migrations
      permissions/
        media-permissions.ts         getUserMedia wrapper mapping DOMException -> AppError
        browser-support.ts           feature detection (section 13)
      errors/
        app-error.ts                 AppError { code, userMessage, cause }
        error-copy.ts                code -> friendly copy
        global-error-handler.ts      Angular ErrorHandler -> toast, never raw text

    shared/
      ui/                            design-system components (Button, IconButton, Sheet,
                                     Toast, Segmented, Slider, Chip, Avatar, Spinner...)
      layout/                        PageShell, BottomBar, ResponsiveSplit
      directives/                    autofocus, long-press, swipe
      pipes/                         duration, relative-time
      utils/                         id(), clamp(), debounce(), object-url lifecycle
      a11y/                          focus trap, live-region announcer

    features/                        UI composed from core + shared. One folder per feature.
      landing/
      booth/                         solo camera (CameraView, CameraControls, CountdownOverlay,
                                     FlashOverlay, PhotoReveal, ModeSelector)
      filters/                       FilterSelector (rail), FilterThumbnail, FilterEditor,
                                     AdjustmentPanel, EffectsPanel, OverlayCanvas
      room/                          CreateRoom, JoinRoom, RoomPage, RoomHeader,
                                     ParticipantView, RoomWaiting, ConnectionIndicator,
                                     ShareInvite
      memories/                      MemoryWall, PhotoCard, PhotoEditor, ShareSheet
      activities/                    ActivityHost + one folder per activity (Phase 9)
      profile/                       IdentityForm (name + vibe emoji + colour), ThemePicker
      privacy/
```

Rules that keep this structure healthy:

- **`core/` never imports from `features/` or Angular component APIs.** It may use
  `@angular/core` for `Injectable`/`signal`/`inject` only. This keeps engines unit-testable
  in jsdom without rendering anything.
- **`features/` never talks to platform media APIs directly.** Components call services.
- **`shared/ui` has no product knowledge.** A Button does not know about rooms.
- One component, one job. The brief's component list is the target granularity.

---

## 4. State management

Signals in services. No NgRx or similar.

| State | Owner | Shape |
| --- | --- | --- |
| Local camera stream, facing, device list, status | `CameraService` | `signal<MediaStream \| null>`, `signal<CameraStatus>` |
| Selected filter, mode, layout, countdown, shots | `BoothSession` (per room / per booth visit) | signals + `computed` |
| Room, participants, room status | `RoomService` | `signal<Room \| null>`, `computed` for `isHost`, `partner` |
| Peer connection state, remote stream | `PeerConnectionService` | `signal<ConnectionQuality>`, `signal<MediaStream \| null>` |
| Profile (name, emoji, colour), theme, sound on/off | `ProfileService` (thin over `StorageService`) | signals persisted on change |
| Photos this session | `PhotoStore` + `MemoryWall` | `signal<PhotoMeta[]>`; blobs loaded lazily |
| Transient UI (toasts, sheets) | `ToastService`, component-local signals | |

RxJS is used only at async boundaries where it is the natural fit: `fromEvent` for media
element and track events, message streams from the signaling transport, and
`takeUntilDestroyed`. Public service APIs expose signals, not observables.

**Cleanup contract.** Every service that holds a platform resource registers teardown
with `DestroyRef`, and every page component that starts a resource stops it on destroy.
Specifically:

- `CameraService.stop()` stops every track and nulls the stream.
- `PeerConnectionService.close()` closes data channels, removes tracks, closes the
  connection, and unsubscribes signaling.
- `RoomService.leave()` untracks presence and leaves the channel.
- `FrameGrabber` and `PhotoComposer` reuse one canvas each; `ImageBitmap.close()` after use.
- Object URLs are created only through `shared/utils/object-url.ts`, which tracks and
  revokes them.
- Timers live in `CaptureCoordinator` and are cleared on cancel/leave.

---

## 5. Camera architecture

```
getUserMedia --> CameraService (single MediaStream, signals)
                    |
                    +--> <video muted playsinline autoplay>  (CameraView)  <- CSS filter applied here
                    |
                    +--> PeerConnectionService.addTrack / replaceTrack     (room mode)
                    |
                    +--> FrameGrabber.grab(video) --> ImageBitmap --> FilterEngine / PhotoComposer
```

- **One stream at a time.** iOS Safari allows only one active camera stream per page.
  Switching facing mode acquires the new stream first, swaps the video element and
  WebRTC sender (`replaceTrack`), then stops the old tracks.
- **Constraints.** Request `{ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: roomMode }`.
  Audio is requested only when entering a room. The solo booth never asks for a microphone.
- **Recovery.** Tracks emit `ended` when iOS backgrounds the tab; `CameraService` listens
  and re-acquires on `visibilitychange` if the booth is still mounted.
- **Mirroring.** Front camera preview is mirrored with CSS (`scaleX(-1)`). Captured photos
  are mirrored to match what the user saw, because that is what people expect from a booth.
- **No per-frame JavaScript** during preview. Thumbnails and capture are the only canvas work.

Permission flow lives in `core/permissions/media-permissions.ts` and maps every
`DOMException` name to an `AppError` code (`camera-denied`, `camera-busy`, `camera-missing`,
`insecure-context`, `unsupported`).

---

## 6. Filter architecture

### 6.1 Model

```ts
interface FilterDefinition {
  id: string;
  name: string;
  category: 'natural' | 'vintage' | 'dreamy' | 'mono' | 'fun' | 'couple' | 'custom';
  adjustments: Adjustments;     // brightness, contrast, saturation, exposure, temperature,
                                // tint, hue, shadows, highlights, sharpen, blur, fade
  effects: Effects;             // grain, noise, vignette, glow, lightLeak, pixelate, vhs, dateStamp
  overlays: Overlay[];          // emoji | text | shape | sticker, each with x, y, scale, rotation, opacity
  isCustom: boolean;
  createdAt?: number;
  thumbnailSeed?: string;       // optional cached data URL
}
```

Every numeric field has a documented neutral value (0 or 1) so an "empty" filter equals
Original. Presets are plain objects in `core/filters/presets/*.ts`; adding a filter is
adding an object.

### 6.2 Two renderers, one definition

| Path | Input | Used for | Notes |
| --- | --- | --- | --- |
| `toCssFilter(adjustments)` | Adjustments | live preview on `<video>`, thumbnails' base | Temperature/tint are approximated with `sepia()`/`hue-rotate()` combinations. Effects with no CSS equivalent (grain, vignette, leak) are drawn as lightweight absolutely-positioned overlay layers (CSS gradients / a tiny tiled noise PNG) so the preview still looks right. |
| `render(source, filter, target)` | ImageBitmap | capture, thumbnails, re-filtering a saved photo | Exact pipeline: colour adjustments via `ctx.filter` when supported, otherwise a colour-matrix pass over `ImageData`. Effects are compositing passes (`multiply`, `screen`, `soft-light`). Overlays last. |

Both derive from the same `Adjustments` so preview and result stay close. `render` is
the source of truth for the saved photo.

### 6.3 Passes

Each effect is a pure function `(ctx, width, height, params) => void` in
`core/filters/passes/`. The engine runs passes in a fixed, documented order:

`adjustments -> blur/sharpen -> fade -> grain/noise -> vignette -> glow -> lightLeak -> pixelate/vhs -> overlays -> dateStamp`

### 6.4 Thumbnails

`FilterThumbnails` grabs one frozen frame every few seconds (or on demand), downsizes it
to about 96 px, and renders each visible filter into a small canvas. Rendering is throttled
and skipped for off-screen filters. This is the only recurring canvas work and it is
cheap by construction.

### 6.5 Custom filters

The Filter Editor edits a `FilterDefinition` in memory, previews it live, and persists
to IndexedDB through `CustomFilterStore`. Custom filters are indistinguishable from
presets to the rest of the app (`category: 'custom'`, `isCustom: true`). Deleting a
custom filter that a saved photo references is safe: photos store the filter id only
for display and fall back to Original.

---

## 7. Photo composition

```
FrameSource[] -+
Filter         +--> PhotoComposer.compose(job) --> OffscreenCanvas/Canvas --> encode --> Blob
Layout         |
Frame theme   -+
```

- **`FrameSource`** = `{ bitmap: ImageBitmap, participant: ParticipantRef, mirrored: boolean }`.
- **Layouts** (`core/photo/layouts/`): `single`, `sideBySide`, `stacked`, `pip`,
  `polaroid`, `strip3`, `strip4`, `heart`. Each returns slot rectangles for a target size
  and an optional clip path (heart). Layouts are pure geometry.
- **Frames** (`core/photo/frames/`): border colours, caption text, date stamp, theme.
- Output is clamped to a max long edge (default 2048 px) and encoded as JPEG (quality
  0.92) or WebP when supported. Photo strips use a fixed 2:6 aspect canvas.
- Filters are applied per slot before compositing, so partner and self can wear
  different filters if the room allows it (default: shared filter, host's choice syncs).

**Re-filtering after capture** works because the raw, unfiltered `ImageBitmap`s of the
last shot are kept in memory (`BoothSession.lastCapture`) until the next capture or
leaving the page. The user can change filter/frame and the composer re-runs without a
retake.

---

## 8. Rooms and signaling

### 8.1 Room codes

6 characters from a 32-symbol alphabet with no `0/O/1/I` (about 1.07 x 10^9 combinations),
generated with `crypto.getRandomValues`. Codes are case-insensitive on input. Invite
link: `/room/M7K2PQ`.

### 8.2 Room state machine (`RoomService`)

```
          create/join            partner present            partner leaves
 IDLE ----------------> WAITING ------------------> CONNECTED -----------------> DISCONNECTED
                          |                            |                              |
                          |                            v ICE failed/disconnected      | (auto retry)
                          |                        RECONNECTING <---------------------+
                          |                            |
                          v leave / host ends          v success --> CONNECTED
                        ENDING --> ENDED
```

- **Host** = room creator. Host is authoritative for the shared booth settings and the
  capture schedule. If the host leaves, the room ends (MVP). Architecture allows host
  hand-off later (presence carries `joinedAt`; earliest remaining participant can assume host).
- **Capacity.** Presence is used to enforce a maximum of 2 participants in MVP
  (`environment.room.maxParticipants`). A third joiner is told the room is full. The
  data model is a list, so group rooms are a constant change plus layout work, not a rewrite.
- **Room existence.** With ephemeral broadcast channels there is no server-side room
  record. A joiner subscribes and waits for the host's presence for up to 8 s; if it
  never arrives the UI shows "We couldn't find that room". This is acceptable for MVP and
  is exactly the behaviour that guarantees empty rooms are never retained.
- **Expiry.** Rooms live only while someone is present. Additionally the host client
  ends the room after a configurable idle period alone in WAITING (default 30 min).

### 8.3 Signaling transport

```ts
interface SignalingTransport {
  join(roomCode: string, self: PresenceInfo): Promise<void>;
  leave(): Promise<void>;
  send(msg: SignalMessage): Promise<void>;          // to everyone else in the room
  messages: Observable<SignalMessage>;
  presence: Signal<PresenceInfo[]>;
  status: Signal<'idle' | 'connecting' | 'open' | 'closed' | 'error'>;
}

type SignalMessage =
  | { type: 'offer' | 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'peer-ready'; from: string; to: string }   // "my connection is listening"
  | { type: 'room-full'; from: string; to: string }
  | { type: 'room-ended'; from: string };
```

Only WebRTC negotiation and room lifecycle go through signaling. Everything else
(countdown, filter sync, photos, activities) goes peer-to-peer over the data channel.

- **`SupabaseSignaling`**: channel `room:<CODE>`, `broadcast` for messages with
  `self: false`, `presence` for the participant list. Uses the public anon key. The channel
  exists only while subscribed. No database tables are required.
- **`BroadcastChannelSignaling`**: `new BroadcastChannel('since060815:room:<CODE>')`;
  presence emulated with periodic heartbeats. Zero network. Used when
  `environment.signaling.provider === 'broadcast'` and by Playwright.

The transport is chosen once in `signaling.provider.ts` via an `InjectionToken`. Adding
a self-hosted WebSocket server later means one new file implementing the interface.

---

## 9. WebRTC architecture

`PeerConnectionService` implements the **perfect negotiation** pattern: host is
`impolite`, joiner is `polite`. This removes the glare bugs that come from hand-rolled
offer/answer sequencing and makes camera flips (`replaceTrack`, no renegotiation) and
audio toggles trivial.

- **ICE.** `iceServers` from environment: Google and Metered STUN plus a Metered TURN
  relay (udp and tcp on 80, udp on 443, TLS on 443) with a static credential. Without TURN
  roughly 10 to 15 percent of real-world pairs (symmetric NAT, strict corporate networks)
  cannot connect; the relay only forwards encrypted SRTP, it cannot see the video. The
  credential ships in the bundle, which is acceptable at this scale because the free plan
  caps relayed traffic; a move to short-lived credentials would only change the
  environment source. `iceCandidatePoolSize: 2`.
- **Failure handling.** `connectionState` becomes `disconnected`: show "Connection
  interrupted. Trying again..." and wait 3 s. Becomes `failed`: `restartIce()` once, then
  full renegotiation, then room status `DISCONNECTED` with a manual retry. Users never
  see ICE vocabulary.
- **Data channel `booth`** (ordered, reliable) carries typed JSON messages
  (`core/webrtc/data-channel.ts`), and a second channel `blobs` carries chunked binary
  (`blob-transfer.ts`, 16 kB chunks, backpressure via `bufferedAmountLowThreshold`).
- **Start-up handshake.** Each side sends `peer-ready` once its `RTCPeerConnection` is
  listening; tracks and data channels are added only after both sides are ready, so the
  first offer is complete and no rollback is ever needed. (An earlier rollback-based
  approach made Chrome drop the data-channel section and re-offer endlessly.)
- **Descriptions travel as plain `{ type, sdp }`** objects: `RTCSessionDescription` is a
  platform object that `BroadcastChannel` cannot structured-clone.
- **Cleanup** closes channels, detaches remote tracks, and closes the connection.

---

## 10. Synchronized capture protocol

Runs over the data channel; host-authoritative; no server.

1. **Clock sync** on connect: 5 ping/pong round trips; offset = median of
   `(t_remote - (t_send + rtt/2))`. Re-run every 60 s and after reconnect. Typical
   accuracy is well under one video frame at 30 fps for normal home connections.
2. **Schedule.** Whoever presses the shutter sends `capture:request { mode, shots, intervalMs, countdownMs }`.
   The host converts it to `capture:scheduled { fireAt: hostNow + countdownMs, shots, intervalMs, filterId, layoutId }`
   and sends it to the partner (and applies it locally).
3. **Countdown.** Each client renders the countdown from its own clock adjusted by the
   offset, so both hit the shutter at the same instant. Flash and shutter sound fire locally.
4. **Capture.** At `fireAt`, each client grabs its **own** camera frame at full
   resolution (`FrameGrabber`). This yields a sharp self-image untouched by WebRTC
   compression.
5. **Exchange.** Each client encodes its frame as JPEG (about 150 to 300 kB at 1280 px) and
   sends it over the `blobs` channel, and keeps that same encoded copy for itself. On
   receipt, both sides run `PhotoComposer` with identical inputs (and seeded grain), so
   both get the **same** high-quality photo; on the same browser it is byte-identical.
6. **Fallback.** If the partner's frame does not arrive within 3 s, compose using a frame
   grabbed from the remote `<video>` element and mark the photo as `quality: 'preview'`.
   If the real frame arrives later, silently upgrade the stored photo.
7. **Cancel.** Either side can send `capture:cancel` during the countdown.

Photo strips and burst are the same protocol with `shots > 1` and `intervalMs`.

---

## 11. Storage

| Store | Mechanism | Contents | Notes |
| --- | --- | --- | --- |
| `profile` | localStorage | name, emoji, colour, theme, sound on/off, last room code | versioned JSON via `StorageService` with a `schemaVersion` |
| `photos` | IndexedDB (`idb`) | `{ id, createdAt, sessionId, roomCode?, filterId, layoutId, frameId, participants: string[], width, height, quality, blob }` | index on `createdAt` and `sessionId`. Thumbnails generated on demand and cached in a `thumbs` store. |
| `filters` | IndexedDB | `FilterDefinition` with `isCustom: true` | |

- Nothing is uploaded anywhere. There is no server-side storage in this project.
- The memory wall shows photos with the current `sessionId`; `/memories` shows all.
- A "clear all my data" action lives on the Privacy page and wipes both stores.
- Future accounts: every record already carries an `id` and `createdAt`; a sync layer
  would add `ownerId` and `syncedAt` without changing readers.

---

## 12. Routing

All feature routes are lazy (`loadComponent` / `loadChildren`).

| Path | Page | Notes |
| --- | --- | --- |
| `/` | Landing | hero, CTAs, live preview mock |
| `/booth` | Solo camera | full booth without a room; the "Try the Camera" path |
| `/room/new` | Create room | identity -> camera preview -> code |
| `/room/join` | Join room | code entry -> identity -> camera preview |
| `/room/:code` | Room | waiting -> connected booth. Deep link target for invites. A guard redirects to `/room/join?code=` if no identity yet. |
| `/filters` | My filters | custom filter list |
| `/filters/new`, `/filters/:id` | Filter editor | |
| `/memories` | Memory wall | all local photos |
| `/room/:code/activities/*` | Activities (Phase 9) | child routes of the room |
| `/privacy` | Privacy | plain-language architecture explanation + clear data |
| `/about` | About | |
| `**` | Not found | |

`BrowserSupportGuard` wraps camera routes and sends unsupported browsers to a friendly
explanation instead of a broken page.

---

## 13. Browser support and progressive enhancement

`core/permissions/browser-support.ts` checks once at startup:

```
navigator.mediaDevices?.getUserMedia   -> camera pages
RTCPeerConnection                      -> room pages
HTMLCanvasElement / OffscreenCanvas    -> capture (OffscreenCanvas optional)
CanvasRenderingContext2D.filter        -> exact adjustments; else colour-matrix fallback
BroadcastChannel / WebSocket           -> signaling
navigator.share                        -> Share button; else download/copy fallbacks
isSecureContext                        -> everything camera-related
```

Targets: iOS Safari 16+, Android Chrome, desktop Chrome/Edge/Firefox/Safari.

---

## 14. Error handling

- All failures are surfaced as `AppError { code, userMessage, cause }`.
- `error-copy.ts` is the **only** place user-facing error strings live. Codes cover the
  list in the brief: camera/mic denied, camera unavailable, unsupported browser, WebRTC
  failure, network interruption, room not found, room full, room ended, partner left,
  invalid code, photo processing failed.
- A global `ErrorHandler` catches anything unhandled, logs the technical cause to the
  console in development only, and shows a generic friendly toast.
- Recoverable states (reconnecting, waiting) are **states, not errors**, and render inline
  in the room UI, not as toasts.

---

## 15. Design system

Tokens are CSS custom properties defined in `styles/_tokens.scss` and overridden per
theme in `styles/_themes.scss` via `html[data-theme]`. Components only ever reference
tokens.

- **Themes:** `soft` (cream + muted pink, default), `night` (charcoal + soft purple),
  `film` (warm beige + black), `dream` (lavender + white). Rooms can pick a theme; the
  host's choice syncs over the data channel.
- **Type:** Manrope for UI; a single decorative serif italic for hero lines. Fluid type
  scale with `clamp()`.
- **Shape:** radius scale 8/12/16/24/999. Soft shadows, minimal borders, glass
  (`backdrop-filter`) only on floating controls over the camera.
- **Motion:** 150 to 300 ms ease-out for UI; countdown, flash and photo reveal are the only
  choreographed animations. Every keyframe animation is wrapped in
  `@media (prefers-reduced-motion: no-preference)`.
- **Touch:** minimum 44 x 44 px targets; the primary shutter is 72 px; bottom-anchored
  controls on mobile.
- **Accessibility:** visible focus rings via `:focus-visible`, ARIA on every icon
  button, a live region for room status changes, keyboard shortcuts (Space = shutter,
  F = flip camera, Esc = cancel countdown).

---

## 16. Privacy model

- Camera/mic are requested only on booth and room pages, after an explanatory screen.
- Video and audio travel peer-to-peer and are never recorded.
- Photos are composed in the browser and stored only in the user's IndexedDB.
- Signaling carries SDP/ICE and `{ id, name, emoji, colour }` presence. Nothing else.
- No analytics in MVP. No third-party fonts, scripts, or trackers.
- The Privacy page states all of the above in plain language and offers "Clear my data".

---

## 17. Environment configuration

```ts
export const environment = {
  production: true,
  signaling: {
    provider: 'supabase' as 'supabase' | 'broadcast',
    supabaseUrl: SECRETS.supabaseUrl,          // from env.secrets.ts (CI secrets / .env.local)
    supabaseAnonKey: SECRETS.supabaseAnonKey,  // public anon key; safe to ship, not committed
  },
  webrtc: {
    // STUN always; the Metered TURN entry is added only when SECRETS.turnUsername and
    // SECRETS.turnCredential are set. SECRETS comes from env.secrets.ts, generated by
    // scripts/write-env.mjs from environment variables or .env.local (both git-ignored).
    iceServers,
  },
  room: { maxParticipants: 2, hostIdleTimeoutMs: 30 * 60 * 1000 },
  photo: { maxLongEdge: 2048, jpegQuality: 0.92 },
};
```

`environment.development.ts` uses `provider: 'broadcast'` so the whole room flow works
locally in two tabs with no accounts.

---

## 18. Testing strategy

| Layer | Tool | What |
| --- | --- | --- |
| Unit | Vitest | `filter-engine` (CSS string, pass order, neutral filter = identity), `photo-composer` layouts (slot geometry), `room-code`, `clock-sync` math, `blob-transfer` chunking, `storage.service` versioning, `error-copy` coverage of every code |
| Integration | Vitest + jsdom + fakes | `RoomService` over `BroadcastChannelSignaling` (two instances in one test), `CaptureCoordinator` with a fake clock, `PeerConnectionService` against a stub `RTCPeerConnection` |
| E2E | Playwright (`e2e/`, `npm run e2e`) | Landing -> create room -> camera (fake device) -> copy invite -> second page joins -> connected -> filter -> countdown -> capture -> download, plus the solo booth, filter editor, memories and activities. Runs with the `broadcast` transport on Playwright's bundled Chromium. The fake camera must be file-backed (`--use-file-for-fake-video-capture` with `e2e/fixtures/fake-cam.y4m`, generated by `make-fake-camera.mjs`); Chromium's synthetic device stops after about 1.5 s in current headless builds. |

---

## 19. Performance rules

- No `requestAnimationFrame` loop during preview. CSS filters only.
- Thumbnails: one downscaled frame, throttled, visible filters only.
- Capture: one `ImageBitmap` per participant per shot; closed after compose.
- Long edge clamp before encoding; strips render at fixed size.
- Lazy routes; the filter editor, activities, and memories are separate chunks.
- Component style budget 4 kB is respected by keeping styling in tokens.
- Media tracks, peer connections, timers, listeners and object URLs are released by
  the owning service on destroy (see section 4).

---

## 20. Future extension points (not implemented)

| Future feature | Where it plugs in |
| --- | --- |
| Group rooms | `room.maxParticipants`, new layouts, mesh or SFU behind `PeerConnectionService` |
| Accounts / cloud albums | `StorageService` adapters; records already have ids and timestamps |
| Filter sharing / marketplace | `FilterDefinition` is JSON-serialisable; add import/export first |
| WebGL filter renderer | new implementation of the render path in `FilterEngine`; CSS preview unchanged |
| Self-hosted signaling | new `SignalingTransport` implementation |
| Host hand-off | presence already carries `joinedAt` |
| More activities | one entry in `features/activities/activity.model.ts` plus a folder; all activities share the `activity` data-channel envelope and validate their own payload |
