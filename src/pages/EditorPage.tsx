
import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from "sonner";
import Editor from '../components/Editor';
import InputSection from '../components/InputSection';
import OutputSection from '../components/OutputSection';
import LanguageSelector from '../components/LanguageSelector';
import CompileButton from '../components/CompileButton';
import Client from '../components/Client';
import { submitCode, languageOptions } from '../services/compileService';
import ACTIONS from '../Actions';

// Import this when you have implemented the socket
// import { initSocket } from "../socket";

const EditorPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Socket and code references
  const socketRef = useRef<any>(null);
  const codeRef = useRef<string>('');
  
  // State for connected clients
  const [clients, setClients] = useState<Array<{ socketId: string; username: string }>>([]);
  
  // States for compiler
  const [language, setLanguage] = useState(languageOptions[0]);
  const [stdin, setStdin] = useState("");
  const [outputDetails, setOutputDetails] = useState<any>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  
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

  // Socket connection and event handling
  useEffect(() => {
    const init = async () => {
      // Uncomment this when socket implementation is ready
      // socketRef.current = await initSocket();
      
      // For now we'll just mock some of the socket behavior
      if (!socketRef.current) {
        // Mock client data for testing
        setClients([{ 
          socketId: 'test-socket-id', 
          username: location.state?.username || 'Anonymous' 
        }]);
      }
      
      // Actual socket implementation would go here
      /*
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(e) {
        console.log("socket error", e);
        toast.error("Socket connection failed");
        navigate("/");
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room`);
          }
          setClients(clients);

          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });
      */
    };
    
    init();
    
    return () => {
      // Cleanup function
      /*
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.disconnect();
      }
      */
    };
  }, [roomId, location.state?.username, navigate]);

  // Redirect if no username is provided
  if (!location.state?.username) {
    return <Navigate to="/" />;
  }

  // Helper functions
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId || '');
      toast.success("Room ID copied to clipboard");
    } catch (err) {
      toast.error("Could not copy Room ID");
      console.error(err);
    }
  };

  const leaveRoom = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-gradient-to-b from-orange-500 to-amber-500 p-4 flex flex-col relative">
        {/* Animated background */}
        <ul className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, idx) => (
            <li
              key={idx}
              style={{
                "--i": Math.random() * 10 + 1,
                "--j": Math.random() * 7 + 1,
              } as React.CSSProperties}
              className="absolute block bg-green-500/60 animate-[float_linear_infinite_calc(5s+var(--i)*5s)]"
            />
          ))}
        </ul>
        
        <div className="z-10 flex-1 flex flex-col">
          <div className="bg-gray-800 p-4 rounded-3xl mb-6">
            <h1 className="text-xl font-bold text-center">Compile Palace</h1>
          </div>
          
          <h3 className="text-lg font-semibold mb-2 capitalize">Connected</h3>
          <div className="flex flex-wrap gap-4 mb-6">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
          
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Compiler</h3>
            <div className="space-y-2">
              <LanguageSelector language={language} setLanguage={setLanguage} />
              <CompileButton onClick={handleCompile} isCompiling={isCompiling} />
            </div>
          </div>
        </div>
        
        <button 
          onClick={copyRoomId}
          className="w-full bg-white text-gray-800 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors font-medium mb-2 z-10"
        >
          Copy Room ID
        </button>
        <button 
          onClick={leaveRoom}
          className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors font-medium z-10"
        >
          Leave Room
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-gray-800">
        <div className="flex-1 overflow-hidden">
          <Editor
            socketRef={socketRef}
            roomId={roomId || ''}
            language={language}
            onCodeChange={(code: string) => {
              codeRef.current = code;
            }}
          />
        </div>
        <div className="h-64 flex border-t border-gray-700">
          <InputSection stdin={stdin} setStdin={setStdin} />
          <OutputSection outputDetails={outputDetails} />
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
