# Claude session handover — Compile Palace

**Latest session: 2026-09-23 to 2026-09-25 — see "Phase 5" below (theme/mode
system, Auth→Room fixes, mobile pass, Saved Code sequencing, several bug
fixes). Start there if resuming; Phases 1–4 are earlier sessions.** Project
root is now `D:\personal projects\compile-palace` (the `C:\My Programs\...`
path further down is from the earlier session).

Session dates (Phases 1–3): 2026-09-20 to 2026-09-21 (multi-day, continuous conversation).
Scope: Phase 1 — laptop closing animation (frozen, prior work). Phase 2 —
form-field interaction audit (frozen, prior work, no net change). **Phase 3
(this session's main work)** — Start→Auth circular reveal, Auth→Room curtain
reuse (with a laptop continuity bug that took several iterations to actually
fix), sign-out reveal, Room→Editor timing/Room ID polish. Project root is
`C:\My Programs\compile-palace`.

## Phase 1 — Laptop closing animation (COMPLETE, FROZEN)

Files: `src/components/start/LaptopIntro.tsx`, `.css`. Root cause was a
`perspective-origin`/fold-pivot mismatch plus a hinge/base width step; fixed
with a `.laptop__shell` closed-state overlay (short, bottom-anchored bar, not
a full-height slab). Final state: `.laptop__screen` rotation
`transform 900ms cubic-bezier(0.34,0,0.1,1)`, shell opacity
`400ms cubic-bezier(0.45,0,0.55,1) 500ms`. **User confirmed frozen — do not
touch the opening/closing choreography itself.** (This session DID touch
`.laptop__screen`'s `aspect-ratio`, see Phase 3 micro-fixes below — that's a
proportions tweak, not the choreography.)

## Phase 2 — Form-field interaction audit (VERIFIED CORRECT, FROZEN)

Audited hover/focus/keyboard-focus model across Login/Sign-Up/Room Join —
already correct via the shared `AuthField` component, no change needed.
Width token (`--cp-field-max`) tried at `12rem`, user said too short,
reverted to `18rem`. Net diff zero. See prior session detail if resuming this
area; not touched this session.

## Phase 3 — Start→Auth, Auth→Room, Room→Editor polish (THIS SESSION)

### 3a. Start → Auth: CloudBook-style circular reveal

Reference studied: `C:\My Programs\CloudBook\frontend\src\lib\themeTransition.ts`
(note: the earlier-given path was wrong twice — not `D:\...` and not the
originally-stated CloudBook location either; it's under `C:\My Programs\`).
Mechanism: `document.startViewTransition()` + a WAAPI `clip-path: circle()`
grown on `::view-transition-new(root)` from the CTA's own center, radius =
`Math.hypot` to the farthest viewport corner, 900ms,
`cubic-bezier(0.65,0,0.35,1)`.

Implemented in `src/lib/stageTransition.ts` (`startStageTransition`,
`RevealShape = "circle" | "rect"`) + `src/hooks/use-stage-transition-navigate.ts`.
**Two real bugs found and fixed along the way, both worth knowing if this
code is touched again:**
1. An earlier attempt added a soft `mask-image` feather + a separate DOM
   gradient overlay for polish. The **overlay was silently dead code**: the
   browser renders `::view-transition-*` pseudo-elements in the **top
   layer**, which always paints above *all* regular DOM regardless of
   z-index — a plain `position:fixed` div can never appear over it. Reverted
   to CloudBook's actual mechanism (hard `clip-path: circle()`, no mask, no
   DOM overlay) — this is what actually fixed "no circle visible at all" for
   the user's real browser (Chrome 153).
2. A subtle gradient tint IS still possible, just not via a DOM overlay —
   applied via `filter` directly on
   `:root[data-stage-transition="circle-forward"]::view-transition-new(root)`
   in `src/index.css` (`filter` is the one CSS mechanism that actually
   affects top-layer content).

Direct `/auth` visits while already authenticated skip the animation
(instant redirect) — only a genuine just-completed login/signup plays it.
Reduced motion skips it. Verified at 360/390/430/768/1024/1280/1440.

### 3b. Sign-out → Start: same circle, forward not reverse

`Index.tsx`'s `handleSignOut` now uses `shape:'circle'` **forward** (grows,
matching Start→Auth) rather than the reverse/shrink it used earlier — a
direct user request ("reuse the same animation as starting screen instead of
tracing back"). Also fixed a real latency bug: the circle used to wait for
`await supabase.auth.signOut()` (a network round trip) before starting —
now the circle starts immediately on click and `signOut()` runs in parallel
(`.then()`, not awaited first). Duration is slowed specifically for
sign-out via a new optional `durationOverrideMs` param on
`startStageTransition` (1300ms vs the shared 900ms default) — Start→Auth's
own timing is untouched.

A real vertical-position bug was also found and fixed here: sign-out doesn't
change route (Room Join and Start both render at `/`), so the swap used to
be driven by Supabase's async auth-state-change event flipping `user` to
null — completely outside the view transition's `flushSync`, causing Start
Screen to flash in before the circle even captured its "before" snapshot.
Fixed with a `holdRoomView` flag in `Index.tsx` that keeps Room Join
rendered through the transform, released only inside `startStageTransition`'s
`flushSync` callback.

### 3c. Auth → Room: reusing AuthCard's own Login↔Signup curtain (not a new mechanism)

This was explicitly requested to **not** be a new/separate animation — Room
Join had to visually feel like "the same auth card transforming," using
AuthCard's actual curtain sweep (`src/components/auth/AuthCard.tsx`/`.css`),
not a route-level page transition. Implementation: `AuthCard` gained a third
`data-mode="room"` state on the same curtain (`AuthStage` type, `roomStage`/
`roomContent`/`onRoomRevealed` props). `Auth.tsx` mounts a transient,
non-interactive `RoomJoinCard` copy inside `AuthCard`'s room slot the moment
login/signup succeeds, flips `data-mode` to `"room"` on the next frame (so
the CSS transition has a "before" frame — same two-tick trick login/register
already used), and navigates to `/` only once the curtain's own
`transitionend` fires. The curtain's target position is always the side
*opposite* whichever mode it's sweeping from (`data-room-entry`), so it
crosses full coverage regardless of whether the user just logged in or
signed up.

Direct `/auth` visits while already authenticated skip straight to `/`, no
transform (tracked via a `wasUnauthedRef` — only a `user` transitioning
false→true *during this mount* counts as "just happened here"). Reduced
motion skips straight through too.

**Two real, measured bugs here, both root-caused rather than patched:**

1. **Post-animation vertical jump.** `Index.tsx`'s authenticated-branch
   footer was `position:relative` (`mt-6`, a real flex sibling consuming
   layout space) while `Auth.tsx`'s footer was `position:absolute` — two
   different centering calculations for what's supposed to be the same
   visual slot, producing a real, measured 22px jump (`y:178→156`) the
   instant the route handed off. Fixed by making Index.tsx's wrapper
   structurally match Auth.tsx's exactly (footer `absolute`, no `flex-col`).
   Verified with instrumented `getBoundingClientRect()` reads before/at/after
   the handoff — all three now identical to the pixel.
2. **Curtain-mode width transition desync.** A version of this bumped
   `.auth-stage`'s `max-width` from `56rem` to `60rem` for room mode (to
   match `RoomJoinCard`'s own natural width) via a CSS `transition`.
   `max-width` is a layout-triggering property, and transitioning it inside
   a `justify-content:center` flex parent visibly lagged the curtain's own
   (compositor-only) `transform` — measured 296ms after the curtain's own
   `transitionend`, the box had only moved 31 of 64px. Fixed by making the
   width a **constant 56rem everywhere** (never transitioned) — including
   changing `RoomJoinCard.css`'s own `.room-stage` from `60rem` to `56rem`
   so the mid-sweep view and the settled page use one identical value, not
   two bridged by an animation. (Known trade-off: Room Join's resting width
   is ~7% narrower than its original design value — accepted deliberately
   per the user's own "same spatial slot, transition container doesn't
   change" direction.)

**The laptop "double-open" bug — the hardest part of this session, three
real architectural iterations before it actually worked:**

The problem: `RoomJoinCard` (containing `<LaptopIntro loop />`) mounts
*twice* during Auth→Room — Auth.tsx's transient curtain-sweep preview, then
Index.tsx's real page — two separate React trees, so naively each rendered
its own `LaptopIntro`, and the real one's mount restarted the whole
open/type/compile sequence from scratch right as the transient one had
already been running, reading as a glitchy double-open. **`LaptopIntro.tsx`
itself was never modified — its internal animation is still the frozen,
approved Phase-1-era choreography.**

- *Attempt 1 (failed, informative):* a React portal (`createPortal`)
  re-targeted between the transient and real slot divs, on the theory that
  changing a portal's *container* preserves the child's React state. This is
  true in general, but **not** when the old container lives physically
  inside a page root that's about to be unmounted: the browser's removal of
  that root is one recursive DOM delete that takes the portaled child's DOM
  down with it before React gets a chance to relocate it out, regardless of
  what the fiber tree considers the logical parent. Measured live: a fresh
  DOM node and a `.laptop--open` reset at the exact handoff, every time —
  even with an explicit `flushSync`-forced release one tick before
  navigating.
- *Final fix:* `src/context/RoomLaptopContext.tsx` (new file) — **not a
  portal at all**. One `<LaptopIntro loop />` is mounted once, permanently,
  at the App root (`RoomLaptopProvider` wraps `<AppRoutes/>` in `App.tsx`,
  alongside `AuthProvider`), rendered as a `position:fixed` overlay that
  tracks whichever DOM element is currently registered as "the room laptop
  slot" via `getBoundingClientRect()`, **polled every animation frame**
  while a slot is registered (so it tracks the slot's own CSS transitions —
  the curtain's slide-in — smoothly, not just snapping at the end).
  `RoomJoinCard`'s laptop area (`.room-stage__laptop`) is now just an empty,
  layout-reserving placeholder that calls `registerSlot`/`releaseSlot` on
  mount/unmount (compare-and-clear on release, so a newer mount's
  registration always wins a race against an older mount's cleanup). Since
  the overlay div never moves in the DOM tree, there is no code path left
  that can destroy it.
- *Sizing regression this surfaced, also fixed:* once `.room-stage__laptop`
  was empty, it collapsed to near-zero natural size (previously its size
  came entirely from the real `.laptop-scene` that used to render inside
  it), so the tracked rect — and thus the overlay — was wrong-sized,
  especially visible on mobile (way oversized, overlapping the form). Fixed
  two ways: (a) the overlay div reuses the literal `.room-stage__laptop`
  className so all the existing size-tuning CSS (including the
  `<=900px` mobile `max-width:14rem` media query) applies to it regardless
  of where in the DOM it physically lives; (b) the now-empty placeholder
  renders a **static, invisible** (`visibility:hidden`) spacer reproducing
  `.laptop-scene > .laptop.laptop--open`'s markup with no JS/animation, purely
  to give `getBoundingClientRect()` the correct open-state size to measure.
- **Verified via a DOM-identity probe** (tag every `.laptop-scene` node
  the first time it's seen via `dataset.probeId`, track unique ids over
  time) across Login→Room and Signup→Room, both live against a real
  Supabase account: exactly **one** real animated instance throughout every
  run, zero resets, zero console errors, at 390/430/1280 widths.

### 3d. Auth→Room curtain timing

`--dur-room: 760ms` (new CSS var in `AuthCard.css`), applied only to the
`[data-mode="room"]` state rules (curtain, forms, welcome copy, room layer).
`--dur-curtain` (Login↔Signup, 640ms) is untouched — confirmed via
screenshot that Login↔Signup is visually identical to before this pass.

### 3e. Room → Editor: slower reveal, shorter Room ID

`src/lib/stageTransition.ts`'s `RECT_DURATION_MS` raised from `1150` to
`1850` ("let the user savour it") — this is the one shared constant for
both Room→Editor and Editor→Room (leave), both directions slowed together,
matching user intent.

`Index.tsx`'s `createNewRoom` now generates a 15-hex-char room ID grouped
5-5-5 with hyphens (e.g. `9d386-75380-b9442`) instead of the full 36-char
UUID — `uuidv4().replace(/-/g,"").slice(0,15).match(/.{1,5}/g).join("-")`.
No validation elsewhere in the codebase depends on the UUID format (checked
`roomService.ts` and friends), so this was a safe, contained change.

## Known environment caveats (apply to any future session in this repo)

- **Wall-clock timing measurements via browser automation are unreliable in
  this environment** — both `claude-in-chrome` and, at times, Playwright MCP
  showed multi-second-inflated gaps for animations that are 900ms–1.8s by
  CSS declaration. Root cause understood for `claude-in-chrome`: the
  automated tab's `document.hidden`/backgrounded state stalls WAAPI
  timelines. Don't trust stopwatch-style live timing from these tools;
  verify durations by reading the declared CSS/JS constants instead, and use
  DOM-state instrumentation (attributes, MutationObserver, probe ids) for
  correctness, not elapsed-time assertions.
- `claude-in-chrome`'s Chrome **fully quits** if you close its last
  remaining tab via `tabs_close_mcp` — carried over from Phase 1's note,
  still true.
- A live Supabase test account exists and works this session:
  `pw-test-7731@example.com` / `hunter222` (created fresh this session via
  the app's own signup flow, since the earlier-documented account was
  rate-limited). Auto-confirm is enabled on this Supabase project — signup
  immediately authenticates, no email-confirmation wall.

## Files touched this session (Phase 3)

`src/App.tsx`, `src/context/RoomLaptopContext.tsx` (new),
`src/lib/stageTransition.ts`, `src/hooks/use-stage-transition-navigate.ts`,
`src/pages/Auth.tsx`, `src/pages/Index.tsx`,
`src/components/auth/AuthCard.tsx`, `src/components/auth/AuthCard.css`,
`src/components/room/RoomJoinCard.tsx`, `src/components/room/RoomJoinCard.css`,
`src/index.css`, `src/components/start/LaptopIntro.css` (aspect-ratio
proportions tweak only, not the frozen choreography).

Phase 1/2 files (`LaptopIntro.tsx`'s animation logic, `AuthField.*`) were
**not** touched this session beyond the noted aspect-ratio tweak.

## Phase 3B — Auth→Room panel morph + laptop presence refinement

Follow-up to 3c: the curtain sweep worked but read as "curtain slides away,
new panel appears underneath" rather than "the auth panel transforms into
the room panel." Explicit constraints from the user: reuse the exact
Login↔Signup curtain mechanism (no new animation engine, no new route
transition), keep `--dur-curtain: 640ms` and `--dur-room: 760ms` baselines,
keep the stable 56rem stage, no post-animation shift, single `LaptopIntro`
instance, don't touch `LaptopIntro.tsx`'s internal open/type/compile
animation, don't touch Login↔Signup/Start→Auth/Room→Editor/forms/Supabase/
WebSockets/editor.

**What shipped, CSS-only, two files:**

1. `AuthCard.css` — the curtain (`.auth-stage__curtain`) no longer just
   slides off-screen opaque in room mode. It now also fades opacity over the
   last ~45% of `--dur-room` (`transition-delay: calc(var(--dur-room) * 0.4)`,
   duration `calc(var(--dur-room) * 0.45)`), so it visually *thins and
   dissolves* into the light frosted room panel fading in underneath it
   (same z1 layer, `.auth-stage__room`), instead of hard-cutting at the
   edge. That's the "curtain becomes room panel material" effect — achieved
   by timing/opacity on the existing layers, not a new mechanism.
2. `AuthCard.css` — `.auth-stage__room`'s own transition now starts later
   and runs shorter than the curtain's full `--dur-room` (delay
   `calc(var(--dur-room) * 0.28)`, duration `calc(var(--dur-room) * 0.66)`)
   so room content visibly *settles in* a beat after the curtain begins
   dissolving, rather than both layers animating in lockstep for the full
   duration. Reduced-motion block updated to also zero the new
   `transition-delay` (else instant-snap mode would still carry a ~213ms
   dead delay before the 0.01ms snap).
3. `RoomJoinCard.css` — added `.room-stage__laptop::before`, a static
   (non-animated) blurred radial-gradient glow behind the laptop, scoped to
   this class only (not any shared `.laptop*` class), so Start screen's own
   `LaptopIntro` rendering is untouched. Also bumped
   `.room-stage__laptop .laptop-scene` max-width 20rem → 21.5rem (desktop
   only; the `<=900px` mobile override, still 14rem, untouched) so the
   laptop carries comparable visual weight to the glass form panel instead
   of reading small next to it.

**Item 12 (closed-entry laptop travel, settle, then open) was already done**
in a prior session/commit (`cf1f2a6`, "Room laptop: closed entry travel
before LaptopIntro starts") before this pass started — `RoomLaptopContext.tsx`
already has the `entering-start`/`entering-move`/`active` phase machine
described in its own doc comment. Not re-touched this pass beyond confirming
it's still intact.

**Verified:** `tsc --noEmit` clean (CSS-only diff). Live browser check via
Playwright MCP against the real Supabase test account
(`pw-test-7731@example.com` / `hunter222`) at 1280px — logged in, landed on
Room Join with correct final layout, glow visible, single laptop instance,
no post-settle jump, zero console errors. **Not** re-verified this pass:
mobile widths (360/390/430) — changes are either desktop-scoped or
duration/opacity-only and shouldn't touch mobile's separate media query, but
this is inference, not a rerun; a signup→room live run; and the "does it
truly read as one morphing panel" perceptual judgment call, which needs the
user's own eyes, not just DOM-state verification (per this repo's own
"wall-clock timing measurements are unreliable here" caveat below — the
same applies to trusting a screenshot over a live look).

## Phase 3C — Room→Editor circle-start (ATTEMPTED, FULLY REVERTED — net zero diff)

User asked to change Room→Editor's starting shape from a 6px dot to a
visible circle (`src/lib/stageTransition.ts`, `buildRectFrames()`). Went
through **four** iterations, each one live-verified then reported as broken
by the user on the next review, ending in a full rollback to the original
committed code (`git checkout -- src/lib/stageTransition.ts`, confirmed
`git diff` empty against `b5c3256`). **Current state: this file is
byte-identical to before this session touched it. The 6px-dot start is
still what ships.** Worth recording exactly why each attempt failed, so a
future attempt doesn't repeat them:

1. Same-size 48px circle (`round 50%`) at frame 0, matching frame 0.2's box
   exactly. Live-verified via a paused-WAAPI screenshot (`animation.pause();
   animation.currentTime = 0`) — rendered as a malformed blob, not a circle.
   Root cause found: frame 0's `round 50%` (percentage radius) interpolating
   against frame 0.2's `round 14px` (pixel radius) on the same `clip-path`
   shape renders incorrectly mid-flight in this Chrome build. Fixed by
   switching to `round 24px` (same circle, same unit as every other frame)
   — verified clean live afterward.
2. User then reported the OPPOSITE symptom ("small circle appears, then
   abruptly becomes a bar, no visible square stage"). Changed frame 0 to a
   visibly *smaller* 16px circle that grows into the 48px square by offset
   0.2, on the theory that a same-size circle removes the "arrival" growth
   cue that used to sell the square stage.
3. User reported THIS made it worse ("dot appears late, sits still, bar
   suddenly appears"). Real root cause, found by inspecting keyframes
   directly: `RECT_EASING` (`cubic-bezier(0.62,0,0.15,1)`) is a single
   easing applied across the WHOLE 1850ms. Its slow-start phase was
   invisible in the original 6px dot (a few px of size change either way is
   imperceptible) but became a real bug once frame 0 stopped changing SIZE
   — the radius-only delta got swallowed by the slow phase, then everything
   rushed through in the curve's fast phase. Fixed with a **per-keyframe
   `easing`** on frame 0 only (WAAPI scopes a keyframe's `easing` to just
   that segment) — reused `RECT_EASING` itself, just correctly scoped,
   leaving every frame after 0.2 completely untouched.
4. User rejected this too (by this point without a fresh video — Playwright
   had already died, see below). Given three consecutive "this is still
   wrong" reports and no way to visually verify a fourth attempt, did a
   final, explicit full rollback rather than guessing again. **If this is
   picked up again: get a working browser connection FIRST, verify each
   attempt live before reporting it, and consider that per-keyframe easing
   fix (attempt 3/4's actual content) may have been correct but was never
   confirmed live before the user's next message arrived** — it's possible
   the reported "still broken" was describing attempt 2's build if the dev
   server/browser hadn't picked up the change, not a real flaw in attempt
   3/4's logic. Genuinely unverified either way.

## Phase 3D — Auth→Room: curtain-becomes-glass panel morph (IN PROGRESS, UNVERIFIED)

Follow-up to 3B: user wanted the Auth curtain to behave exactly like the
Login↔Signup curtain — i.e. **stay inside `.auth-stage__viewport` and move
to the other side**, never translate fully off-screen — with the room's
glass panel being that same curtain element after a material change, not a
separate thing revealed once the curtain is gone.

**Implemented in `AuthCard.css` only** (no TSX changes):
- Removed the old `--curtain-room-from-login`/`-register` vars
  (`translateX(150%)`/`-150%`, fully off-screen) entirely.
- Room mode now reuses `var(--curtain-register)`/`var(--bulge-register)`
  **verbatim** — the exact same rest position/shape login↔signup's own
  register state already uses. Room Join's glass panel is always on the
  right, so this is a fixed target regardless of entry side: from login
  (resting at -50%) it sweeps the full width, exactly like a login→register
  switch; from register it's already there, so only material morphs (no
  lateral travel — expected, not a bug).
- Curtain's `opacity` stays `1` throughout (previously faded to 0 and
  vanished). Its `background-color` transitions to `var(--glass-primary-bg)`
  (the literal token `.room-stage__form` itself renders with) and
  `backdrop-filter` transitions to `blur(var(--glass-blur)) saturate(1.4)`
  (same as `.glass-primary`). The purple gradient sheen was moved off the
  base element onto a `::before` pseudo (a multi-layer `background-image`
  can't interpolate toward `none`, but a separate layer's `opacity` always
  can), which fades `1→0` over the same span.
- `.auth-stage__room`'s `z-index` bumped to `4` (above the curtain's `3`)
  *in room mode only* — since the curtain no longer disappears, real
  interactive Room Join content needs to render on top of it, not hidden
  behind it.
- `overflow: hidden` added to `.auth-stage__curtain` itself so the `::before`
  gradient pseudo (and anything else) is clipped to whatever border-radius
  the curtain currently has each frame, without needing to keep a second
  radius value hand-synced.

**Bug found on first live-ish review (ghosting) and fixed:** old
`.auth-stage__form--login/--register` and `.auth-stage__copy--login/--register`
were fading out over the FULL `--dur-room` (760ms) while the new
`.auth-stage__room` layer fades in over 86% of it — both independently
timed. For a ~200-500ms middle stretch both were simultaneously
40-60% opaque, alpha-blending into a literal double-exposure ghost. This is
what read as "ghosted Login content remaining," "large blurred purple
layers" (the curtain's own translucent glass alpha blending with the ghost
underneath it), and "Room Join appearing as a separate card" (nothing new
to look at for the first ~500ms while the old screen lingered). **Fixed** by
making the old form/copy hide fast and front-loaded:
`transition-duration: calc(var(--dur-room) * 0.34)` (~260ms), `0ms` delay,
instead of the full `--dur-room` — old content is fully gone well before the
room layer or curtain-glass become visually dominant, closing the overlap
window instead of tuning around it.

**FIRST VERIFICATION PASS WAS WRONG — record why, so it isn't repeated.**
Initially "verified" this fixed using a `transitionrun` hook that paused each
transition's `Animation` at `currentTime=0` and then manually scrubbed
`currentTime` to fixed checkpoints. That method showed low, non-overlapping
opacity and got reported as fixed. **User immediately reported it was still
broken.** A slow-motion recheck (`Animation.playbackRate = 0.04` applied
per-element inside the `transitionrun` handler) then showed heavy ghosting —
but that method is ALSO invalid: setting `playbackRate` independently on
each element's `Animation` object at the moment its own `transitionrun`
fires desyncs siblings that started at very slightly different real
instants, producing garbled results that don't reflect real playback either.
**Neither manipulated-timeline method is trustworthy for this kind of
multi-layer crossfade.** What actually worked: a single `page.evaluate` that
both fires the real click AND samples `getComputedStyle(...).opacity` on
every `requestAnimationFrame` for the *unmodified, real-speed* transition,
all inside one call (round-trip latency between separate tool calls is
longer than the whole 760ms transition, so anything split across calls
misses it or catches only the settled end-state). This produced a real,
trustworthy trace.

**Real root cause (confirmed by the real trace):** `.auth-stage__room`'s
fade-in `transition-delay` was `calc(var(--dur-room) * 0.08)` (~61ms) —
*shorter* than the old form/copy's own fade-out `transition-duration` of
`calc(var(--dur-room) * 0.34)` (~258ms). Since old content starts fading at
t=0 and isn't fully invisible until ~258ms, but room content starts fading
in at ~61ms, there was a genuine ~197ms window (61–258ms) where **both were
simultaneously non-zero opacity**, alpha-blending into visible overlapping
text — this is what the user was actually seeing. (The comment already in
the CSS at the time correctly *described* the fix needed but the shipped
delay value didn't actually satisfy it.)

**Fix applied** (`AuthCard.css`, `.auth-stage[data-mode="room"]
.auth-stage__room`): delay raised from `0.08 * --dur-room` to
`0.34 * --dur-room` (exactly matching old content's fade-out duration, so
room starts only once old content has fully hit zero), duration shortened
from `0.86 * --dur-room` to `0.66 * --dur-room` to still land at the same
760ms total.

**Re-verified with the real (unmanipulated) trace method, Login→Room, real
Supabase test account, 1280px:** old content hits exactly opacity 0 at
t≈277–280ms; room content is still exactly 0 at t≈277ms and only starts
rising at t≈294ms — a genuine zero-overlap gap (~15ms, under one frame at
60fps, so it reads as a clean quick dissolve, not a jarring blank flash).
Froze the real (not scrubbed) animation at that exact gap via
`document.getAnimations().forEach(a => a.pause())` triggered from inside the
same rAF sampling loop the instant t crossed the threshold, then
screenshotted: right half is fully blank white, **zero text from either
layer** — confirms the fix visually, not just numerically. `tsc --noEmit`
clean. Zero console errors throughout.

**Not done this pass:** signup→room path (only login→room actually
exercised), 360/430/768/1024/1440 breakpoints (only 1280 + 390 checked, both
clean). Also re-confirmed the single-LaptopIntro-instance claim from the
first pass still holds (RoomLaptopContext's travelling wrapper deliberately
reuses the class name `laptop-scene` around LaptopIntro's own root, which is
also named `laptop-scene` — one wrapper + one real instance nested, not two
instances; not affected by this CSS-only fix anyway).

## Playwright MCP disconnected — BLOCKS LIVE VERIFICATION, fix before resuming animation work

Partway through this session `taskkill //F //IM node.exe` was run to clean
up stray dev-server processes across several `npm run dev` restarts (ports
crept 8080→8084 as old ones were never killed cleanly). This also killed
Playwright MCP's own node process. **It has not reconnected since** —
`ToolSearch` for any `mcp__playwright__*` tool returns a hard connection
failure for the rest of this session; there is no in-session way to restart
it. Every animation-verification claim from Phase 3C attempt 2 onward had to
be either skipped or based on static code/keyframe inspection instead of an
actual rendered frame — a real capability loss, not a shortcut taken by
choice. **Restart the Claude Code session (or otherwise get the Playwright
MCP server reconnected) before trusting or continuing any further visual
verification in this project.** When restarting dev servers in future
sessions, kill only the specific PID `npm run dev` reports, not a blanket
`taskkill /IM node.exe` — that command has no way to distinguish the dev
server's node process from any MCP server's node process.

## Phase 4 — Saved Code UX, editor gutter/scrollbar, avatars (NEW SESSION, 2026-09-23)

Separate session, editor page only (`src/pages/EditorPage.tsx`/`.css`,
`src/components/editor/*`, `src/components/Client.tsx`,
`src/hooks/useEditorSetup.ts`). Phase 1–3D above (Start/Auth/Room-join
choreography) **not touched this session** — different surface entirely.

### 4a. Saved Code — modal-free delete/save

Replaced both remaining native-modal flows with inline glass UI, reusing
existing `.cp-liquid`/`ModernTooltip`/glass tokens (no new dialog system):
- **Delete**: `SavedCodeHistory.tsx`'s ⋯ menu's Delete swaps the row's own
  menu-trigger area for inline Confirm/Cancel icon buttons in place (no
  `AlertDialog`). Deleting the currently-open session clears
  `currentSavedCodeId` and runs the existing `startEditorRevealTransition`
  (circle→square→horizontal→vertical) to show a fresh empty editor — reused
  verbatim, not reimplemented.
- **Save**: `src/components/editor/InlineSaveForm.tsx` (new file) — the
  Save icon itself expands horizontally in place into a small glass naming
  input (same structural pattern as the language dropdown: trigger +
  `data-open` panel, click-outside/Escape to close), instead of opening
  `SaveCodeDialog`. `SaveCodeDialog` itself still exists and is still used,
  but **only for Rename** now.
- Duplicate-name validation stays inline (returns a string from `onSubmit`,
  form shows the error and stays open) rather than a modal.

### 4b. Top bar — matched the glass material family

`EditorPage.tsx`'s `<header>` was `className="editor-topbar glass-subtle"`
(the app's weakest/most-transparent tier) while every sibling panel (Room
Info, Output, sidebar) uses `glass-secondary`. One-line fix: switched the
class. Also gave the top bar the same `0.75rem` inset-margin/radius language
every other panel already uses (was flush to the viewport edges before).

### 4c. Saved Code list — real insert/delete layout animation, and the actual root cause of "no animation at all"

Multiple rounds here; the important part is **the root cause**, not the CSS
polish on top of it:

- The list item's collapse/expand uses the CSS grid-rows trick
  (`grid-template-rows: 1fr` ↔ `0fr` on a wrapping `.editor-history__row`,
  `overflow:hidden` on a `.editor-history__row-inner` child) — this is what
  gives a REAL layout-height animation (animates from the item's actual
  rendered height, not a guessed `max-height`), not `scaleY`/opacity alone.
  `.editor-history__item` inside only fades opacity — it does NOT also
  transform, because an earlier version had it independently `scaleY`-
  squishing at the same time as the row's own grid-rows collapse, which read
  as a flinch (two systems animating the same visual effect). Delete and
  insert share one duration/easing family (currently 320ms,
  `var(--cp-ease-standard)`) so they read as exact counterparts.
- New items are marked `data-anim="entering"` (collapsed) via a
  **render-phase state update** (`SavedCodeHistory.tsx`, comparing incoming
  `items` ids against a `seenIds` state set **during render**, not inside a
  `useEffect`) — this matters: doing the "is this a new id" detection inside
  a `useEffect` was tried first and is WRONG, because the effect runs after
  the browser has already painted the new item at full size once; the
  render-phase update (React's documented "adjust state while rendering"
  pattern) makes the very first commit already show the collapsed state.
- **The actual root cause of "insert/delete has no visible animation at
  all" (found this session, not a CSS problem):** `EditorPage.tsx`'s
  `SidebarPanelContent` (the function containing `SavedCodeHistory`,
  `Client`/People, Room Info) was defined inline in the component body and
  used as a JSX tag (`<SidebarPanelContent />`, three call sites). Since
  it's redefined on every `EditorPage` render, React saw a **new component
  type every render** and fully unmounted+remounted its entire subtree on
  every single state change — confirmed live via `list1 === list2` DOM-
  identity check across a save (`false` before the fix, `true` after) — this
  silently discarded every `data-anim` transition state before any CSS
  could ever animate, no matter how the CSS itself was tuned. **Fixed by
  calling it as a plain function** (`{SidebarPanelContent({...})}`) instead
  of JSX at all three call sites — it has no hooks of its own, so this is
  safe; React now reconciles its returned elements in place like any other
  JSX in `EditorPage.tsx`. **If any other bespoke inline `const X = () =>
  (...)` component in this codebase is ever rendered as `<X />` instead of
  called as a plain function, assume the same remount bug until proven
  otherwise** — it's an easy pattern to reach for by accident and silently
  breaks any animation/local-state inside it.

### 4d. Editor gutter — line numbers vs. horizontal scroll (fixed, then re-broke, then fixed again — record why)

Bug: scrolled code text became legible under/through the line-number
gutter. **Not a positioning bug** — `.CodeMirror-gutters` is already
`position:absolute; z-index:3` (codemirror.css) and structurally always
paints above the scrolling code; the bug was purely that this app's own
override set `background: transparent` on it, making the already-on-top
gutter see-through.

Went through several background values chasing "keep the original look"
requests, each one re-tested — **the one fact that matters if this is
touched again: the gutter's background-color must be fully OPAQUE (alpha
exactly 1, e.g. `hsl(243 45% 98%)`), not merely high-alpha.** A 0.94-alpha
attempt (chosen to also add real `backdrop-filter` blur matching
`.editor-surface`'s own material, for visual consistency) was verified
"clean" via `CodeMirror.scrollTo()`-driven tests and reported fixed — **this
was a false negative.** The user caught it still broken live. Root cause of
the false negative: `cm.scrollTo()` goes through CodeMirror's own JS
scroll-API path, which apparently repaints/re-measures differently than a
genuine scroll event, masking the bleed-through that a **real mouse-wheel
scroll** (`page.mouse.wheel()` in Playwright, or any real user interaction)
exposes immediately with bright syntax-highlighted text. **Always verify
this specific bug with a real wheel/drag scroll, never `cm.scrollTo()`.**
Current shipped state: `background-color: hsl(243 45% 98%)` (opaque, no
backdrop-filter — blurring what's behind an alpha:1 layer has no visible
effect anyway), `.dark` variant `hsl(243 35% 10%)`, plus a subtle accent-
tint `background-image` gradient (same recipe `.editor-lang__panel` uses)
so it still reads as "belongs to the glass system" via color/tint rather
than via alpha.

### 4e. People avatars — squircle + quiet-by-default liquid-glass

`src/components/Client.tsx`: removed the per-user `AVATAR_GRADIENTS` hash
(was a permanent saturated gradient background) — avatars are now
`.cp-liquid` (same hook/class every other interactive control uses) with a
single quiet `hsl(var(--cp-accent) / 0.1)` idle tint; the liquid-glass
fill/sheen/lift only appears on hover/focus, matching the rest of the app's
interaction language instead of being a permanently "trying too hard" glass
look. Squircle shape (`border-radius: 26% !important` in `EditorPage.css`
`.editor-avatar`) — needed `!important` because `ui/avatar.tsx` bakes a
Tailwind `rounded-full` into its own className that otherwise wins at equal
specificity. Tooltip (participant name) stays on the existing
`ModernTooltip` system, unchanged.

### 4f. Custom overlay scrollbars for the code editor

`src/hooks/useEditorSetup.ts`: enabled CodeMirror's own **built-in**
overlay-scrollbar addon (`codemirror/addon/scroll/simplescrollbars` — part
of the already-installed `codemirror` package, not a new dependency) via
`scrollbarStyle: "overlay"` on the `fromTextArea` options. This is real
native scrolling throughout (wheel/trackpad/keyboard/drag/programmatic) —
only the rendered scrollbar UI is a thin `position:absolute` pill instead
of the browser default. The addon also auto-offsets the horizontal bar past
the gutter's own measured width internally (`measure.barLeft` in its
source), so gutter-overlap safety came from the library, not new code — a
deliberate choice given 4d's history with this exact class of bug.
Styling (`EditorPage.css`, `.CodeMirror-overlayscroll-vertical/-horizontal`
and their thumb `div`): idle low-opacity indigo pill, brightens on thumb
hover/drag and while a `cp-cm-scrolling` class is set (toggled by a plain
`cm.on("scroll", ...)` listener in `useEditorSetup.ts` that writes directly
to the DOM via a ref, cleared on a 700ms timeout — deliberately NOT React
state, so it never triggers a re-render on scroll). Verified live (real
wheel scroll + real thumb drag via `page.mouse.down/move/up`, not just
computed styles): both bars hidden when no overflow, both appear on
overflow, dragging either thumb changes real `scrollTop`/`scrollLeft`,
gutter never overlapped across 39+ lines of real scrolled content.

**General lesson from this session, worth keeping for any future animation/
scroll work in this codebase:** this project has now hit the same failure
mode twice — a test method that goes through a library's own JS API
(`CodeMirror.scrollTo()`) or a synthetic/manipulated timeline produces a
false "looks fixed" result that a real user interaction (real wheel scroll,
real mouse drag) immediately contradicts. Prefer real
`page.mouse.wheel()`/`page.mouse.down()+move()+up()` over any JS-API-driven
simulation when verifying scroll or drag behavior in this repo.

**Verified this session:** `tsc --noEmit` clean after every change. Live
Playwright checks throughout (list insert/delete DOM-identity + attribute
tracing, real wheel-scroll screenshots, real thumb-drag scrollTop/Left
reads, second-tab live avatar hover). **Not verified this session:** mobile
breakpoints, dark mode (the `.dark .CodeMirror-gutters`/avatar rules are
written by inference from the existing `.dark` token pattern, not visually
checked), reduced-motion for the new scrollbar/list-animation CSS (media
queries are in place following the existing pattern, not live-toggled and
re-screenshotted).

## Phase 5 — Theme × mode, Auth→Room fixes, mobile, misc bug fixes (2026-09-23 → 09-25)

Most work was done through parallel/forked sub-agents, then reviewed. Every
item below says what was verified live and what was not.

### 5a. Theme × mode system (COMPLETE, live-verified except where noted)
- **Two independent dimensions:** theme (`lavender|forest|sunset|rainbow`,
  `data-theme` on `<html>`) and mode (`light|dark`, the `.dark` class). State
  in `src/context/ThemeContext.tsx`, two `localStorage` keys (`cp-theme`,
  `cp-mode`), both applied pre-mount in `main.tsx` (no flash). Dark is NOT a
  theme. Selectors: `components/editor/ThemeSelector.tsx` (4 options) and
  `ModeSelector.tsx` (sun/moon toggle). Both live in the Editor top bar only.
- **Tokens** (`src/index.css`): `--cp-accent`, `-soft`, `-deep`, `-pale`,
  `--cp-border-tint`, `--cp-shadow-tint`, `--cp-atmosphere-1/2`, per theme, plus
  `.dark[data-theme=X]` compound blocks. `--cp-accent` is deliberately RAISED
  in lightness in dark mode (legibility of icons/borders) — surfaces that need
  to be "deeper" in dark (cubes, atmosphere) use their own dark values.
- **Rainbow** is a composed multi-zone theme, not a gradient: editor
  lavender / Room Info forest / Output sunset with soft radials; the Auth
  curtain and accent-filled buttons use a 3-pool lavender/forest/sunset blend.
  `--cp-accent` stays lavender-led under Rainbow, so Rainbow rules reference the
  three hues (243 / 152 / 22) directly.
- **Transitions:** theme switch = circular reveal via the existing
  `startStageTransition` in `lib/stageTransition.ts` (the circle reveals the
  real re-themed DOM, so it is automatically destination-coloured). Mode
  switch = same engine, `"forward"` (light→dark, grows from the toggle) /
  `"reverse"` (dark→light, shrinks back into the toggle), origin measured from
  the toggle's live rect at click time. Reduced motion skips the circle.
- **Cube field (Editor):** generated once in a `useRef` in `EditorPage.tsx`
  (previously `Math.random()` ran in render and reshuffled every cube on any
  re-render — that was the "cubes reset" bug). Tint is a style/CSS colour swap
  only; identity was verified with a DOM-node probe across theme/mode switches.
- **Pre-editor cubes** (Start, Login/Signup, Join Room) use a separate token
  layer: `--cp-preeditor-cube`, `--cp-preeditor-cube-opacity`, class
  `.cp-preeditor-cube`. The Editor's cubes are untouched. Editor-cube
  theme/mode colour work was requested once and stopped before any change —
  the user then said the Editor cubes are approved as-is.
- **Logo:** `components/BrandLogo.tsx` inlines the SVG so its fill follows the
  theme (favicon/apple-touch-icon are static PNG/ICO, flat 2D variants).
  Project logo ≠ theme icon ≠ mode icon; keep them separate.
- **Editor text:** dark mode has a CodeMirror syntax palette in `EditorPage.css`
  (CodeMirror 5's stock `neat` theme has no dark variant). Light-mode keyword
  colour / caret / selection / active line now also follow the theme via
  `--cp-accent-deep` (contrast vs white: Lavender 11.3, Forest 8.8, Sunset 5.2).
  **Not verified:** contrast against the real glass surface; mobile.
- **Other dark-mode gaps fixed:** Output panel content (hardcoded
  `bg-slate-50` etc. → `dark:` variants), gutter (was near-opaque; now uses
  `--glass-secondary-bg`), Sonner toast (`components/ui/sonner.tsx` read
  `next-themes`, an unrelated provider, so it never saw dark; also an inert
  Tailwind arbitrary-variant class), Join Room viewport shadow/background,
  compile loader (`components/WavLoader.tsx`, now theme-coloured).

### 5b. Editor / session bug fixes (each root-caused, not patched)
- **Room Info stutter:** panel content shared the panel's own geometry
  transition. Content now settles after (`.editor-sidebar__content`, keyframe
  animation — a `transition` never ran because the node mounts already in its
  "open" state).
- **Blank Editor after joining a room (intermittent):** CodeMirror was mounted
  via `document.getElementById` in a `[]`-deps effect; now a React ref threaded
  `Editor.tsx → useEditorSetup`. Also added an app-wide `ErrorBoundary`
  (`components/ErrorBoundary.tsx`) so a render error shows a Reload UI instead
  of a blank app. **Not confirmed** whether the ref change alone fixed the
  original report; the boundary logs the throwing error if it recurs.
- **Run used a stale saved-code snapshot:** `handleCompile` read a mirrored
  `codeRef`; it now calls `EditorHandle.getValue()` (reads CodeMirror live).
  Verified live in 3 scenarios.
- **Sign-out from the Editor:** two independent redirects raced (RequireAuth's
  `<Navigate to="/auth">` and one in `EditorPage`'s render body). Both now
  respect `AuthContext.signingOut`; RequireAuth renders `children` (not `null`)
  while signing out, otherwise the transition captures a blank "before" frame.
- **Sign-out from Join Room (`Index.tsx`):** Start now appears when the circle
  releases, not when Supabase's `signOut()` returns (a slow logout used to leave
  Join Room up). A genuine error rolls back with a toast.
- **`stageTransition.ts`:** rect *reverse* now mirrors keyframe offsets
  (`1 - offset`) — the old reverse kept the ascending offsets with reversed
  values, cramming the motion into the first ~20% ("reverse feels too fast").
  Added a 4s watchdog for a View Transition whose `finished` never settles
  (the app would stay inert until reload).

### 5c. Auth → Room continuity + interaction (many passes; final state)
- **Navigation used to depend on `transitionend` for one property** — it never
  fires if the property's value doesn't change (Signup entry: `transform`;
  Dark+Rainbow: `background-color`), stranding the user on the decoy preview at
  `/auth` with dead inputs. `AuthCard.tsx` now waits on
  `curtain.getAnimations()` → `finished` (and proceeds immediately if nothing
  ran). This was the root of "can't type in Join Room" / "nothing clickable".
- **The decoy `.auth-stage__room` is `pointer-events: none`** — it only hosts
  a cosmetic `RoomJoinCard` with no-op props. Do not make it interactive.
- **What made the curtain read as a "handoff":** (1) `.room-stage__viewport` and
  `.room-stage__form.glass-primary` painted their own opaque layers above the
  curtain (stripped inside `.auth-stage__room`), (2) `backdrop-filter` had no
  base value, so `none → blur()` snapped (curtain base is now
  `blur(0px) saturate(1)`), (3) the closed-laptop placeholder slid in at full
  opacity (now fades with its slide), (4) the curtain's settled material
  didn't match the real panel (border/sheen/footprint; Rainbow's gradient sat on
  a non-fading `background-image`) — fixed with a `::after` overlay and a
  `--cp-curtain-pools` variable, (5) Room content revealed too early (now
  ~78–100%). A `clip-path` inset morphs the curtain to the panel footprint on
  ≥768px only. **Not verified:** the actual sweep frames — see the environment
  caveat below; the user should watch it in a real browser.
- **`.room-stage__viewport` has `overflow: hidden`, which clips its child's
  `box-shadow`.** The "lift" you see is the viewport's own shadow (it now has a
  `.dark` variant). Editing `--glass-primary-shadow` alone does nothing there.
- **Closed-laptop line** uses `hsl(var(--cp-accent) / …)`; inside Join Room
  `RoomJoinCard.css` still overrides the rim to a white highlight.

### 5d. Mobile responsiveness
- **Editor (done, verified at 320–480 + 768/834):** ≤767px block in
  `EditorPage.css`; two-row top bar (104px), 40px touch targets, editor keeps
  ~650px at 390×844, Output `clamp(11rem, 36dvh, 20rem)` expanded / 44px
  collapsed, Room Info drawer (Radix Sheet) with no auto-focus tooltip, People
  show names (`Client.tsx`). Desktop 1280/1440 matched a before-snapshot.
- **Pre-editor screens (Start / Login / Signup / Join Room): INCOMPLETE.** A
  fork hit a rate limit mid-run and never reported. Partial CSS edits exist in
  `AuthCard.css`, `AuthField.css`, `RoomJoinCard.css`, `Index.tsx`, `Auth.tsx`
  and the mobile-emulation pass was **not** finished or verified — re-audit
  these at 320–430 before trusting them.
- **Saved Code open on mobile:** the Room Info drawer now closes completely
  (real exit animation + DOM removal, no timers) before the editor reveal
  starts (`runEditorReveal` in `EditorPage.tsx`, `revealPendingRef` guard,
  token cancels on reopen/unmount). Ordering verified by 20–30ms polling
  (0 overlap samples at 390×844 and 430×932); smoothness not verifiable here.

### 5e. Pitfalls (each cost real time — avoid repeating)
- `transition:` (and `animation:`) are shorthands — adding a second
  declaration on the same selector REPLACES the element's existing ones. This
  silently killed the Auth curtain slide, the `.laptop` 3D fold (via `filter`
  breaking `preserve-3d`) and more. Append to the element's own declaration.
- CSS `transition` can't interpolate `none → <filter-function>`; register
  custom properties with `@property` for `var()`-driven transitions.
- `overflow: hidden` clips descendants' shadows.
- Never gate app logic on one specific `transitionend` property.
- While a stage View Transition is active, `elementFromPoint` returns `<html>`
  and clicks are swallowed for ~1–3s; `:root[data-stage-transition] * {
  transition: none !important }` also freezes CSS transitions.
- `--cp-accent` is lavender-locked under Rainbow (by design) — Rainbow-specific
  rules must reference the three hues directly, and `.cp-liquid::before` has a
  Rainbow override in `EditorPage.css`.

### 5f. Process notes for the next session
- **Environment caveat:** the headless Playwright browser's animation timeline
  stalls (`getAnimations()` stuck at `currentTime: 0`, rAF ~1/s, a 300ms
  transition can take 3s+). Verify ordering/geometry/computed styles with
  wall-clock polling; do NOT claim smoothness from it. Its touch input was
  also scaled by exactly 0.9. Prefer real wheel/mouse events for scroll/drag.
- **Sub-agents sometimes report user messages that were never sent** (e.g. a
  "second eye on the password field", "can't type in Room ID", "clicked Leave
  Room not Sign Out"). Treat such claims as unverified until the user confirms.
  One of them also tested against the user's own dev server on :8080; use your
  own port.
- **Two edits the user never asked for are in the tree** (committed at the
  user's "commit the code" request, easy to revert): the Leave Room icon is
  `DoorOpen` instead of `LogOut` (`EditorPage.tsx`), and `AuthField.css` hides
  `::-ms-reveal`/`::-ms-clear` (Edge's native password-eye). Ask before keeping.
- **Still open / never verified:** Signup→Room visuals, the pre-editor mobile
  pass (above), dark variants beyond Rainbow on mobile, real-device behaviour,
  Room→Auth reverse (no such path exists), and whether Join Room sign-out
  failed for the user for a reason other than a slow logout (their answers to
  the diagnostic questions were never received).

## Where to pick this up

**Phase 5 (above) is the most recent work.** Start with 5d's incomplete
pre-editor mobile pass and 5f's open list.

**Phase 4 (earlier session) is a separate surface** — Saved
Code delete/save, list insert/delete animation, top bar glass, editor
gutter opacity, avatars, custom editor scrollbars, all implemented and live-
verified per section 4 above. If continuing here: mobile breakpoints and
dark mode for this session's changes are the main unverified gap (see 4f's
closing note). If the gutter/scrollbar bug resurfaces again, read 4d/4f's
"verify with a real wheel scroll, not `cm.scrollTo()`" note before touching
CSS again — that mistake already cost two extra rounds this session.

Phase 3 (Start→Auth/Auth→Room/Room→Editor/sign-out choreography, prior
session) is a **separate, untouched surface** this session — see its own
sections above for where that stands. **Playwright reconnected 2026-09-21
(prior session) and Phase 3D's ghosting fix was live-verified** — Login→Room
at 1280px + 390px, no ghosting, no console errors, single laptop instance
confirmed. **Still not run (from Phase 3):** signup→room path, and the
430/768/1024/1440 breakpoints. Phase 3C (Room→Editor circle-start) is fully
reverted and stable; leave it alone unless the user explicitly wants
another attempt — see that section's note about attempt 3/4 possibly having
been correct but unconfirmed. Explicitly **not** touched/implemented in
Phase 3, per user direction: Room→Editor's own reveal choreography/mechanism
(only duration ever changed), the editor itself, WebSocket/Supabase backend,
`LaptopIntro.tsx`'s internal animation.

**Dev server note:** a stray `npm run dev` may be running from a prior
session (bash job, port 8080) — kill it by its specific PID if no longer
needed, not a blanket `taskkill /IM node.exe` (that command has previously
killed Playwright MCP's own node process too — see the caveat above about
that happening once already).
