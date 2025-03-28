
import React, { useEffect, useRef } from "react";
import Codemirror from "codemirror";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";
import "codemirror/mode/clike/clike";
import "codemirror/mode/php/php";
import "codemirror/mode/ruby/ruby";
import "codemirror/mode/sql/sql";
import "codemirror/mode/swift/swift";
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/edit/closetag";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";
import ACTIONS from "../Actions";

interface EditorProps {
  socketRef: React.MutableRefObject<any>;
  roomId: string;
  onCodeChange: (code: string) => void;
  language: {
    id: number;
    name: string;
  };
}

const Editor: React.FC<EditorProps> = ({ socketRef, roomId, onCodeChange, language }) => {
  const editorRef = useRef<Codemirror.Editor | null>(null);
  const ignoreChangeRef = useRef<boolean>(false);
  const previousCodeRef = useRef<string>("");
  
  // Set the appropriate mode based on the selected language
  const getModeForLanguage = (langId: number) => {
    switch(langId) {
      case 63: return { name: "javascript", json: true };
      case 71: return { name: "python" };
      case 62: case 54: case 50: return { name: "text/x-c++src" };
      case 51: return { name: "text/x-csharp" };
      case 68: return { name: "text/x-php" };
      case 78: return { name: "ruby" };
      case 82: return { name: "sql" };
      case 83: return { name: "swift" };
      default: return { name: "javascript", json: true };
    }
  };

  // Request initial code when joining a room
  useEffect(() => {
    if (socketRef.current && roomId) {
      console.log("Requesting initial code for room:", roomId);
      socketRef.current.emit(ACTIONS.SYNC_CODE, { roomId });
    }
  }, [socketRef.current, roomId]);

  // Initializing code editor
  useEffect(() => {
    async function init() {
      const textarea = document.getElementById("realtimeEditor");
      if (!textarea) return;
      
      editorRef.current = Codemirror.fromTextArea(
        textarea as HTMLTextAreaElement,
        {
          mode: getModeForLanguage(language?.id || 63),
          theme: "dracula",
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
          undoDepth: 200,
          historyEventDelay: 200
        }
      );

      // Handle initial editor content
      if (editorRef.current) {
        const initialCode = editorRef.current.getValue();
        previousCodeRef.current = initialCode;
        onCodeChange(initialCode);
      }

      // Handling code changes with specific approach to prevent cursor jumping
      editorRef.current.on("change", (instance, changes) => {
        // Exit early if we should ignore this change (from remote update)
        if (ignoreChangeRef.current) {
          return;
        }

        const { origin } = changes;
        const code = instance.getValue();
        
        // Only handle local user input
        if (origin === "input" || origin === "+input" || origin === "+delete") {
          // Update parent component
          onCodeChange(code);
          previousCodeRef.current = code;
          
          // Emit to other users if connected
          if (socketRef.current) {
            console.log("Emitting local code change");
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
              roomId,
              code,
            });
          }
        }
      });
    }
    
    init();
    
    return () => {
      // Cleanup CodeMirror instance
      if (editorRef.current) {
        editorRef.current.toTextArea();
        editorRef.current = null;
      }
    };
  }, []); // Empty dependency array to run once

  // Update editor mode when language changes
  useEffect(() => {
    if (editorRef.current && language) {
      editorRef.current.setOption("mode", getModeForLanguage(language.id));
    }
  }, [language]);

  // Socket event listener for remote code changes
  useEffect(() => {
    if (!socketRef.current) return;
    
    const handleRemoteChange = ({ code }: { code: string }) => {
      if (!editorRef.current || !code || code === previousCodeRef.current) {
        return; // Ignore if no change or same as current code
      }
      
      console.log("Received remote code change");
      
      // Save cursor position
      const cursor = editorRef.current.getCursor();
      const scrollInfo = editorRef.current.getScrollInfo();
      
      // Set flag to ignore the change event this will trigger
      ignoreChangeRef.current = true;
      
      // Update the editor value
      editorRef.current.setValue(code);
      
      // Restore cursor position and scroll
      editorRef.current.setCursor(cursor);
      editorRef.current.scrollTo(scrollInfo.left, scrollInfo.top);
      
      // Update the previous code ref
      previousCodeRef.current = code;
      
      // Reset flag after a short delay
      setTimeout(() => {
        ignoreChangeRef.current = false;
      }, 0);
      
      // Update parent component
      onCodeChange(code);
    };
    
    // Register event handlers
    socketRef.current.on(ACTIONS.CODE_CHANGE, handleRemoteChange);
    socketRef.current.on(ACTIONS.SYNC_CODE, handleRemoteChange);
    
    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.CODE_CHANGE, handleRemoteChange);
        socketRef.current.off(ACTIONS.SYNC_CODE, handleRemoteChange);
      }
    };
  }, [socketRef.current]); // Only re-run if socket reference changes

  return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;
