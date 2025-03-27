
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
  const codeChangeRef = useRef<boolean>(false);
  const localChangeRef = useRef<boolean>(false);
  
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

  // initializing code editor
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

      // Handling code changes carefully to prevent cursor jumps
      editorRef.current.on("change", (instance, changes) => {
        const { origin } = changes;
        const code = instance.getValue();
        
        // If change is from setValue (remote) or we're in the middle of processing a local change, don't re-emit
        if (origin === "setValue" || codeChangeRef.current) {
          return;
        }
        
        // Handle local user changes (typing)
        if (origin === "input" || origin === "+input") {
          // Mark that we're processing a local change
          localChangeRef.current = true;
          
          // Update parent component without re-render
          onCodeChange(code);
          
          // Only emit if not processing another change and socket exists
          if (!codeChangeRef.current && socketRef.current) {
            // Set flag to prevent re-entry
            codeChangeRef.current = true;
            
            // Emit change to other users
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
              roomId,
              code,
            });
            
            // Reset flag after emission
            codeChangeRef.current = false;
          }
          
          // Reset local change flag
          localChangeRef.current = false;
        }
      });
    }
    init(); 
    
    return () => {
      // Cleanup CodeMirror instance
      if (editorRef.current) {
        editorRef.current.toTextArea();
      }
    };
    // eslint-disable-next-line
  }, []);

  // Update editor mode when language changes
  useEffect(() => {
    if (editorRef.current && language) {
      editorRef.current.setOption("mode", getModeForLanguage(language.id));
    }
  }, [language]);

  useEffect(() => {
    // listening for CODE_CHANGE event from socket
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }: { code: string }) => {
        if (code !== null && editorRef.current && !localChangeRef.current) {
          // Get current cursor position before update
          const cursor = editorRef.current.getCursor();
          
          // Set flag to prevent triggering local change event
          codeChangeRef.current = true;
          
          // Update editor content
          editorRef.current.setValue(code);
          
          // Restore cursor position
          editorRef.current.setCursor(cursor);
          
          // Reset flag after update complete
          setTimeout(() => {
            codeChangeRef.current = false;
          }, 0);
        }
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.CODE_CHANGE);
      }
    }
    // eslint-disable-next-line   
  }, [socketRef.current]);

  return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;
