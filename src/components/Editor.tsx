
import React, { useEffect, useRef, useState } from "react";
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
import pusher from "../pusher";

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
  const [channel, setChannel] = useState<any>(null);
  
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

  // Handle remote code changes from Pusher
  const handleRemoteChange = (data: { code: string }) => {
    if (!editorRef.current || !data.code) {
      return; // Ignore if editor not ready or no code
    }
    
    // Skip if the code is exactly the same (prevents unnecessary updates)
    if (data.code === previousCodeRef.current) {
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
      editorRef.current.setValue(data.code);
      
      // Update the previous code ref
      previousCodeRef.current = data.code;
      
      // Notify parent component
      onCodeChange(data.code);
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

  // Subscribe to Pusher channel for the room
  useEffect(() => {
    if (!roomId) return;
    
    console.log(`Subscribing to Pusher channel for room: ${roomId}`);
    
    // Subscribe to the channel for this room
    const channelName = `collab-${roomId}`;
    const newChannel = pusher.subscribe(channelName);
    
    // Set up event handlers
    newChannel.bind(ACTIONS.CODE_CHANGE, handleRemoteChange);
    newChannel.bind(ACTIONS.SYNC_CODE, handleRemoteChange);
    
    // Request sync when first joining
    console.log("New editor requesting initial code sync");
    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.SYNC_CODE, { roomId });
    }
    
    // Store channel reference
    setChannel(newChannel);
    
    // Cleanup subscription when component unmounts or roomId changes
    return () => {
      console.log(`Unsubscribing from Pusher channel: ${channelName}`);
      newChannel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [roomId]);

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
          
          // Send update to Pusher backend
          if (roomIdRef.current) {
            fetch("https://lovable-pusher-fyi9.onrender.com/pusher/code-update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomId: roomIdRef.current,
                code
              }),
            }).catch(err => {
              console.error("Error sending code update to Pusher backend:", err);
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
  
  return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;
