# Compile Palace

Compile Palace is a real-time collaborative code editor. Sign in, create or join a room with a Room ID, and write code together; run it in the browser and see the output, save snippets to a per-user library, and switch between four colour themes and light/dark mode.

## Features

- **Real-time collaboration** over Socket.io: shared rooms, live code sync, presence (people list with avatars).
- **Remote cursors**: every participant sees the others' cursor positions, each in a distinct server-assigned colour, with a hover name pill in the same glass style. Positions are re-mapped through document changes so they stay attached to the right text.
- **Code editor** built on CodeMirror 5, with syntax highlighting, a fixed line-number gutter, and custom overlay scrollbars.
- **Run code** through a single execution service: Judge0 is primary, with JDoodle (via a Supabase Edge Function) as a fallback when Judge0 is unavailable. The Output panel shows Passed / Failed / Running, compiler diagnostics, and run metadata.
- **Saved Code**: save, update, rename, delete and reopen snippets per user (Supabase), with animated list changes and an editor reveal when a snippet opens.
- **Auth** with Supabase: Login and Signup share one animated curtain, which continues into the Join Room screen.
- **Themes x modes**: four colour themes (Lavender, Forest, Sunset, Rainbow) crossed with Light and Dark. Theme and mode are independent, persisted separately in `localStorage` (`cp-theme`, `cp-mode`), and switched with the existing circular reveal transition.
- **Responsive**: a dedicated mobile layout for the editor (compact two-row top bar, drawer for Room Info, bottom-docked Output).
- **Frosted-glass design system**: shared glass tokens, liquid-glass hover, custom tooltips, a breathing local caret, an animated Copy → Copied confirmation, and reduced-motion support throughout.

## Tech stack

