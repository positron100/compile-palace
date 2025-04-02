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
import { getCleanLanguageName } from "../utils/languageUtils";

function EditorPage() {
  // Socket and state management 
  const socketRef = useRef(null);
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
  const updateClientsList = useCallback((newClients = [], append = false) => {
    console.log("Updating clients list:", newClients, "Append:", append);
    
    setClients(prevClients => {
      // If we're not appending, replace all clients with the new list
      if (!append) {
        // Ensure current user is always in the list
        const currentUserExists = newClients.some(client => 
          client.username === username || client.socketId === 'local-user'
        );
        
        if (!currentUserExists) {
          return [
            ...newClients,
            { socketId: 'local-user', username: username }
          ];
        }
        return newClients;
      }
      
      // If we're appending, add unique new clients
      const updatedClients = [...prevClients];
      
      // Add new clients if they don't already exist
      newClients.forEach(newClient => {
        const exists = updatedClients.some(
          client => client.socketId === newClient.socketId
        );
        
        if (!exists) {
          updatedClients.push(newClient);
        }
      });
      
      // Make sure current user is included
      const currentUserExists = updatedClients.some(client => 
        client.username === username || client.socketId === 'local-user'
      );
      
      if (!currentUserExists) {
        updatedClients.push({ socketId: 'local-user', username: username });
      }
      
      return updatedClients;
    });
  }, [username]);

  // Initialize Pusher connection
  const initPusher = useCallback(() => {
    if (!roomId) return null;
    
    // Use PRIVATE channel for code collaboration
    const channelName = `private-collab-${roomId}`;
    
    setConnectionStatus("Connecting to Pusher...");
    
    try {
      // Subscribe to private channel for code updates
      const channel = pusher.subscribe(channelName);
      
      // Handle successful connection
      const handlePusherConnected = () => {
        console.log("Connected to Pusher");
        setSocketConnected(true);
        setSocketError(false);
        setConnectionStatus("Connected to Pusher");
        
        // Initialize with at least our own user
        updateClientsList([{ socketId: 'local-user', username: username }]);
      };
      
      pusher.connection.bind('connected', handlePusherConnected);
      
      // If already connected, call the handler immediately
      if (pusher.connection.state === 'connected') {
        handlePusherConnected();
      }
      
      // Handle successful subscription to private channel
      channel.bind('pusher:subscription_succeeded', () => {
        console.log("Successfully subscribed to private channel");
        setConnectionStatus("Subscribed to room channel");
        
        // Ensure the current user is in the list
        updateClientsList([{ socketId: 'local-user', username: username }]);
        
        // Add server-side presence handling here if needed
        channel.bind(ACTIONS.PRESENCE_UPDATE, (data) => {
          if (data && data.clients) {
            updateClientsList(data.clients);
          }
        });
      });
      
      // Handle subscription errors
      channel.bind('pusher:subscription_error', (error) => {
        console.error("Private channel subscription error:", error);
        setSocketError(true);
        setConnectionStatus("Channel subscription failed");
        
        // Even if subscription fails, ensure the current user is shown
        updateClientsList([{ socketId: 'local-user', username: username }]);
      });
      
      // Handle subscription count events for the collab channel
      channel.bind('pusher:subscription_count', (data) => {
        console.log("Subscription count updated:", data);
        
        if (data && data.subscription_count && data.subscription_count > 0) {
          setSubscriptionCount(data.subscription_count);
          
          // If we only have one user (ourselves) but count is higher
          if (clients.length <= 1 && data.subscription_count > 1) {
            // Create placeholder users to match the count
            const placeholderClients = [];
            for (let i = clients.length; i < data.subscription_count; i++) {
              if (i === 0) {
                placeholderClients.push({ socketId: 'local-user', username: username });
              } else {
                placeholderClients.push({ 
                  socketId: `user-${Date.now()}-${i}`, 
                  username: `User ${i}` 
                });
              }
            }
            updateClientsList(placeholderClients);
          }
        }
      });
      
      // Listen for client code change events
      channel.bind(ACTIONS.CLIENT_CODE_CHANGE, (data) => {
        console.log("Received client code change event", data);
        // Update local code reference
        if (data && data.code) {
          codeRef.current = data.code;
        }
      });
      
      // Store channel reference
      setPusherChannel(channel);
      setInitialized(true);
      
      // Ensure we always see at least one user (ourselves)
      updateClientsList([{ socketId: 'local-user', username: username }]);
      
      return channel;
    } catch (error) {
      console.error("Pusher initialization error:", error);
      setSocketError(true);
      setConnectionStatus("Pusher connection failed");
      setInitialized(true);
      toast.error("Failed to connect to Pusher, using local mode");
      
      // Create a fake client for UI demonstration
      updateClientsList([{ socketId: 'local-user', username: username }]);
      return null;
    }
  }, [roomId, updateClientsList, username, clients.length]);

  // Set up socket connection on component mount
  useEffect(() => {
    // Initialize Socket.IO for backward compatibility
    if (!socketRef.current) {
      console.log("Initializing socket connection");
      initSocket().then(socket => {
        socketRef.current = socket;
        
        if (socket) {
          // Handle JOINED event (user joined a room)
          socket.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
            console.log(`${username} joined the room`);
            
            // Display a toast message
            if (username !== location.state?.username) {
              toast.success(`${username} joined the room`);
            }
            
            // Update clients list
            updateClientsList(clients);
          });
          
          // Handle DISCONNECTED event (user left the room)
          socket.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
            console.log(`${username} left the room`);
            toast.info(`${username} left the room`);
            
            // Remove the disconnected client
            setClients(prev => prev.filter(client => client.socketId !== socketId));
          });
          
          // Join the room
          if (roomId) {
            socket.emit(ACTIONS.JOIN, {
              roomId,
              username: location.state?.username || 'Anonymous'
            });
          }
        }
        
        // Ensure we see at least the current user
        updateClientsList([{ socketId: 'local-user', username: username }]);
      }).catch(err => {
        console.error("Socket init error:", err);
        
        // Ensure we see at least the current user even if socket fails
        updateClientsList([{ socketId: 'local-user', username: username }]);
      });
    }
    
    // Initialize Pusher
    const channel = initPusher();
    
    // This is a critical fallback to ensure users always see themselves
    setTimeout(() => {
      if (clients.length === 0) {
        console.log("No clients detected after timeout, ensuring local user is visible");
        updateClientsList([{ socketId: 'local-user', username: username }]);
      }
    }, 1000);
    
    // Cleanup function
    return () => {
      if (channel) {
        console.log("Cleaning up Pusher connection");
        channel.unbind_all();
        pusher.unsubscribe(`private-collab-${roomId}`);
      }
      
      if (socketRef.current) {
        console.log("Cleaning up socket connection");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initPusher, roomId, updateClientsList, clients.length, location.state?.username, username]);
  
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
      pusher.unsubscribe(`private-collab-${roomId}`);
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
                    {getCleanLanguageName(lang.name)}
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

        {/* Animated squares section */}
        <div className="h-16 md:h-32 relative overflow-hidden bg-gradient-to-b from-purple-50 to-white">
          {/* Animated squares */}
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
