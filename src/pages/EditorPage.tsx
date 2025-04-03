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
import pusher from "../pusher";
import { getCleanLanguageName } from "../utils/languageUtils";

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
      if (!append) {
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
      
      const updatedClients = [...prevClients];
      
      newClients.forEach(newClient => {
        const exists = updatedClients.some(
          client => client.socketId === newClient.socketId || 
                   client.username === newClient.username
        );
        
        if (!exists) {
          updatedClients.push(newClient);
        }
      });
      
      const currentUserExists = updatedClients.some(client => 
        client.username === username || client.socketId === 'local-user'
      );
      
      if (!currentUserExists) {
        updatedClients.push({ socketId: 'local-user', username: username });
      }
      
      return updatedClients;
    });
  }, [username]);

  const initPusher = useCallback(() => {
    if (!roomId) return null;
    
    // Use public channel naming consistently
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
        
        updateClientsList([{ socketId: 'local-user', username: username }]);
      };
      
      pusher.connection.bind('connected', handlePusherConnected);
      
      if (pusher.connection.state === 'connected') {
        handlePusherConnected();
      }
      
      channel.bind('pusher:subscription_succeeded', () => {
        console.log(`Successfully subscribed to public channel: ${channelName}`);
        setConnectionStatus("Subscribed to room channel");
        
        updateClientsList([{ socketId: 'local-user', username: username }]);
        
        // Use standard public channel events
        channel.bind(ACTIONS.JOIN_ROOM, (data) => {
          if (data && data.username && data.username !== username) {
            console.log(`${data.username} joined the room via server event`);
            toast.success(`${data.username} joined the room`);
            
            updateClientsList([{ 
              socketId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`, 
              username: data.username 
            }], true);
          }
        });
        
        channel.bind(ACTIONS.PRESENCE_UPDATE_EVENT, (data) => {
          if (data && data.username) {
            console.log(`Presence update from ${data.username}: ${data.action}`);
            
            if (data.action === 'connected' && data.username !== username) {
              updateClientsList([{ 
                socketId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`, 
                username: data.username 
              }], true);
              
              toast.success(`${data.username} is now online`);
            } else if (data.action === 'disconnected' && data.username !== username) {
              setClients(prev => prev.filter(client => client.username !== data.username));
              toast.info(`${data.username} disconnected`);
            }
          }
        });
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
        
        updateClientsList([{ socketId: 'local-user', username: username }]);
      });
      
      channel.bind('pusher:subscription_count', (data) => {
        console.log("Subscription count updated:", data);
        
        if (data && data.subscription_count && data.subscription_count > 0) {
          setSubscriptionCount(data.subscription_count);
        }
      });
      
      // Handle code changes from other users
      channel.bind(ACTIONS.CODE_UPDATE, (data) => {
        console.log("Received code update event from server", data);
        if (data && data.code) {
          codeRef.current = data.code;
        }
      });
      
      setPusherChannel(channel);
      setInitialized(true);
      
      updateClientsList([{ socketId: 'local-user', username: username }]);
      
      return channel;
    } catch (error) {
      console.error("Pusher initialization error:", error);
      setSocketError(true);
      setConnectionStatus("Pusher connection failed");
      setInitialized(true);
      toast.error("Failed to connect to Pusher, using local mode");
      
      updateClientsList([{ socketId: 'local-user', username: username }]);
      return null;
    }
  }, [roomId, updateClientsList, username]);

  useEffect(() => {
    if (!socketRef.current) {
      console.log("Initializing socket connection");
      initSocket().then(socket => {
        socketRef.current = socket;
        
        if (socket) {
          socket.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
            console.log(`${username} joined the room`);
            
            if (username !== location.state?.username) {
              toast.success(`${username} joined the room`);
            }
            
            updateClientsList(clients);
          });
          
          socket.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
            console.log(`${username} left the room`);
            toast.info(`${username} left the room`);
            
            setClients(prev => prev.filter(client => client.socketId !== socketId));
          });
          
          // Add handlers for code synchronization
          socket.on(ACTIONS.CODE_CHANGE, (data) => {
            if (data && data.code) {
              codeRef.current = data.code;
              // Broadcast to other users via Pusher from server
              if (pusherChannel) {
                pusherChannel.emit(ACTIONS.CODE_UPDATE, {
                  code: data.code,
                  author: data.author
                });
              }
            }
          });
          
          socket.on(ACTIONS.SYNC_REQUEST, (data) => {
            if (editorRef && editorRef.current && editorRef.current.getValue) {
              const currentCode = editorRef.current.getValue();
              socket.emit(ACTIONS.SYNC_RESPONSE, {
                roomId,
                code: currentCode,
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
            if (data && data.username && data.username !== username) {
              updateClientsList([{ 
                socketId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`, 
                username: data.username 
              }], true);
              toast.success(`${data.username} joined the room`);
            }
          });
          
          socket.on(ACTIONS.PRESENCE_UPDATE_EVENT, (data) => {
            if (data && data.username) {
              if (data.action === 'connected' && data.username !== username) {
                updateClientsList([{ 
                  socketId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`, 
                  username: data.username 
                }], true);
                toast.success(`${data.username} is now online`);
              } else if (data.action === 'disconnected' && data.username !== username) {
                setClients(prev => prev.filter(client => client.username !== data.username));
                toast.info(`${data.username} disconnected`);
              }
            }
          });
          
          if (roomId) {
            socket.emit(ACTIONS.JOIN, {
              roomId,
              username: location.state?.username || 'Anonymous'
            });
          }
        }
        
        updateClientsList([{ socketId: 'local-user', username: username }]);
      }).catch(err => {
        console.error("Socket init error:", err);
        
        updateClientsList([{ socketId: 'local-user', username: username }]);
      });
    }
    
    const channel = initPusher();
    
    setTimeout(() => {
      if (clients.length === 0) {
        console.log("No clients detected after timeout, ensuring local user is visible");
        updateClientsList([{ socketId: 'local-user', username: username }]);
      }
    }, 1000);
    
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
  }, [initPusher, roomId, updateClientsList, clients.length, location.state?.username, username]);

  useEffect(() => {
    if (initialized && !location.state?.username) {
      console.log("No username provided, redirecting to home");
      toast.error("Please enter a username to join a room");
      reactNavigator("/");
    }
  }, [initialized, location.state?.username, reactNavigator]);

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId || "");
      toast.success("Room ID copied to clipboard");
    } catch (err) {
      toast.error("Could not copy Room ID");
      console.error(err);
    }
  }

  async function leaveRoom() {
    if (pusherChannel) {
      pusherChannel.unbind_all();
      pusher.unsubscribe(`collab-${roomId}`);
    }
    
    if (socketRef.current) {
      if (roomId) {
        socketRef.current.emit(ACTIONS.LEAVE, { roomId });
      }
      socketRef.current.disconnect();
    }
    
    reactNavigator("/");
  }

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
                className="bg-indigo-500/20 absolute list-none rounded-lg animate-float"
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
