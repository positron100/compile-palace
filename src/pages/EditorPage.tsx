
import React, { useEffect, useRef, useState } from "react";
import Client from "../components/Client";
import Editor from "../components/Editor";
import InputSection from "../components/InputSection";
import OutputSection from "../components/OutputSection";
import LanguageSelector from "../components/LanguageSelector";
import CompileButton from "../components/CompileButton";
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

// Custom properties for TypeScript
interface CustomCSSProperties extends React.CSSProperties {
  "--i"?: string | number;
  "--j"?: string | number;
}

function EditorPage() {
  // socket initialization
  const socketRef = useRef(null);
  // for accessing the code in Editor
  const codeRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  const [clients, setClient] = useState([]);
  
  // States for compiler
  const [language, setLanguage] = useState(languageOptions[0]);
  const [stdin, setStdin] = useState("");
  const [outputDetails, setOutputDetails] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
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
      toast.success("Code executed successfully!");
    } catch (error) {
      console.error("Compilation error:", error);
      toast.error("Error compiling code. Please try again.");
    } finally {
      setIsCompiling(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        socketRef.current = await initSocket();
        
        // handling socket connection errors
        socketRef.current.on("connect_error", (err) => handleErrors(err));
        socketRef.current.on("connect_failed", (err) => handleErrors(err));

        function handleErrors(e) {
          console.log("socket error", e);
          toast.error("Socket connection failed");
          // We won't navigate away immediately to prevent loops
        }

        // emiting an event which now have to be listened onto server
        socketRef.current.emit(ACTIONS.JOIN, {
          roomId,
          username: location.state?.username || "Anonymous",
        });

        // listening for joined event
        socketRef.current.on(
          ACTIONS.JOINED,
          ({ clients, username, socketId }) => {
            // do not display the message to the joined user
            if (username !== location.state?.username) {
              toast.success(`${username} joined the room`);
              console.log(`${username} joined `);
            }
            setClient(clients);

            // sync code as soon as client joins
            socketRef.current.emit(ACTIONS.SYNC_CODE, {
              code: codeRef.current,
              // sync the code with client who just joined
              socketId,
            });
          }
        );

        // listening for disconnected
        socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
          toast.success(`${username} left the room.`);
          // removing the user which disconnected (from the client array)
          setClient((prev) => {
            return prev.filter((client) => client.socketId !== socketId);
          });
        });
        
        setInitialized(true);
      } catch (err) {
        console.error("Socket initialization error:", err);
        toast.error("Failed to connect to server. Please try again.");
      }
    };
    
    init();
    
    // cleaning function: function returned from useEffect
    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.disconnect();
      }
    };
  }, [location.state?.username, roomId]);
  
  // if username is not found and we've tried to initialize, redirect back to home page
  if (!location.state?.username && initialized) {
    return <Navigate to="/" />;
  }

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
    reactNavigator("/");
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Sidebar */}
      <div className="w-60 bg-gray-800 p-4 flex flex-col border-r border-gray-700">
        <div className="mb-6 bg-gray-700 p-3 rounded-lg text-center">
          <h2 className="text-xl font-bold">Compile Palace</h2>
        </div>
        
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-2">Connected Users</h3>
          <div className="flex flex-wrap gap-2">
            {clients.map((client: any) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-2">Compiler</h3>
          <div className="space-y-3">
            <LanguageSelector language={language} setLanguage={setLanguage} />
            <CompileButton onClick={handleCompile} isCompiling={isCompiling} />
          </div>
        </div>
        
        <div className="mt-auto space-y-3">
          <button 
            className="w-full bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded transition-colors"
            onClick={copyRoomId}
          >
            Copy Room ID
          </button>
          <button 
            className="w-full bg-red-600 hover:bg-red-700 py-2 px-4 rounded transition-colors"
            onClick={leaveRoom}
          >
            Leave Room
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen">
        <div className="flex-1 overflow-hidden">
          {/* Editor component */}
          <Editor
            socketRef={socketRef}
            roomId={roomId || ""}
            language={language}
            onCodeChange={(code) => {
              codeRef.current = code;
            }}
          />
        </div>
        <div className="h-2/5 flex border-t border-gray-700">
          <InputSection stdin={stdin} setStdin={setStdin} />
          <OutputSection outputDetails={outputDetails} />
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
