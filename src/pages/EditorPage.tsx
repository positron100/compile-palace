
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
import toast from "react-hot-toast";
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
  // eslint-disable-next-line
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  const [clients, setClient] = useState([]);
  
  // States for compiler
  const [language, setLanguage] = useState(languageOptions[0]);
  const [stdin, setStdin] = useState("");
  const [outputDetails, setOutputDetails] = useState(null);
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

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      // handling socket connection errors
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(e) {
        console.log("socket error", e);
        toast.error("Socket connection failed");
        reactNavigator("/");
      }

      // emiting an event which now have to be listened onto server
      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
        // will not throw error if username property is absent
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
        toast.success(`${username} left the room. `);
        // removing the user which disconnected ( from the client array )
        setClient((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });
    };
    init();
    // clearing the listeners : for preventing memory leak
    // cleaning function : function returned from useEffect
    return () => {
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
      socketRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // if username is not found redirect back to home page
  if (!location.state) {
    return <Navigate to="/" />;
  }

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId || "");
      toast.success("RoomID copied to clipboard");
    } catch (err) {
      toast.error("could not copy RoomID");
      console.error(err);
    }
  }

  async function leaveRoom() {
    reactNavigator("/");
  }

  return (
    <div className="mainWrap">
      <div className="aside">
        {/* Floating Circles */}
        <ul className="circle">
          {Array.from({ length: 20 }).map((_, idx) => (
            <li
              key={idx}
              style={{
                "--i": `${Math.random() * 10 + 1}`,
                "--j": `${Math.random() * 7 + 1}`,
              } as CustomCSSProperties}
            ></li>
          ))}
        </ul>
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src="/code-sync.png" alt="logo" />
          </div>
          <h3>Connected</h3>
          <div className="clientList">
            {clients.map((client: any) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
          
          <div className="compiler-controls">
            <h3>Compiler</h3>
            <div className="compiler-options">
              <LanguageSelector language={language} setLanguage={setLanguage} />
              <CompileButton onClick={handleCompile} isCompiling={isCompiling} />
            </div>
          </div>
        </div>
        <button className="btn copyBtn" onClick={copyRoomId}>
          Copy ROOM ID
        </button>
        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave
        </button>
      </div>

      <div className="editorWrap">
        <div className="editor-container">
          {/* Editor component calling */}
          <Editor
            socketRef={socketRef}
            roomId={roomId || ""}
            language={language}
            onCodeChange={(code) => {
              codeRef.current = code;
            }}
          />
        </div>
        <div className="io-container">
          <InputSection stdin={stdin} setStdin={setStdin} />
          <OutputSection outputDetails={outputDetails} />
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
