import React, { useEffect, useRef, useState, useCallback } from "react";
import Client from "../components/Client";
import Editor from "../components/Editor";
import OutputDialog from "../components/OutputDialog";
import { initSocket } from "../socket";
import ConnectionStatus from "../components/ConnectionStatus";
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
import pusher from "../pusher";

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
  const [pusherChannel, setPusherChannel] = useState(null);
  
  // Store username for this session
  const username = location.state?.username || "Anonymous";
  const [subscriptionCount, setSubscriptionCount] = useState(1);
  
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

  // Manage client list for UI display
  const updateClientsList = useCallback((count) => {
    if (!count || count < 1) count = 1;
    
    // We'll keep our own user at position 0
    const updatedClients = [];
    
    // Add current user
    updatedClients.push({ 
      socketId: 'local-user', 
      username: username 
    });
    
    // Add other users with proper sequential naming
    for (let i = 1; i < count; i++) {
      const otherUser = {
        socketId: `user-${i}`,
        username: `User ${i}`
      };
      
      // Don't add duplicates
      if (!updatedClients.some(c => c.socketId === otherUser.socketId)) {
        updatedClients.push(otherUser);
      }
    }
    
    setClients(updatedClients);
  }, [username]);

  // Initialize Pusher connection
  const initPusher = useCallback(() => {
    if (!roomId) return;
    
    // Use regular channel for code collaboration
    const collabChannelName = `collab-${roomId}`;
    
    setConnectionStatus("Connecting to Pusher...");
    
    try {
      // Subscribe to regular channel for code updates
      const collabChannel = pusher.subscribe(collabChannelName);
      
      // Handle successful connection
      pusher.connection.bind('connected', () => {
        console.log("Connected to Pusher");
        setSocketConnected(true);
        setSocketError(false);
        setConnectionStatus("Connected to Pusher");
        
        // Initialize with at least our own user
        updateClientsList(1);
      });
      
      // Handle subscription count events for the collab channel
      collabChannel.bind('pusher:subscription_count', (data) => {
        console.log("Subscription count updated:", data);
        
        // If there's subscription_count, we can use it to approximate users
        if (data && data.subscription_count) {
          setSubscriptionCount(data.subscription_count);
          updateClientsList(data.subscription_count);
        }
      });
      
      // Listen for client code change events
      collabChannel.bind(ACTIONS.CLIENT_CODE_CHANGE, (data) => {
        // Update local code reference
        if (data && data.code) {
          codeRef.current = data.code;
        }
      });
      
      // Store channel references
      setPusherChannel(collabChannel);
      setInitialized(true);
      
      return collabChannel;
    } catch (error) {
      console.error("Pusher initialization error:", error);
      setSocketError(true);
      setConnectionStatus("Pusher connection failed");
      setInitialized(true);
      toast.error("Failed to connect to Pusher, using local mode");
      
      // Create a fake client for UI demonstration
      updateClientsList(1);
      return null;
    }
  }, [roomId, updateClientsList]);

  // Set up socket connection on component mount
  useEffect(() => {
    // Initialize Socket.IO for backward compatibility
    if (!socketRef.current) {
      console.log("Initializing socket connection");
      initSocket().then(socket => {
        socketRef.current = socket;
      }).catch(console.error);
    }
    
    // Initialize Pusher
    const channel = initPusher();
    
    // Cleanup function
    return () => {
      if (channel) {
        console.log("Cleaning up Pusher connection");
        channel.unbind_all();
        pusher.unsubscribe(`collab-${roomId}`);
      }
      
      if (socketRef.current) {
        console.log("Cleaning up socket connection");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initPusher, roomId]);
  
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
    if (pusherChannel) {
      // Unsubscribe from Pusher channel
      pusherChannel.unbind_all();
      pusher.unsubscribe(`collab-${roomId}`);
    }
    
    if (socketRef.current) {
      // Also leave the Socket.IO room
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
        <ConnectionStatus 
          isConnected={socketConnected} 
          isError={socketError}
          statusMessage={connectionStatus}
        />
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
            username={username}
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
