# Claude session handover — Compile Palace

Session dates: 2026-09-20 to 2026-09-21 (multi-day, continuous conversation).
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

## Where to pick this up

Phase 3 (Start→Auth, sign-out, Auth→Room, Room→Editor/Room-ID polish) is
functionally complete and verified: zero console errors across every tested
flow, one laptop instance guaranteed, no layout jumps, Login↔Signup
unregressed. Explicitly **not** touched/implemented, per user direction:
Room → Editor's own reveal choreography (only its *duration* changed, not
its shape/mechanism), the editor itself, WebSocket/Supabase backend, glass
system, background. No Phase 4 scope discussed yet.
