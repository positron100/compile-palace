
import React, { useEffect, useRef, useState, useCallback } from "react";
import Client from "../components/Client";
import Editor from "../components/Editor";
import OutputDialog from "../components/OutputDialog";
import { initSocket, disconnectSocket } from "../socket";
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
import { Play, Copy, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getCleanLanguageName } from "../utils/languageUtils";
import userService from "../services/userService";

function EditorPage() {
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
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

  const username = location.state?.username || "Anonymous";
  const [userCount, setUserCount] = useState(1);
  
  const lastClientsUpdateRef = useRef(Date.now());
  const clientsUpdateThrottleMs = 2000;

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

  const updateClientsList = useCallback((newClients = [], append = false) => {
    const now = Date.now();
    if (now - lastClientsUpdateRef.current < clientsUpdateThrottleMs) {
      return;
    }
    
    lastClientsUpdateRef.current = now;
    console.log("Updating clients list:", newClients, "Append:", append);
    
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
        console.log("Socket connected with ID:", socket.id);
        
        // Join room once connected
        socket.emit(ACTIONS.JOIN, {
          roomId,
          username
        });
        
        // Track user in local service
        userService.trackUserPresence(roomId, username);
      });
      
      socket.on('connect_error', (err) => {
        console.error("Socket connection error:", err);
        setSocketError(true);
        setConnectionStatus("Connection failed");
        toast.error("Failed to connect to server");
      });
      
      socket.on('disconnect', () => {
        setSocketConnected(false);
        setConnectionStatus("Disconnected");
        console.log("Socket disconnected");
      });
      
      // Handle room events
      socket.on(ACTIONS.JOINED, ({ clients, username: joinedUser, socketId }) => {
        console.log(`${joinedUser} joined the room`);
        
        if (joinedUser !== username) {
          toast.success(`${joinedUser} joined the room`);
        }
        
        updateClientsList(clients);
        setUserCount(clients.length);
      });
      
      socket.on(ACTIONS.DISCONNECTED, ({ socketId, username: leftUser }) => {
        console.log(`${leftUser} left the room`);
        toast.info(`${leftUser} left the room`);
        
        const now = Date.now();
        if (now - lastClientsUpdateRef.current >= clientsUpdateThrottleMs) {
          lastClientsUpdateRef.current = now;
          setClients(prev => prev.filter(client => client.socketId !== socketId));
        }
      });
      
      setInitialized(true);
      
      // Cleanup function
      return () => {
        console.log("Cleaning up socket connection");
        
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        
        disconnectSocket();
      };
    } catch (error) {
      console.error("Socket initialization error:", error);
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
    if (initialized && !location.state?.username) {
      console.log("No username provided, redirecting to home");
      toast.error("Please enter a username to join a room");
      reactNavigator("/");
    }
  }, [initialized, location.state?.username, reactNavigator]);

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId || "");
      toast.success("Room ID copied to clipboard");
    } catch (err) {
      toast.error("Could not copy Room ID");
      console.error(err);
    }
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.LEAVE, { roomId });
      socketRef.current.disconnect();
    }
    
    reactNavigator("/");
  };

  const SidebarContent = React.memo(() => (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-800 mb-1">Code Palace</h2>
        <p className="text-sm text-purple-500">Real-time code collaboration</p>
        
        <ConnectionStatus 
          isConnected={socketConnected} 
          isError={socketError}
          statusMessage={connectionStatus}
        />
      </div>
      
      <div className="mb-8">
        <h3 className="font-semibold text-gray-700 mb-3">Connected Users ({clients.length})</h3>
        <div className="flex flex-wrap gap-3 min-h-16">
          {clients.length > 0 ? (
            clients.map((client) => (
              <Client 
                key={client.socketId || client.username} 
                username={client.username} 
                socketId={client.socketId} 
              />
            ))
          ) : (
            <div className="text-sm text-purple-400 italic">
              {initialized ? "No users connected yet..." : "Connecting..."}
            </div>
          )}
        </div>
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
  ));
  
  SidebarContent.displayName = "SidebarContent";

  if (!location.state?.username && initialized) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col md:flex-row">
      <div className="hidden md:flex w-64 bg-gradient-to-b from-white to-purple-50 p-6 flex-col border-r border-purple-100 shadow-sm">
        <SidebarContent />
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[85vw] sm:w-[350px] p-6 bg-gradient-to-b from-white to-purple-50">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="p-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-white flex justify-between items-center">
          <div className="flex items-center gap-3">
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
            {userCount > 0 && (
              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {userCount} {userCount === 1 ? 'user' : 'users'}
              </span>
            )}
          </div>
        </div>
        
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

        <div className="h-16 md:h-32 relative overflow-hidden bg-gradient-to-b from-purple-50 to-white">
          <ul className="squares">
            {Array.from({ length: 10 }).map((_, idx) => (
              <li
                key={idx}
                style={{
                  "--i": Math.random() * 10 + 1,
                  "--j": Math.random() * 7 + 1,
                } as React.CSSProperties}
                className="bg-indigo-500/20 absolute list-none rounded-lg"
              />
            ))}
          </ul>
        </div>
      </div>
      
      <OutputDialog 
        open={showOutput} 
        onOpenChange={setShowOutput} 
        outputDetails={outputDetails} 
      />
    </div>
  );
}

export default EditorPage;
