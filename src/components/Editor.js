
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

const Editor = ({ socketRef, roomId, onCodeChange, language }) => {
  const editorRef = useRef(null);
  
  // Set the appropriate mode based on the selected language
  const getModeForLanguage = (langId) => {
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
      editorRef.current = Codemirror.fromTextArea(
        document.getElementById("realtimeEditor"),
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
        onCodeChange(code);
        if (origin !== "setValue") {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, {
            roomId,
            code,
          });
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
    // recieving the changed code
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        // if code is null then it will get deleted from the editor
        if (code !== null) {
          // dynamically adding text to editor
          editorRef.current.setValue(code);
        }
      });
    }

    return () => {
      // eslint-disable-next-line
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    }
    // eslint-disable-next-line   
  }, [socketRef.current]);

  return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;