- Vite, React 18, TypeScript
- Tailwind CSS with shadcn/ui (Radix primitives), lucide-react icons
- CodeMirror 5
- Supabase (auth, database, Edge Functions)
- socket.io-client for the realtime layer (backend URL is set in `src/socket.ts`)
- React Router, TanStack Query, Sonner (toasts)
- Realtime backend: a separate repo, [`positron100/code-editor-`](https://github.com/positron100/code-editor-) (Express + Socket.io, deployed on Render)
- Hosting: Vercel (frontend), Render (backend), Supabase (auth, database, Edge Functions)

## Project structure

```
src
├── pages
│   ├── Index.tsx            # Start screen and, once signed in, the Join Room screen
│   ├── Auth.tsx             # Login / Signup (hosts the Auth -> Room curtain)
│   └── EditorPage.tsx       # Editor, top bar, Room Info, Output (+ EditorPage.css)
├── components
│   ├── auth/                # AuthCard (curtain), forms, fields
│   ├── room/                # RoomJoinCard
│   ├── start/               # LaptopIntro animation
│   ├── editor/              # Language / Theme / Mode selectors, Saved Code UI
│   ├── Editor.tsx           # CodeMirror wrapper (exposes getValue())
│   ├── OutputDrawer.tsx     # Output panel;  OutputSection.tsx renders results
│   ├── CopyIconSwap.tsx     # Copy -> Copied icon crossfade + tooltip label
│   ├── BrandLogo.tsx        # Theme-aware logo mark
│   └── ui/                  # shadcn/ui components
├── context
│   ├── ThemeContext.tsx     # theme + mode state, persistence, transitions
│   ├── AuthContext.tsx      # Supabase session, signingOut flag
│   └── RoomLaptopContext.tsx# the one shared laptop overlay for Start/Room
├── lib
│   ├── stageTransition.ts   # circular / rectangular View Transition reveals
│   └── remoteCursorMap.ts   # pure helper: keeps cursor offsets valid across a document change
├── services
│   ├── execution/           # Judge0 (primary) + JDoodle (fallback) providers
│   ├── savedCodeService.ts  # Saved Code persistence (Supabase)
│   └── roomService.ts
├── hooks                    # useEditorSetup, useCollaboration, useRemoteCursors,
│                            # useCopyFeedback, useLiquidGlass, ...
├── socket.ts                # Socket.io client
└── index.css                # design tokens: themes, modes, glass material
supabase
├── functions/execute-jdoodle  # JDoodle fallback Edge Function
└── migrations                 # database schema
```

## Getting started

Requirements: Node.js and npm.

```bash
git clone https://github.com/positron100/compile-palace.git
cd compile-palace
npm install
```

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<your Supabase anon/publishable key>
```

The JDoodle fallback runs in a Supabase Edge Function and needs these secrets set in your Supabase project (not in `.env`): `JDOODLE_CLIENT_ID` and `JDOODLE_CLIENT_SECRET`.

Run the dev server (default port 8080):

```bash
npm run dev
```

Other scripts: `npm run build`, `npm run build:dev`, `npm run preview`, `npm run lint`. Type-check with `npx tsc --noEmit`.

## How it fits together

- **Realtime:** the editor connects to a Socket.io server (see `src/socket.ts`) that relays code changes, presence and cursors within a room. Rooms are identified by the Room ID entered on the Join Room screen; the name typed there is the participant's display name for that session (it is separate from the signed-in account).
- **Sync model:** whole-document snapshots, last write wins. A local edit sends the full text (debounced ~500 ms); peers replace their document; the server keeps the room's latest text in memory and replays it to late joiners. There is no merge, so two people editing at the same instant can overwrite each other. An empty document is a valid state and propagates like any other.
- **Running code:** `Run` always compiles the live CodeMirror buffer and the currently selected language, never a saved snapshot.
- **Screen transitions:** Start to Auth to Join Room to Editor are choreographed animations. Notes on how they work, and the pitfalls found while building them, are in `claude_session_info.md`.

### Socket events

Event names live in `src/Actions.ts` (frontend) and `src/Actions.js` (backend); keep them in sync. Room membership is decided by the server; a client-supplied room, socket id, name or colour is ignored.

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `join` | client → server | `{ roomId, username }` | Registers the socket in the room; re-joining with a new name renames it |
| `joined` | server → room | `{ clients: [{ socketId, username, colorIndex, cursor? }], username, socketId }` | The full participant list; the frontend replaces its list with it |
| `leave` | client → server | `{ roomId }` | |
| `disconnected` | server → room | `{ socketId, username }` | Sent on leave or disconnect |
| `code-change` | client → server → peers | `{ roomId, code }` in, `{ code }` out | Full document; never echoed to the sender |
| `cursor-change` | client → server → peers | `{ line, ch }` in, `{ socketId, line, ch }` out | Sender identity comes from the socket |
| `sync-code` | client → server → one peer | `{ socketId, code }` | Legacy; the target must be in the sender's room |
| `server-error` | server → sender | `{ event, code }` | Validation and rate-limit rejections |

The frontend also emits `sync-request` / `sync-response`, which the server has no handler for; late joiners get the room snapshot instead. Adding fields to a payload is safe for older clients; changing existing ones is not.

## Deployment

- **Frontend (Vercel):** `vercel.json` rewrites unknown paths to `index.html` so refreshing or opening `/editor/<room>` directly does not 404. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PROJECT_ID` as Vercel environment variables. Pushing to `main` redeploys.
- **Backend (Render):** start command `node server.js` (or `npm start`), health check path `/health`. Render provides `PORT`. CORS allows `http://localhost:5173` and `https://compile-palace.vercel.app`; extra origins can be added with the comma-separated `ALLOWED_ORIGINS` variable. State is in memory, so run a single instance.
- **Supabase:** add the deployed frontend URL to Authentication → URL Configuration, otherwise signup confirmation links will not work.
- **Order:** when a change adds socket payload fields, deploy the backend first. Old frontends ignore the extra fields, but a new frontend against an old backend gets no cursors or colours.
- **Local backend:** the backend URL is hardcoded in `src/socket.ts`. To test against a local server, point it at your local URL temporarily and revert before committing.

## Testing

- Type-check: `npx tsc --noEmit`; production build: `npm run build`.
- Cursor position mapping (pure helper, no dependencies): `node --test src/lib/remoteCursorMap.test.mjs`.
- The backend has its own suite (`npm run test:server` in the `code-editor-` repo).
- There is no browser test runner. Realtime and UI behaviour has been checked by driving two browser sessions with Playwright; the handover notes what was and was not verified this way.

## Contributing notes

`claude_session_info.md` is the running engineering handover for this repo: what was built, root causes of past bugs, what was verified live and what was not, and testing caveats. Read it before touching the animation, transition, editor-scroll or realtime code.

## License

MIT
