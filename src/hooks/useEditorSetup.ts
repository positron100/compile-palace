
import { useEffect, useRef } from "react";
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

interface UseEditorSetupProps {
  onCodeChange: (code: string) => void;
  languageId: number;
}

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

export const useEditorSetup = ({ onCodeChange, languageId }: UseEditorSetupProps) => {
  const editorRef = useRef<Codemirror.Editor | null>(null);
  const ignoreChangeRef = useRef<boolean>(false);

  // Initialize editor
  useEffect(() => {
    async function init() {
      const textarea = document.getElementById("realtimeEditor");
      if (!textarea) return;
      
      editorRef.current = Codemirror.fromTextArea(
        textarea as HTMLTextAreaElement,
        {
          mode: getModeForLanguage(languageId),
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
        onCodeChange(initialCode);
      }
    }
    
    init();
    
    return () => {
      // Cleanup CodeMirror instance
      if (editorRef.current) {
        editorRef.current.toTextArea();
        editorRef.current = null;
      }
    };
  }, []);

  // Update editor mode when language changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setOption("mode", getModeForLanguage(languageId));
    }
  }, [languageId]);

  return { 
    editorRef,
    ignoreChangeRef,
    getModeForLanguage
  };
};
