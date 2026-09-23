
import React, { useEffect, useRef, useState, useCallback } from "react";
import Client from "../components/Client";
import Editor, { EditorHandle } from "../components/Editor";
import OutputDrawer from "../components/OutputDrawer";
import { initSocket, disconnectSocket } from "../socket";
import {
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { useStageTransitionNavigate } from "@/hooks/use-stage-transition-navigate";
import { startEditorRevealTransition } from "@/lib/stageTransition";
import ACTIONS from "../Actions";
import { toast } from "sonner";
import { submitCode, languageOptions } from "../services/compileService";
import { Play, Copy, LogOut, Users, Menu, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, Loader2, Pin, PinOff, PanelBottom, PanelRight, WandSparkles, Hash, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { LanguageDropdown } from "@/components/editor/LanguageDropdown";
import { ModernTooltip } from "@/components/ModernTooltip";
import { InlineSaveForm } from "@/components/editor/InlineSaveForm";
import { SavedCodeHistory } from "@/components/editor/SavedCodeHistory";
import { useSavedCode } from "@/hooks/use-saved-code";
import { createSavedCode, updateSavedCode, normalizeName, DuplicateNameError, SavedCodeSession } from "@/services/savedCodeService";
import userService from "../services/userService";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  saveRoomToDatabase,
  loadRoomFromDatabase,
  addParticipantToRoom,
  removeParticipantFromRoom,
  checkIfRoomEmpty
} from "../services/roomService";
import { debounce } from 'lodash';
import { useLiquidGlass } from "@/hooks/use-liquid-glass";
import "./EditorPage.css";

function EditorPage() {
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const editorHandleRef = useRef<EditorHandle>(null);
  const editorSurfaceRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useStageTransitionNavigate();
  const [clients, setClients] = useState([]);

  const [language, setLanguage] = useState(languageOptions[0]);
  const [stdin, setStdin] = useState("");
  const [outputDetails, setOutputDetails] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"normal" | "floating">("normal");
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [runJustSucceeded, setRunJustSucceeded] = useState(false);
  const [outputLayout, setOutputLayout] = useState<"bottom" | "right">("bottom");
  const [outputExpanded, setOutputExpanded] = useState(false);
  const wasOutputOpenRef = useRef(false);

  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [initialCode, setInitialCode] = useState<string | null>(null);
  const hasJoinedRef = useRef(false);
  const signingOutRef = useRef(false);

  // Bug fix: was `Math.random()` inline in render (EditorPage re-renders on
  // every state change — output, sidebar, run, saved-code…), which fed
  // straight into --i/--j (index.css), and those custom properties drive
  // each cube's position AND animation-duration. Every unrelated render was
  // silently reshuffling/teleporting/re-timing the whole field. Computed
  // once per EditorPage mount instead, so the cubes' identity/phase/position
  // survive every interaction.
  const cubeConfigs = useRef(
    Array.from({ length: 16 }).map(() => ({
      i: Math.random() * 10 + 1,
      j: Math.random() * 7 + 1,
    }))
  ).current;

  const username = profile?.name || location.state?.username || user?.email || "Anonymous";
  const [userCount, setUserCount] = useState(1);
  
  const lastClientsUpdateRef = useRef(Date.now());
  const clientsUpdateThrottleMs = 2000;

  // Fetch profile
  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setProfile(data);
        });
    }
  }, [user]);

  // Add participant to room when joining (once per mount, not once per
  // profile/user object identity change from repeated auth state events)
  useEffect(() => {
    if (user && roomId && profile && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      addParticipantToRoom(roomId, user.id, profile.name);
    }
  }, [user, roomId, profile]);

  // Load existing room code from database
  useEffect(() => {
    if (roomId && user) {
      loadRoomFromDatabase(roomId).then((roomData) => {
        if (roomData && roomData.code && codeRef.current !== roomData.code) {
          codeRef.current = roomData.code;
          setInitialCode(roomData.code);
          if (roomData.language) {
            const lang = languageOptions.find(l => l.name.toLowerCase() === roomData.language.toLowerCase());
            if (lang) setLanguage(lang);
          }
        }
      });
    }
  }, [roomId, user]);

  const handleCompile = async () => {
    setIsCompiling(true);
    setOutputDetails(null);
    // Opens (collapsed) the instant Run is clicked, not once the real
    // request resolves — the "Running…" state has to actually be visible
    // for the output panel's own execution animation to mean anything.
    setShowOutput(true);

    try {
      const result = await submitCode(
        language.id,
        codeRef.current,
        stdin
      );
      setOutputDetails(result);
      toast.success("Code executed successfully!");
      setRunJustSucceeded(true);
      setTimeout(() => setRunJustSucceeded(false), 1200);
    } catch (error) {
      toast.error("Error compiling code. Please try again.");
    } finally {
      setIsCompiling(false);
    }
  };

  // Debounced save function
  const debouncedSave = useCallback(
    debounce((code: string) => {
      if (roomId && user && code) {
        saveRoomToDatabase(roomId, code, language.name);
      }
    }, 3000),
    [roomId, user, language]
  );

  const updateClientsList = useCallback((newClients = [], append = false) => {
    const now = Date.now();
    if (now - lastClientsUpdateRef.current < clientsUpdateThrottleMs) {
      return;
    }
    
    lastClientsUpdateRef.current = now;
    
    setClients(prevClients => {
      let updatedClients = append ? [...prevClients] : [];
      
      newClients.forEach(newClient => {
        if (!newClient.username) return;
        
        const existingClientIndex = updatedClients.findIndex(
          client => client.username === newClient.username
        );
        
        if (existingClientIndex >= 0) {
          updatedClients[existingClientIndex] = {
            ...updatedClients[existingClientIndex],
            ...newClient,
            lastSeen: now
          };
        } else {
          updatedClients.push({
            ...newClient,
            lastSeen: now
          });
        }
      });
      
      const currentUserExists = updatedClients.some(
        client => client.username === username
      );
      
      if (!currentUserExists) {
        updatedClients.push({ 
          socketId: 'local-user', 
          username: username,
          lastSeen: now
        });
      }
      
      updatedClients.sort((a, b) => a.username.localeCompare(b.username));
      
      // Update user count when clients change
      setUserCount(updatedClients.length);
      
      return updatedClients;
    });
  }, [username]);

  // Initialize socket connection
  useEffect(() => {
    if (!roomId) return;
    
    setConnectionStatus("Connecting to server...");
    
    try {
      // Initialize Socket.IO connection
      const socket = initSocket();
      socketRef.current = socket;
      
      setSocketConnected(true);
      setConnectionStatus("Connected to server");
      
      // Handle socket connection events
      socket.on('connect', () => {
        setSocketConnected(true);
        setSocketError(false);
        setConnectionStatus("Connected");
        
        // Join room once connected
        socket.emit(ACTIONS.JOIN, {
          roomId,
          username
        });
        
        // Track user in local service
        userService.trackUserPresence(roomId, username);
      });
      
      socket.on('connect_error', (err) => {
        setSocketError(true);
        setConnectionStatus("Connection failed");
        toast.error("Failed to connect to server");
      });
      
      socket.on('disconnect', () => {
        setSocketConnected(false);
        setConnectionStatus("Disconnected");
      });
      
      // Handle room events
      socket.on(ACTIONS.JOINED, ({ clients, username: joinedUser, socketId }) => {
        if (joinedUser !== username) {
          toast.success(`${joinedUser} joined the room`);
        }
        
        updateClientsList(clients);
        setUserCount(clients.length);
      });
      
      socket.on(ACTIONS.DISCONNECTED, ({ socketId, username: leftUser }) => {
        toast.info(`${leftUser} left the room`);
        
        setClients(prev => {
          const updatedClients = prev.filter(client => client.socketId !== socketId);
          // Update user count when a user leaves
          setUserCount(updatedClients.length);
          return updatedClients;
        });
      });
      
      setInitialized(true);
      
      // Cleanup function
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        
        disconnectSocket();
      };
    } catch (error) {
      setSocketError(true);
      setConnectionStatus("Connection failed");
      setInitialized(true);
      toast.error("Failed to connect to server");
      
      // Try to get users from local service
      const roomUsers = userService.getRoomUsers(roomId);
      if (roomUsers.length > 0) {
        updateClientsList(roomUsers);
      }
      
      return () => {};
    }
  }, [roomId, username, updateClientsList]);

  useEffect(() => {
    if (initialized && !user && !authLoading) {
      toast.error("Please sign in to join a room");
      reactNavigator("/auth", { shape: 'circle' });
    }
  }, [initialized, user, authLoading, reactNavigator]);

  // Cleanup when leaving the room
  useEffect(() => {
    return () => {
      if (user && roomId && codeRef.current) {
        // Save code to database when leaving
        saveRoomToDatabase(roomId, codeRef.current, language.name);
        
        // Mark participant as left
        removeParticipantFromRoom(roomId, user.id);
        
        // Check if room is empty and save final state
        setTimeout(() => {
          checkIfRoomEmpty(roomId).then((isEmpty) => {
            if (isEmpty && codeRef.current) {
              saveRoomToDatabase(roomId, codeRef.current, language.name);
            }
          });
        }, 1000);
      }
    };
  }, [user, roomId, language]);

  // A fresh run (closed -> open transition) always opens collapsed, even if
  // a previous run had been left expanded.
  useEffect(() => {
    if (showOutput && !wasOutputOpenRef.current) setOutputExpanded(false);
    wasOutputOpenRef.current = showOutput;
  }, [showOutput]);

  // Switching NORMAL <-> FLOATING never shows both representations at once
  // and never invents a new animation for the switch: it closes whichever
  // one is open (playing that mode's own existing close transition), waits
  // for it to finish, swaps the DOM structure while both are fully closed,
  // then reopens in the new mode (playing that mode's own open transition).
  const sidebarSwitchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const toggleSidebarMode = () => {
    const wasOpen = sidebarOpen;
    clearTimeout(sidebarSwitchTimerRef.current);
    if (!wasOpen) {
      setSidebarMode((m) => (m === "normal" ? "floating" : "normal"));
      return;
    }
    setSidebarOpen(false);
    sidebarSwitchTimerRef.current = setTimeout(() => {
      setSidebarMode((m) => (m === "normal" ? "floating" : "normal"));
      // The new mode mounts fresh DOM nodes (rail+panel <-> single resizing
      // aside) — a plain synchronous setSidebarOpen(true) right after would
      // bake "already open" into that very first paint, so the browser has
      // no "before" frame to transition from and it just pops open instead
      // of playing its unfold animation. Two rAFs (same trick AuthCard's
      // curtain uses) guarantees a real painted closed frame first.
      requestAnimationFrame(() => requestAnimationFrame(() => setSidebarOpen(true)));
    }, 260);
  };

  const savedCode = useSavedCode(user?.id);
  // Section 4/5 — the active saved-session identity. Set on Open, cleared
  // on New Code. Whether Save updates the existing row or prompts to
  // create a new one hinges entirely on this being set or null.
  const [currentSavedCodeId, setCurrentSavedCodeId] = useState<string | null>(null);

  // Section 2/10 — Room Info's floating mode must play its OWN existing
  // close animation (the same one `setSidebarOpen(false)` already triggers
  // manually) before the editor reveal starts, never an instant unmount.
  // Docked/normal mode has no such overlay to clear, so it skips straight
  // to the reveal (section 2's own explicit "preserve existing behavior"
  // instruction for that mode). 260ms mirrors .editor-panel's own transform
  // transition duration (EditorPage.css) — the exact number toggleSidebarMode
  // above already uses for the same reason.
  const runEditorReveal = (applyChange: () => void) => {
    const fire = () => {
      if (editorSurfaceRef.current) {
        startEditorRevealTransition(editorSurfaceRef.current, applyChange);
      } else {
        applyChange();
      }
    };
    if (sidebarMode === "floating" && sidebarOpen) {
      setSidebarOpen(false);
      setTimeout(fire, 260);
    } else {
      fire();
    }
  };

  // Section 4 — Save is either an UPDATE (an active saved session) or a
  // CREATE (nothing active, or explicitly "New Code" was used since). Only
  // the create path prompts for a name / can hit a duplicate-name rejection;
  // update silently keeps the existing name/id.
  const handleSaveCode = async (name: string): Promise<string | void> => {
    if (!user) return;
    const normalized = normalizeName(name);
    const clashes = savedCode.items.some((i) => normalizeName(i.name) === normalized);
    if (clashes) return "A saved code with this name already exists.";
    try {
      const item = await createSavedCode(user.id, name, codeRef.current || "", language.name);
      savedCode.addItem(item);
      setCurrentSavedCodeId(item.id);
      toast.success("Code saved");
    } catch (err) {
      if (err instanceof DuplicateNameError) return err.message;
      console.error("Error saving code:", err);
      toast.error("Could not save code — try again.");
    }
  };

  // Section 4/7 — the icon-only top-bar Save control is only ever rendered
  // (see JSX below) when currentSavedCodeId is already set; a null id
  // renders <InlineSaveForm> instead, so there's no branch to a naming flow
  // here at all — this always updates the active session in place.
  const handleSaveClick = async () => {
    if (!currentSavedCodeId) return;
    try {
      const updated = await updateSavedCode(currentSavedCodeId, codeRef.current || "", language.name);
      savedCode.updateItem(currentSavedCodeId, { code: updated.code, language: updated.language, updated_at: updated.updated_at });
      toast.success("Code updated");
    } catch (err) {
      console.error("Error updating saved code:", err);
      toast.error("Could not update — try again.");
    }
  };

  // Loading a saved snapshot into the live editor — not a new room, not a
  // room-identity change, not a broadcast-suppressing bypass: it goes
  // through Editor's own loadCode (normal setValue + change event), so the
  // existing collaboration sync picks it up exactly like a real edit would.
  const handleOpenSavedCode = (item: SavedCodeSession) => {
    const match = languageOptions.find((l) => l.name === item.language);
    const applyChange = () => {
      if (match) setLanguage(match);
      editorHandleRef.current?.loadCode(item.code);
      setCurrentSavedCodeId(item.id);
    };
    runEditorReveal(applyChange);
    toast.success(`Loaded "${item.name}"`);
  };

  // Section 3/5 — "New Code": same reveal mechanism as Open, empty content
  // instead of a saved snapshot, language left as-is (no existing UX reason
  // to reset it), and the active saved-session identity cleared so a
  // subsequent Save creates a new row instead of overwriting whatever was
  // open before.
  const handleNewCode = () => {
    const applyChange = () => {
      editorHandleRef.current?.loadCode("");
      setCurrentSavedCodeId(null);
    };
    runEditorReveal(applyChange);
  };

  // Section 3 — deleting the CURRENTLY OPEN saved session. SavedCodeHistory
  // calls this only when the deleted item's id matches currentSavedCodeId
  // (it already knows both); a delete of any other item never reaches here,
  // so the editor is left alone exactly as section 3's "not the active one"
  // case requires. Same reveal mechanism/empty-content path as New Code —
  // deleting the active session really is "become a new unsaved session".
  const handleActiveSessionDeleted = () => {
    const applyChange = () => {
      editorHandleRef.current?.loadCode("");
      setCurrentSavedCodeId(null);
    };
    runEditorReveal(applyChange);
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId || "");
      setRoomIdCopied(true);
      setTimeout(() => setRoomIdCopied(false), 1500);
    } catch (err) {
      toast.error("Could not copy Room ID");
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeRef.current || "");
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch (err) {
      toast.error("Could not copy code");
    }
  };

  // Socket disconnect + code save/participant cleanup shared by "Leave Room"
  // and "Sign Out" — they differ only in where they end up afterward.
  const cleanupRoomConnection = async () => {
    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.LEAVE, { roomId });
      socketRef.current.disconnect();
    }

    if (user && roomId && codeRef.current) {
      await saveRoomToDatabase(roomId, codeRef.current, language.name);
      await removeParticipantFromRoom(roomId, user.id);
    }
  };

  const leaveRoom = async () => {
    await cleanupRoomConnection();
    // Editor -> Room: same square/band/full-viewport family, played in
    // reverse — the editor's content shrinks away, uncovering the room.
    reactNavigator("/", { shape: 'rect', direction: 'reverse' });
  };

  const handleSignOut = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Same double-fire guard as Index.tsx's Room sign-out: a fast
    // double-click's second signOut() call fails with "Auth session
    // missing!" once the first has already cleared the session.
    if (signingOutRef.current) return;
    signingOutRef.current = true;

    const r = e.currentTarget.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    await cleanupRoomConnection();
    const { error } = await supabase.auth.signOut();
    // Reset unconditionally — see Index.tsx's Room sign-out for why a
    // guard that only clears on the error path can get stuck permanently.
    signingOutRef.current = false;
    if (error) {
      if (!/auth session missing/i.test(error.message)) {
        toast.error(error.message);
        return;
      }
    }
    // AuthContext's SIGNED_OUT event is authoritative for auth state; this
    // navigate only decides where the now-unauthenticated app lands — back
    // to the starting screen, same as Index.tsx's Room sign-out.
    reactNavigator("/", { shape: 'circle', direction: 'reverse', origin, replace: true });
  };

  const connectionLabel = socketError ? "Disconnected" : socketConnected ? "Connected" : "Connecting";
  const connectionDotClass = socketError
    ? "editor-chip__dot--error"
    : socketConnected
    ? "editor-chip__dot--connected"
    : "editor-chip__dot--connecting";

  // A single reusable liquid-glass icon/text button — every rail icon,
  // copy/leave/sign-out control and output utility renders through this so
  // they all share one interaction implementation (section 5's "do not
  // create separate styles per control").
  // forwardRef so ModernTooltip's Radix trigger (asChild) can attach its own
  // ref for positioning alongside the magnetic-hover ref this already uses —
  // without it, Radix logs "Function components cannot be given refs" and
  // can't measure the trigger to place the tooltip.
  const LiquidButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className = "", children, ...props }, forwardedRef) => {
      const liquid = useLiquidGlass<HTMLButtonElement>({ strength: 4 });
      return (
        <button
          ref={(node) => {
            liquid.ref.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          type="button"
          onMouseMove={liquid.onMouseMove}
          onMouseLeave={liquid.onMouseLeave}
          className={`cp-liquid ${className}`}
          {...props}
        >
          {children}
        </button>
      );
    }
  );

  // Collapsed icon content — the permanent floating-mode rail, AND normal
  // mode's own collapsed state (same icons, same behavior, either context).
  const RailIcons = () => (
    <>
      <div className="editor-rail__section">
        <ModernTooltip content="Open Room Panel" side="right">
          <LiquidButton
            className="editor-rail__icon-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open room panel"
            aria-expanded={false}
          >
            <ChevronRight size={16} />
          </LiquidButton>
        </ModernTooltip>
      </div>
      <div className="editor-rail__section" title={connectionLabel}>
        <span className={`editor-chip__dot ${connectionDotClass}`} />
      </div>
      <div className="editor-rail__section" title={`${clients.length} in room`}>
        <div className="flex flex-col items-center gap-1 text-xs opacity-70">
          <Users size={16} />
          {clients.length}
        </div>
      </div>
      <div className="editor-rail__section" style={{ flex: 1 }} />
      <div className="editor-rail__section editor-rail__actions">
        <ModernTooltip content="Copy Room ID" side="right">
          <LiquidButton className="editor-rail__icon-btn" onClick={copyRoomId} aria-label="Copy room ID">
            {roomIdCopied ? <Check size={15} /> : <Hash size={15} />}
          </LiquidButton>
        </ModernTooltip>
        <ModernTooltip content="Leave Room" side="right">
          <LiquidButton className="editor-rail__icon-btn text-red-600" onClick={leaveRoom} aria-label="Leave Room">
            <LogOut size={15} />
          </LiquidButton>
        </ModernTooltip>
        <ModernTooltip content="Sign Out" side="right">
          <LiquidButton className="editor-rail__icon-btn opacity-75" onClick={handleSignOut} aria-label="Sign Out">
            <LogOut size={15} />
          </LiquidButton>
        </ModernTooltip>
      </div>
    </>
  );

  // Full room detail content — the floating desktop panel, normal mode's
  // expanded state, and the mobile Sheet all render this same content.
  // `showControls` hides the close/mode-toggle row for the mobile Sheet,
  // which already has its own dismiss affordance and no floating/normal
  // distinction to switch between.
  //
  // Called as a plain function below (`{SidebarPanelContent({...})}`), NOT
  // as a JSX element (`<SidebarPanelContent />`) — this was the actual root
  // cause of "saved-code insert/delete has no visible animation": since this
  // is redefined on every EditorPage render, using it as a JSX tag made
  // React see a brand-new component TYPE each render, which unmounts and
  // fully recreates its entire subtree (confirmed live: the saved-code
  // `<ul>` was a different DOM node before vs. after every single save/
  // delete) — discarding all the `data-anim` transition state this file's
  // CSS (EditorPage.css `.editor-history__row`) depends on before it could
  // ever animate. Calling it as a plain function just inlines its returned
  // elements into EditorPage's own render output, so React reconciles them
  // by position/key like any other JSX in this file, and existing DOM nodes
  // (and their in-flight CSS transitions) survive across re-renders.
  // `showControls` doubles as "this render is inside the geometry-animated
  // desktop panel/aside" — the mobile Sheet (showControls=false) uses Radix's
  // own open animation and never wants the extra content-defer wrapper.
  const SidebarPanelContent = ({ showControls = false }: { showControls?: boolean }) => (
    <div className={showControls ? "editor-sidebar__content" : "contents"}>
      <div className="editor-sidebar__section">
        <div className="editor-sidebar__heading">Room Info</div>
        {showControls && (
          <div className="flex items-center justify-between mb-1.5">
            <ModernTooltip content="Close Room Panel">
              <LiquidButton
                className="editor-rail__icon-btn"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close room panel"
                aria-expanded={true}
              >
                <ChevronLeft size={16} />
              </LiquidButton>
            </ModernTooltip>
            <ModernTooltip content={sidebarMode === "floating" ? "Dock Sidebar" : "Undock Sidebar"}>
              <LiquidButton
                className="editor-rail__icon-btn"
                onClick={toggleSidebarMode}
                aria-label={sidebarMode === "floating" ? "Dock sidebar into the layout" : "Undock sidebar to float"}
              >
                {sidebarMode === "floating" ? <Pin size={15} /> : <PinOff size={15} />}
              </LiquidButton>
            </ModernTooltip>
          </div>
        )}
        <div className="editor-sidebar__meta">
          <div className="editor-room-id">
            <span className="editor-room-id__value">{roomId}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className="editor-chip" style={{ paddingLeft: 0, height: "1.5rem" }}>
            <span className={`editor-chip__dot ${connectionDotClass}`} />
            <span className="opacity-70 text-xs">{connectionLabel}</span>
          </span>
          <ModernTooltip content="Copy Room ID">
            <LiquidButton
              className="editor-copy-btn"
              style={{ width: "auto", margin: 0, height: "1.75rem", padding: "0 0.625rem" }}
              onClick={copyRoomId}
              aria-label="Copy room ID"
            >
              {roomIdCopied ? <Check size={13} /> : <Hash size={13} />}
            </LiquidButton>
          </ModernTooltip>
        </div>
      </div>

      <div className="editor-sidebar__section editor-sidebar__section--people">
        <div className="editor-sidebar__label">People {clients.length}</div>
        {clients.length > 0 ? (
          <div className="editor-roster">
            {clients.map((client) => (
              <Client
                key={client.socketId || client.username}
                username={client.username}
                socketId={client.socketId}
                isYou={client.username === username}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm opacity-50 italic">
            {initialized ? "No users connected yet…" : "Connecting…"}
          </div>
        )}
      </div>

      <SavedCodeHistory
        items={savedCode.items}
        status={savedCode.status}
        onRetry={savedCode.refresh}
        onUpdateItem={savedCode.updateItem}
        onRemoveItem={savedCode.removeItem}
        onOpenItem={handleOpenSavedCode}
        onNewCode={handleNewCode}
        currentSavedCodeId={currentSavedCodeId}
        onActiveSessionDeleted={handleActiveSessionDeleted}
      />

      <div className="editor-sidebar__section editor-sidebar__actions">
        <div className="editor-sidebar__label">Room Actions</div>
        <LiquidButton className="editor-action-btn text-red-600" onClick={leaveRoom}>
          <LogOut size={15} />
          Leave Room
        </LiquidButton>
        <LiquidButton className="editor-action-btn opacity-75" onClick={handleSignOut}>
          <LogOut size={15} />
          Sign Out
        </LiquidButton>
      </div>
    </div>
  );

  const RunButton = () => {
    const liquid = useLiquidGlass<HTMLButtonElement>({ strength: 5 });
    return (
      <ModernTooltip content="Run Code">
        <Button
          ref={liquid.ref}
          onMouseMove={liquid.onMouseMove}
          onMouseLeave={liquid.onMouseLeave}
          onClick={handleCompile}
          disabled={isCompiling}
          data-state={runJustSucceeded ? "success" : undefined}
          className="editor-run-btn cp-pill cp-lift bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-4 gap-1.5"
        >
          {isCompiling ? (
            <Loader2 size={15} className="animate-spin" />
          ) : runJustSucceeded ? (
            <Check size={15} />
          ) : (
            <Play size={15} />
          )}
          <span className="hidden sm:inline">{runJustSucceeded ? "Done" : "Run"}</span>
        </Button>
      </ModernTooltip>
    );
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"/>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (!location.state?.username && initialized && !profile) {
    return <Navigate to="/" />;
  }

  return (
    <div className="editor-shell cp-atmosphere text-gray-800">
      <header className="editor-topbar glass-secondary">
        <ModernTooltip content="Open Room Panel" side="bottom">
          <button
            type="button"
            className="cp-liquid md:hidden inline-flex items-center justify-center h-8 w-8 rounded-full opacity-75 hover:opacity-100"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open room panel"
          >
            <Menu size={20} />
          </button>
        </ModernTooltip>

        <span className="editor-topbar__brand">Code Palace</span>

        <LanguageDropdown
          options={languageOptions}
          value={language}
          onChange={setLanguage}
        />

        <div className="editor-topbar__right">
          <div className="editor-topbar__group">
            <span className="editor-chip glass-subtle">
              <span className={`editor-chip__dot ${connectionDotClass}`} />
              <span className="hidden sm:inline">{connectionLabel}</span>
            </span>
            <span className="editor-chip editor-chip--quiet">
              <span className="hidden sm:inline">Room</span>
              <span className="font-mono">{roomId}</span>
            </span>
            <span className="editor-chip editor-chip--quiet">
              <Users size={13} className="opacity-70" />
              {userCount}
            </span>
          </div>
          <div className="editor-topbar__group">
            <ModernTooltip content="Copy Code">
              <LiquidButton
                className="editor-rail__icon-btn"
                onClick={copyCode}
                aria-label="Copy code"
              >
                {codeCopied ? <Check size={15} /> : <Copy size={15} />}
              </LiquidButton>
            </ModernTooltip>
            {currentSavedCodeId ? (
              <ModernTooltip content="Update Saved Code">
                <LiquidButton
                  className="editor-rail__icon-btn"
                  onClick={handleSaveClick}
                  aria-label="Update saved code"
                >
                  <Save size={15} />
                </LiquidButton>
              </ModernTooltip>
            ) : (
              <InlineSaveForm onSubmit={handleSaveCode} />
            )}
            <ModernTooltip content="Format Code">
              <LiquidButton
                className="editor-rail__icon-btn"
                onClick={() => editorHandleRef.current?.formatCode()}
                aria-label="Format code"
              >
                <WandSparkles size={15} />
              </LiquidButton>
            </ModernTooltip>
            <ModernTooltip content={outputLayout === "bottom" ? "Move Output Beside Editor" : "Move Output Below Editor"}>
              <LiquidButton
                className="editor-rail__icon-btn editor-output__layout-toggle"
                onClick={() => setOutputLayout((v) => (v === "bottom" ? "right" : "bottom"))}
                aria-label={outputLayout === "bottom" ? "Output beside editor" : "Output below editor"}
              >
                {outputLayout === "bottom" ? <PanelRight size={15} /> : <PanelBottom size={15} />}
              </LiquidButton>
            </ModernTooltip>
          </div>
          <RunButton />
        </div>
      </header>

      <div className="editor-main">
        {/* Same ambient shapes/animation as the Start screen's own atmosphere
            (index.css's `.squares`/`.animate-float`, not a second
            implementation). Sized to `.editor-main` — near-full-viewport,
            like the Start screen's own `min-h-screen` wrapper — because
            `.squares li` positions itself with `vh`/`vw` units designed for
            a full-viewport container; nesting this inside the much smaller
            `.editor-surface` card (the previous, broken placement) meant
            most of each cube's computed position fell outside that small
            clipped box and was never visible, not just faint. Negative
            z-index puts it behind every sibling here regardless of which
            of them are positioned vs. static, so it can't end up drawn over
            the sidebar/output by stacking-order accident. */}
        <div className="editor-cube-field" aria-hidden="true">
          <ul className="squares">
            {cubeConfigs.map((cfg, idx) => (
              <li
                key={idx}
                style={{
                  "--i": cfg.i,
                  "--j": cfg.j,
                } as React.CSSProperties}
                className="bg-indigo-500/45 absolute list-none rounded-lg animate-float"
              />
            ))}
          </ul>
        </div>

        {sidebarMode === "floating" ? (
          <>
            {/* Floating mode replaces the entire compact rail with just this
                one tiny trigger — no rail representation coexists with the
                panel at all, collapsed or open. */}
            <ModernTooltip content={sidebarOpen ? "Close Room Panel" : "Open Room Panel"} side="right">
              <LiquidButton
                className="editor-floating-trigger hidden md:inline-flex"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? "Close room panel" : "Open room panel"}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
              </LiquidButton>
            </ModernTooltip>
            <div className="editor-panel hidden md:flex" data-open={sidebarOpen} aria-hidden={!sidebarOpen}>
              {SidebarPanelContent({ showControls: true })}
            </div>
          </>
        ) : (
          <aside className="editor-sidebar-normal glass-secondary hidden md:flex" data-collapsed={!sidebarOpen}>
            {sidebarOpen ? SidebarPanelContent({ showControls: true }) : <RailIcons />}
          </aside>
        )}

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[85vw] sm:w-[350px] p-0 glass-secondary flex flex-col">
            <SheetTitle className="sr-only">Room panel</SheetTitle>
            <SheetDescription className="sr-only">Room ID, connection status, participants and room actions</SheetDescription>
            {SidebarPanelContent({})}
          </SheetContent>
        </Sheet>

        <div
          className="editor-workspace"
          data-output-layout={outputLayout}
          data-output-expanded={outputExpanded}
        >
          <div className="editor-surface" ref={editorSurfaceRef}>
            <div className="editor-surface__gradient" aria-hidden="true" />
            <Editor
              ref={editorHandleRef}
              socketRef={socketRef}
              roomId={roomId || ""}
              language={language}
              username={username}
              initialCode={initialCode}
              onCodeChange={(code) => {
                codeRef.current = code;
                debouncedSave(code);
              }}
            />
          </div>

          <OutputDrawer
            open={showOutput}
            expanded={outputExpanded}
            onExpandedChange={setOutputExpanded}
            onClose={() => setShowOutput(false)}
            outputDetails={outputDetails}
            isCompiling={isCompiling}
            layout={outputLayout}
            language={language.name}
            stdin={stdin}
          />
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
