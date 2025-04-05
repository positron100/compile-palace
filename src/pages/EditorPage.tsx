import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
import pusher, { syncGlobalRoomState } from "../pusher";
import { getCleanLanguageName } from "../utils/languageUtils";
import userService from "../services/userService";
import { 
  Dialog, 
  DialogTitle, 
  DialogDescription,
  DialogContent 
} from "@/components/ui/dialog";

function EditorPage() {
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  
  const previousClientsRef = useRef([]);
  const [clients, setClients] = useState([]);
  const [clientsStable, setClientsStable] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(clients) !== JSON.stringify(previousClientsRef.current)) {
        setClientsStable(clients);
        previousClientsRef.current = clients;
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [clients]);

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
  const [pusherChannel, setPusherChannel] = useState(null);

  const username = location.state?.username || "Anonymous";
  const [subscriptionCount, setSubscriptionCount] = useState(1);

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
            lastSeen: Date.now()
          };
        } else {
          updatedClients.push({
            ...newClient,
            lastSeen: Date.now()
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
          lastSeen: Date.now()
        });
      }
      
      updatedClients.sort((a, b) => a.username.localeCompare(b.username));
      
      return updatedClients;
    });
  }, [username]);

  const syncUsersFromGlobalState = useCallback(() => {
    if (!roomId) return;
    
    const roomUsers = userService.getRoomUsers(roomId);
    console.log("Syncing users from global state for room:", roomId, roomUsers);
    
    if (roomUsers && roomUsers.length > 0) {
      updateClientsList(roomUsers);
    }
  }, [roomId, updateClientsList]);

  const initPusher = useCallback(() => {
    if (!roomId) return null;
    
    const channelName = `collab-${roomId}`;
    
    setConnectionStatus("Connecting to Pusher...");
    
    try {
      console.log(`Initializing Pusher connection and subscribing to ${channelName}`);
      const channel = pusher.subscribe(channelName);
      
      const handlePusherConnected = () => {
        console.log("Connected to Pusher");
        setSocketConnected(true);
        setSocketError(false);
        setConnectionStatus("Connected to Pusher");
        
        const globalState = syncGlobalRoomState();
        console.log("Synchronized global state:", globalState);
        
        syncUsersFromGlobalState();
        
        userService.syncUserPresence(roomId, username);
      };
      
      pusher.connection.bind('connected', handlePusherConnected);
      
      if (pusher.connection.state === 'connected') {
        handlePusherConnected();
      }
      
      channel.bind('pusher:subscription_succeeded', () => {
        console.log(`Successfully subscribed to public channel: ${channelName}`);
        setConnectionStatus("Subscribed to room channel");
        
        userService.syncUserPresence(roomId, username);
        syncUsersFromGlobalState();
        
        channel.bind(ACTIONS.ROOM_USERS, (data) => {
          if (data && data.users) {
            console.log("Received updated room users:", data.users);
            updateClientsList(data.users);
          }
        });
        
        channel.bind(ACTIONS.JOIN_ROOM, (data) => {
          if (data && data.username) {
            console.log(`${data.username} joined the room via server event`);
            
            if (data.username !== username) {
              toast.success(`${data.username} joined the room`);
            }
            
            userService.syncUserPresence(roomId, username);
            syncUsersFromGlobalState();
          }
        });
        
        channel.bind(ACTIONS.PRESENCE_UPDATE_EVENT, (data) => {
          if (data && data.username) {
            console.log(`Presence update from ${data.username}: ${data.action}`);
            
            if (data.action === 'connected') {
              userService.syncUserPresence(roomId, data.username);
              
              if (data.username !== username) {
                toast.success(`${data.username} is now online`);
              }
              
              syncUsersFromGlobalState();
            } else if (data.action === 'disconnected' && data.username !== username) {
              setClients(prev => prev.filter(client => client.username !== data.username));
              toast.info(`${data.username} disconnected`);
            }
          }
        });
        
        channel.bind(ACTIONS.GLOBAL_ROOM_USERS, (data) => {
          if (data && data.users) {
            console.log("Received global room users update:", data.users);
            updateClientsList(data.users);
          }
        });
        
        channel.bind(ACTIONS.PRESENCE_UPDATE, (data) => {
          if (data && data.clients) {
            updateClientsList(data.clients);
          }
        });
        
        channel.bind('pusher:subscription_error', (error) => {
          console.error("Public channel subscription error:", error);
          setSocketError(true);
          setConnectionStatus("Channel subscription failed");
          
          syncUsersFromGlobalState();
        });
        
        channel.bind('pusher:subscription_count', (data) => {
          console.log("Subscription count updated:", data);
          
          if (data && data.subscription_count && data.subscription_count > 0) {
            setSubscriptionCount(data.subscription_count);
          }
        });
      
        setPusherChannel(channel);
        setInitialized(true);
        
        return channel;
      });
      
      channel.bind(ACTIONS.PRESENCE_UPDATE, (data) => {
        if (data && data.clients) {
          updateClientsList(data.clients);
        }
      });
      
      channel.bind('pusher:subscription_error', (error) => {
        console.error("Public channel subscription error:", error);
        setSocketError(true);
        setConnectionStatus("Channel subscription failed");
        
        syncUsersFromGlobalState();
      });
      
      channel.bind('pusher:subscription_count', (data) => {
        console.log("Subscription count updated:", data);
        
        if (data && data.subscription_count && data.subscription_count > 0) {
          setSubscriptionCount(data.subscription_count);
        }
      });
      
      setPusherChannel(channel);
      setInitialized(true);
      
      return channel;
    } catch (error) {
      console.error("Pusher initialization error:", error);
      setSocketError(true);
      setConnectionStatus("Pusher connection failed");
      setInitialized(true);
      toast.error("Failed to connect to Pusher, using local mode");
      
      userService.syncUserPresence(roomId, username);
      syncUsersFromGlobalState();
      return null;
    }
  }, [roomId, updateClientsList, username, syncUsersFromGlobalState]);

  useEffect(() => {
    if (!socketRef.current) {
      console.log("Initializing socket connection");
      
      userService.connectToRoom(roomId, username)
        .then(socket => {
          socketRef.current = socket;
          
          if (socket) {
            socket.on(ACTIONS.JOINED, ({ clients, username: joinedUser, socketId }) => {
              console.log(`${joinedUser} joined the room`);
              
              if (joinedUser !== username) {
                toast.success(`${joinedUser} joined the room`);
              }
              
              updateClientsList(clients);
            });
            
            socket.on(ACTIONS.DISCONNECTED, ({ socketId, username: leftUser }) => {
              console.log(`${leftUser} left the room`);
              toast.info(`${leftUser} left the room`);
              
              setClients(prev => prev.filter(client => client.socketId !== socketId));
            });
            
            socket.on(ACTIONS.CODE_CHANGE, (data) => {
              if (data && data.code) {
                codeRef.current = data.code;
              }
            });
            
            socket.on(ACTIONS.CODE_BROADCAST, (data) => {
              if (data && data.code) {
                codeRef.current = data.code;
              }
            });
            
            socket.on(ACTIONS.SYNC_REQUEST, (data) => {
              if (codeRef && codeRef.current) {
                socket.emit(ACTIONS.SYNC_RESPONSE, {
                  roomId,
                  code: codeRef.current,
                  author: username
                });
              }
            });
            
            socket.on(ACTIONS.SYNC_RESPONSE, (data) => {
              if (data && data.code) {
                codeRef.current = data.code;
              }
            });
            
            socket.on(ACTIONS.JOIN_ROOM, (data) => {
              if (data && data.username) {
                if (roomId) {
                  userService.syncUserPresence(roomId, data.username);
                }
                
                syncUsersFromGlobalState();
                
                if (data.username !== username) {
                  toast.success(`${data.username} joined the room`);
                }
              }
            });
            
            socket.on(ACTIONS.ROOM_USERS, (data) => {
              if (data && data.users) {
                console.log("Received room users update:", data.users);
                updateClientsList(data.users);
              }
            });
            
            socket.on(ACTIONS.GLOBAL_ROOM_USERS, (data) => {
              if (data && data.users) {
                console.log("Received global room users update:", data.users);
                updateClientsList(data.users);
              }
            });
            
            socket.on(ACTIONS.PRESENCE_UPDATE_EVENT, (data) => {
              if (data && data.username && data.roomId === roomId) {
                if (data.action === 'connected') {
                  userService.syncUserPresence(roomId, data.username);
                  syncUsersFromGlobalState();
                  
                  if (data.username !== username) {
                    toast.success(`${data.username} is now online`);
                  }
                } else if (data.action === 'disconnected') {
                  if (data.username !== username) {
                    setClients(prev => prev.filter(client => client.username !== data.username));
                    toast.info(`${data.username} disconnected`);
                  }
                }
              }
            });
            
            socket.on(ACTIONS.GLOBAL_SYNC_REQUEST, (data) => {
              if (data && data.roomId === roomId) {
                console.log("Received global sync request from:", data.requestor);
                
                const roomUsers = userService.getRoomUsers(roomId);
                
                socket.emit(ACTIONS.GLOBAL_ROOM_USERS, {
                  roomId,
                  users: roomUsers,
                  requestor: username
                });
                
                if (codeRef && codeRef.current) {
                  socket.emit(ACTIONS.GLOBAL_SYNC_RESPONSE, {
                    roomId,
                    code: codeRef.current,
                    author: username
                  });
                }
              }
            });
          }
        })
        .catch(err => {
          console.error("Socket initialization error:", err);
          userService.syncUserPresence(roomId, username);
          syncUsersFromGlobalState();
        });
    }
    
    const channel = initPusher();
    
    const syncInterval = setInterval(() => {
      syncUsersFromGlobalState();
    }, 5000);
    
    return () => {
      clearInterval(syncInterval);
      
      if (channel) {
        console.log("Cleaning up Pusher connection");
        channel.unbind_all();
        pusher.unsubscribe(`collab-${roomId}`);
      }
      
      if (socketRef.current) {
        console.log("Cleaning up socket connection");
        userService.disconnectFromRoom(roomId, username, socketRef.current);
        socketRef.current = null;
      }
    };
  }, [initPusher, roomId, updateClientsList, username, syncUsersFromGlobalState]);

  useEffect(() => {
    if (initialized && !location.state?.username) {
      console.log("No username provided, redirecting to home");
      toast.error("Please enter a username to join a room");
      reactNavigator("/");
    }
  }, [initialized, location.state?.username, reactNavigator]);

  const copyRoomId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomId || "");
      toast.success("Room ID copied to clipboard");
    } catch (err) {
      toast.error("Could not copy Room ID");
      console.error(err);
    }
  }, [roomId]);

  const leaveRoom = useCallback(() => {
    if (pusherChannel) {
      pusherChannel.unbind_all();
      pusher.unsubscribe(`collab-${roomId}`);
    }
    
    if (socketRef.current) {
      userService.disconnectFromRoom(roomId, username, socketRef.current);
    }
    
    reactNavigator("/");
  }, [pusherChannel, roomId, username, reactNavigator]);

  const SidebarContent = () => (
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
        <h3 className="font-semibold text-gray-700 mb-3">Connected Users ({clientsStable.length})</h3>
        <div className="flex flex-wrap gap-3 min-h-16 transition-all duration-300">
          {clientsStable.length > 0 ? (
            clientsStable.map((client) => (
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
  );

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
            {subscriptionCount > 0 && (
              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {subscriptionCount} {subscriptionCount === 1 ? 'user' : 'users'}
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
