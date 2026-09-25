# Compile Palace

Compile Palace is a real-time collaborative code editor. Sign in, create or join a room with a Room ID, and write code together; run it in the browser and see the output, save snippets to a per-user library, and switch between four colour themes and light/dark mode.

## Features

- **Real-time collaboration** over Socket.io: shared rooms, live code sync, presence (people list with avatars).
- **Code editor** built on CodeMirror 5, with syntax highlighting, a fixed line-number gutter, and custom overlay scrollbars.
- **Run code** through a single execution service: Judge0 is primary, with JDoodle (via a Supabase Edge Function) as a fallback when Judge0 is unavailable. The Output panel shows Passed / Failed / Running, compiler diagnostics, and run metadata.
- **Saved Code**: save, update, rename, delete and reopen snippets per user (Supabase), with animated list changes and an editor reveal when a snippet opens.
- **Auth** with Supabase: Login and Signup share one animated curtain, which continues into the Join Room screen.
- **Themes x modes**: four colour themes (Lavender, Forest, Sunset, Rainbow) crossed with Light and Dark. Theme and mode are independent, persisted separately in `localStorage` (`cp-theme`, `cp-mode`), and switched with the existing circular reveal transition.
- **Responsive**: a dedicated mobile layout for the editor (compact two-row top bar, drawer for Room Info, bottom-docked Output).
- **Frosted-glass design system**: shared glass tokens, liquid-glass hover, custom tooltips, and reduced-motion support.

## Tech stack

- Vite, React 18, TypeScript
- Tailwind CSS with shadcn/ui (Radix primitives), lucide-react icons
- CodeMirror 5
- Supabase (auth, database, Edge Functions)
- socket.io-client for the realtime layer (backend URL is set in `src/socket.ts`)
- React Router, TanStack Query, Sonner (toasts)

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
│   ├── BrandLogo.tsx        # Theme-aware logo mark
│   └── ui/                  # shadcn/ui components
├── context
│   ├── ThemeContext.tsx     # theme + mode state, persistence, transitions
│   ├── AuthContext.tsx      # Supabase session, signingOut flag
│   └── RoomLaptopContext.tsx# the one shared laptop overlay for Start/Room
├── lib/stageTransition.ts   # circular / rectangular View Transition reveals
├── services
│   ├── execution/           # Judge0 (primary) + JDoodle (fallback) providers
│   ├── savedCodeService.ts  # Saved Code persistence (Supabase)
│   └── roomService.ts
├── hooks                    # useEditorSetup, useCollaboration, useLiquidGlass, ...
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

- **Realtime:** the editor connects to a Socket.io server (see `src/socket.ts`) that relays code changes and presence within a room. Rooms are identified by the Room ID entered on the Join Room screen.
- **Running code:** `Run` always compiles the live CodeMirror buffer and the currently selected language, never a saved snapshot.
- **Screen transitions:** Start to Auth to Join Room to Editor are choreographed animations. Notes on how they work, and the pitfalls found while building them, are in `claude_session_info.md`.

## Contributing notes

`claude_session_info.md` is the running engineering handover for this repo: what was built, root causes of past bugs, what was verified live and what was not, and testing caveats. Read it before touching the animation, transition, or editor-scroll code.

## License

MIT
