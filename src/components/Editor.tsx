
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
  const roomIdRef = useRef<string>(roomId);
  
  // Update roomId ref when prop changes
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  
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
        
        // When editor is first initialized, request sync
        if (socketRef.current && roomId) {
          console.log("New editor requesting initial code for room:", roomId);
          socketRef.current.emit(ACTIONS.SYNC_CODE, { roomId });
        }
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
            console.log("Emitting code change to room:", roomIdRef.current);
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
              roomId: roomIdRef.current,
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
      if (!editorRef.current || !code) {
        return; // Ignore if editor not ready or no code
      }
      
      // Skip if the code is exactly the same (prevents unnecessary updates)
      if (code === previousCodeRef.current) {
        console.log("Skipping identical remote code update");
        return;
      }
      
      console.log("Received remote code change - applying to editor");
      
      // Save cursor position and scroll state
      const cursor = editorRef.current.getCursor();
      const scrollInfo = editorRef.current.getScrollInfo();
      
      // Set flag to ignore the change event this will trigger
      ignoreChangeRef.current = true;
      
      try {
        // Update the editor value
        editorRef.current.setValue(code);
        
        // Update the previous code ref
        previousCodeRef.current = code;
        
        // Notify parent component
        onCodeChange(code);
      } catch (err) {
        console.error("Error applying remote code change:", err);
      } finally {
        // Restore cursor position and scroll state
        editorRef.current.setCursor(cursor);
        editorRef.current.scrollTo(scrollInfo.left, scrollInfo.top);
        
        // Reset ignore flag after a short delay 
        // (allows the change to be processed before accepting new changes)
        setTimeout(() => {
          ignoreChangeRef.current = false;
        }, 10);
      }
    };
    
    // Listen for code change events
    console.log("Setting up CODE_CHANGE and SYNC_CODE event listeners");
    socketRef.current.on(ACTIONS.CODE_CHANGE, handleRemoteChange);
    socketRef.current.on(ACTIONS.SYNC_CODE, handleRemoteChange);
    
    // Cleanup
    return () => {
      console.log("Cleaning up editor socket listeners");
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.CODE_CHANGE, handleRemoteChange);
        socketRef.current.off(ACTIONS.SYNC_CODE, handleRemoteChange);
      }
    };
  }, [socketRef.current, onCodeChange]);
  
  return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;
