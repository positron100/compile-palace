
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
        }
      );

      // changes will be reflected on console
      // event emitted for changing the code
      editorRef.current.on("change", (instance, changes) => {
        const { origin } = changes;
        const code = instance.getValue();
        
        // Use code change ref to prevent unnecessary re-renders
        // Only call the parent component's onCodeChange when needed
        if (origin !== "setValue") {
          onCodeChange(code);
          
          // Prevent cursor jumping by checking if this is from a socket event
          if (!codeChangeRef.current && socketRef.current) {
            codeChangeRef.current = true;
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
              roomId,
              code,
            });
            codeChangeRef.current = false;
          }
        }
      });
    }
    init(); 
    // eslint-disable-next-line
  }, []);

  // Update editor mode when language changes
  useEffect(() => {
    if (editorRef.current && language) {
      editorRef.current.setOption("mode", getModeForLanguage(language.id));
    }
  }, [language]);

  useEffect(() => {
    // listening for CODE_CHANGE event
    // receiving the changed code
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }: { code: string }) => {
        // if code is null then it will get deleted from the editor
        if (code !== null && editorRef.current) {
          // Set flag to prevent triggering local change event
          codeChangeRef.current = true;
          // dynamically adding text to editor
          editorRef.current.setValue(code);
          // Reset flag after setValue operation
          codeChangeRef.current = false;
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
