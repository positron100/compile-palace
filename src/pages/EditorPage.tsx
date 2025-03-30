
import React, { useEffect, useRef, useState, useCallback } from "react";
import Client from "../components/Client";
import Editor from "../components/Editor";
import OutputDialog from "../components/OutputDialog";
import { initSocket } from "../socket";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import ACTIONS from "../Actions";
import { toast } from "sonner";
import { submitCode, languageOptions } from "../services/compileService";
import { Play, Copy, LogOut, WifiOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";

function EditorPage() {
  // socket initialization
  const socketRef = useRef(null);
  // for accessing the code in Editor
  const codeRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  const [clients, setClients] = useState([]);
  
  // States for compiler
  const [language, setLanguage] = useState(languageOptions[0]);
  const [stdin, setStdin] = useState("");
  const [outputDetails, setOutputDetails] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState(false);
  
  // Mobile UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Connection status message for debugging
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  
  // Function to handle compile button click
  const handleCompile = async () => {
    setIsCompiling(true);
    setOutputDetails(null);
    
    try {
      const result = await submitCode(
        language.id,
        codeRef.current,
        stdin
      );
      setOutputDetails(result);
      setShowOutput(true);
      toast.success("Code executed successfully!");
    } catch (error) {
      console.error("Compilation error:", error);
      toast.error("Error compiling code. Please try again.");
    } finally {
      setIsCompiling(false);
    }
  };

  // Initialize socket connection and set up event listeners
  const initSocketConnection = useCallback(async () => {
    try {
      setConnectionStatus("Connecting to server...");
      
      // Always attempt a fresh connection
      socketRef.current = await initSocket();
      setSocketConnected(true);
      setSocketError(false);
      setConnectionStatus("Connected to server");
      
      console.log("Socket connected, joining room:", roomId);
      
      // Ensure we have a username - default to Anonymous if not provided
      const username = location.state?.username || "Anonymous";
      console.log("Joining as:", username);
      
      // Join the room explicitly
      if (roomId) {
        socketRef.current.emit(ACTIONS.JOIN, {
          roomId,
          username,
        });
      }
      
      // Listen for joined event - make this more robust
      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
        console.log("JOINED event received", { clients, username, socketId });
        
        // Only show notification for others joining
        if (username !== location.state?.username && initialized) {
          toast.success(`${username} joined the room`);
        }
        
        // Update client list with the clients we received from server
        if (Array.isArray(clients)) {
          console.log("Setting clients:", clients);
          setClients(clients);
        } else {
          console.error("Clients is not an array:", clients);
          // Set empty array if clients is not an array
          setClients([]);
        }
        
        // If more than one client is in the room and we just joined,
        // request the latest code state
        if (Array.isArray(clients) && clients.length > 1 && !initialized) {
          console.log("Multiple users in room, requesting code sync");
          socketRef.current.emit(ACTIONS.SYNC_CODE, { roomId });
        }
      });
      
      // Listen for disconnect event
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        console.log("DISCONNECTED event received", { socketId, username });
        toast.success(`${username} left the room.`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });
      
      setInitialized(true);
    } catch (error) {
      console.error("Socket initialization failed:", error);
      setSocketError(true);
      setConnectionStatus("Connection failed, using local mode");
      toast.error("Failed to connect to server, using local mode");
      
      // Still set initialized to true so UI renders
      setInitialized(true);
      
      // If in local mode, create a fake client for UI demonstration
      if (!socketRef.current) {
        console.log("Creating mock client in local mode");
        // Create a fake client just for the UI
        const username = location.state?.username || "Anonymous";
        setClients([{ socketId: 'local-user', username }]);
      }
    }
  }, [location.state?.username, roomId]);

  // Set up socket connection on component mount
  useEffect(() => {
    if (!socketRef.current) {
      console.log("Initializing socket connection");
      initSocketConnection();
    }
    
    // Cleanup function - crucial for proper disconnection
    return () => {
      if (socketRef.current) {
        console.log("Cleaning up socket connection");
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off(ACTIONS.CODE_CHANGE);
        socketRef.current.off(ACTIONS.SYNC_CODE);
        
        // Explicitly leave the room before disconnecting
        if (roomId) {
          socketRef.current.emit(ACTIONS.LEAVE, { roomId });
        }
        
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initSocketConnection, roomId]);
  
  // Check if we need to redirect to home because of missing username
  useEffect(() => {
    // If initialized but no username provided, redirect to home
    if (initialized && !location.state?.username) {
      console.log("No username provided, redirecting to home");
      toast.error("Please enter a username to join a room");
      reactNavigator("/");
    }
  }, [initialized, location.state?.username, reactNavigator]);

  // Copy room ID to clipboard
  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId || "");
      toast.success("Room ID copied to clipboard");
    } catch (err) {
      toast.error("Could not copy Room ID");
      console.error(err);
    }
  }

  // Leave room and navigate to home
  async function leaveRoom() {
    if (socketRef.current) {
      // Explicitly leave the room before disconnecting
      if (roomId) {
        socketRef.current.emit(ACTIONS.LEAVE, { roomId });
      }
      socketRef.current.disconnect();
    }
    reactNavigator("/");
  }

  // Create sidebar content component to reuse in both desktop and mobile views
  const SidebarContent = () => (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-800 mb-1">Code Palace</h2>
        <p className="text-sm text-purple-500">Real-time code collaboration</p>
        
        {/* Connection status indicator */}
        <div className={`flex items-center gap-1 mt-2 text-xs ${socketError ? 'text-red-500' : 'text-green-600'}`}>
          {socketError ? (
            <>
              <WifiOff size={14} />
              <span>Using local mode</span>
            </>
          ) : (
            <>
              <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-amber-500'}`}></div>
              <span>{connectionStatus}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="mb-8">
        <h3 className="font-semibold text-gray-700 mb-3">Connected Users ({clients.length})</h3>
        {clients.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {clients.map((client) => (
              <Client 
                key={client.socketId} 
                username={client.username} 
                socketId={client.socketId} 
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-purple-400 italic">
            {initialized ? "No users connected yet..." : "Connecting..."}
          </div>
        )}
      </div>
      
      <div className="mt-auto space-y-3">
        <Button 
          variant="outline"
          className="w-full bg-white border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 flex items-center gap-2 transition-all"
          onClick={copyRoomId}
        >
          <Copy size={16} />
          Copy Room ID
        </Button>
        <Button 
          variant="outline"
          className="w-full bg-white border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-all"
          onClick={leaveRoom}
        >
          <LogOut size={16} />
          Leave Room
        </Button>
      </div>
    </>
  );

  // If username is not found and we've tried to initialize, redirect back to home page
  if (!location.state?.username && initialized) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-gradient-to-b from-white to-purple-50 p-6 flex-col border-r border-purple-100 shadow-sm">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar - Sheet component */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[85vw] sm:w-[350px] p-6 bg-gradient-to-b from-white to-purple-50">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Navbar with language selector and mobile menu button */}
        <div className="p-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Users size={20} />
            </Button>
            
            <Select
              value={language.id.toString()}
              onValueChange={(value) => {
                const selectedLang = languageOptions.find(
                  (lang) => lang.id === parseInt(value)
                );
                if (selectedLang) {
                  setLanguage(selectedLang);
                }
              }}
            >
              <SelectTrigger className="w-40 md:w-60 bg-white border-purple-200 focus:ring-purple-400">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent className="bg-white border-purple-100">
                {languageOptions.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id.toString()}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-purple-600 font-medium">
            <span className="hidden sm:inline">Room: </span>
            <span className="text-purple-800">{roomId}</span>
          </div>
        </div>
        
        {/* Editor with run button */}
        <div className="flex-1 relative overflow-hidden">
          <Editor
            socketRef={socketRef}
            roomId={roomId || ""}
            language={language}
            onCodeChange={(code) => {
              codeRef.current = code;
            }}
          />
          
          <Button
            onClick={handleCompile}
            disabled={isCompiling}
            className="absolute bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white w-12 h-12 rounded-lg shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-10"
          >
            {isCompiling ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"/>
            ) : (
              <Play size={20} />
            )}
          </Button>
        </div>

        {/* Animated squares section for the bottom area - Matching home page animation */}
        <div className="h-16 md:h-32 relative overflow-hidden bg-gradient-to-b from-purple-50 to-white">
          {/* Animated squares - using the same animation as login page */}
          <ul className="squares">
            {Array.from({ length: 10 }).map((_, idx) => (
              <li
                key={idx}
                style={{
                  "--i": Math.random() * 10 + 1,
                  "--j": Math.random() * 7 + 1,
                } as React.CSSProperties}
                className="bg-indigo-500/20 absolute list-none rounded-lg animate-float"
              />
            ))}
          </ul>
        </div>
      </div>
      
      {/* Output Dialog */}
      <OutputDialog 
        open={showOutput} 
        onOpenChange={setShowOutput} 
        outputDetails={outputDetails} 
      />
    </div>
  );
}

export default EditorPage;
