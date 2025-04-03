
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
import { toast } from "sonner";

interface EditorProps {
  socketRef: React.MutableRefObject<any>;
  roomId: string;
  onCodeChange: (code: string) => void;
  language: {
    id: number;
    name: string;
  };
  username?: string;
}

const Editor: React.FC<EditorProps> = ({ socketRef, roomId, onCodeChange, language, username = 'Anonymous' }) => {
  const editorRef = useRef<Codemirror.Editor | null>(null);
  const ignoreChangeRef = useRef<boolean>(false);
  const previousCodeRef = useRef<string>("");
  const roomIdRef = useRef<string>(roomId);
  const [channel, setChannel] = useState<any>(null);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<number>(0);
  const THROTTLE_MS = 100;
  
  // Update roomId ref when prop changes
  useEffect(() => {
    roomIdRef.current = roomId;
    // Save username in localStorage for Pusher auth
    if (username) {
      localStorage.setItem('username', username);
    }
  }, [roomId, username]);
  
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

  // Handle remote code changes
  const handleRemoteChange = (data: { code: string, author?: string }) => {
    if (!editorRef.current || !data.code) {
      console.log("Remote change ignored: editor not ready or no code received");
      return;
    }
    
    // Skip if the code is exactly the same (prevents unnecessary updates)
    if (data.code === previousCodeRef.current) {
      console.log("Skipping identical remote code update");
      return;
    }
    
    console.log(`Received remote code change from ${data.author || 'unknown user'}`);
    
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
      
      // Show toast only if the author is different from the current user
      if (data.author && data.author !== username) {
        toast.info(`Code updated by ${data.author}`);
      }
    } catch (err) {
      console.error("Error applying remote code change:", err);
    } finally {
      // Restore cursor position and scroll state
      editorRef.current.setCursor(cursor);
      editorRef.current.scrollTo(scrollInfo.left, scrollInfo.top);
      
      // Reset ignore flag after a short delay
      setTimeout(() => {
        ignoreChangeRef.current = false;
      }, 10);
    }
  };

  // Handler for sync requests
  const handleSyncRequest = (data: any) => {
    console.log("Received code sync request from:", data?.requestor || "unknown");
    if (editorRef.current) {
      const currentCode = editorRef.current.getValue();
      
      // Only send sync if we have code or we're the first user (room creator)
      if (currentCode || previousCodeRef.current) {
        // Send via socket instead of client event
        if (socketRef.current) {
          socketRef.current.emit(ACTIONS.SYNC_RESPONSE, {
            roomId: roomIdRef.current,
            code: currentCode || previousCodeRef.current,
            author: username
          });
          console.log("Sent sync via socket");
        }
      } else {
        console.log("No code to sync yet");
      }
    }
  };

  // Subscribe to Pusher channel for the room
  useEffect(() => {
    if (!roomId) {
      console.log("No room ID provided, skipping Pusher subscription");
      return;
    }
    
    console.log(`Subscribing to Pusher channel for room: ${roomId}`);
    
    // Subscribe to the PUBLIC channel for this room
    const channelName = `collab-${roomId}`;
    
    try {
      const newChannel = pusher.subscribe(channelName);
      console.log(`Successfully subscribed to channel: ${channelName}`);
      
      // Set up event handlers for public events
      newChannel.bind(ACTIONS.CODE_CHANGE, handleRemoteChange);
      newChannel.bind(ACTIONS.SYNC_CODE, handleRemoteChange);
      newChannel.bind(ACTIONS.SYNC_RESPONSE, handleRemoteChange);
      newChannel.bind(ACTIONS.SYNC_REQUEST, handleSyncRequest);
      newChannel.bind(ACTIONS.CODE_UPDATE, handleRemoteChange);  // New public event
      
      // Add an event handler for acknowledging user presence
      newChannel.bind(ACTIONS.JOIN_ROOM, (data: any) => {
        console.log(`User ${data.username} joined the room`);
        // If we have any code, send it as a response via socket
        if (editorRef.current && (editorRef.current.getValue() || previousCodeRef.current)) {
          if (socketRef.current) {
            socketRef.current.emit(ACTIONS.SYNC_RESPONSE, {
              roomId: roomIdRef.current,
              code: editorRef.current.getValue() || previousCodeRef.current,
              author: username
            });
            console.log(`Sent current code to new user ${data.username} via socket`);
          }
        }
      });
      
      // When subscription succeeds, announce presence and request initial code via socket
      newChannel.bind('pusher:subscription_succeeded', () => {
        console.log('Successfully subscribed to public channel:', channelName);
        
        // Announce presence via socket
        if (socketRef.current) {
          socketRef.current.emit(ACTIONS.PRESENCE_UPDATE_EVENT, {
            roomId: roomIdRef.current,
            username,
            timestamp: Date.now(),
            action: 'connected'
          });
          console.log(`Announced presence as ${username} via socket`);
          
          // Also announce joining the room via socket
          socketRef.current.emit(ACTIONS.JOIN_ROOM, {
            roomId: roomIdRef.current,
            username,
            timestamp: Date.now()
          });
          console.log(`Announced joining room as ${username} via socket`);
          
          // Request initial code sync via socket
          setTimeout(() => {
            socketRef.current.emit(ACTIONS.SYNC_REQUEST, { 
              roomId: roomIdRef.current,
              requestor: username 
            });
            console.log("Requesting initial code sync via socket");
          }, 500);
        }
      });
      
      // Store channel reference
      setChannel(newChannel);
      
      // Cleanup subscription when component unmounts or roomId changes
      return () => {
        console.log(`Unsubscribing from Pusher channel: ${channelName}`);
        try {
          // Announce disconnection via socket
          if (socketRef.current) {
            socketRef.current.emit(ACTIONS.PRESENCE_UPDATE_EVENT, {
              roomId: roomIdRef.current,
              username,
              timestamp: Date.now(),
              action: 'disconnected'
            });
          }
          
          // Then unsubscribe
          newChannel.unbind_all();
          pusher.unsubscribe(channelName);
        } catch (err) {
          console.error("Error unsubscribing from channel", err);
        }
      };
    } catch (err) {
      console.error("Error subscribing to Pusher channel", err);
      return () => {};
    }
  }, [roomId, username, socketRef]);

  // Initializing code editor and handling changes
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

      // Handling code changes with throttling to reduce network traffic
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
          
          // Throttle updates to reduce network traffic
          const now = Date.now();
          if (now - lastEventTimestamp > THROTTLE_MS && roomIdRef.current) {
            setLastEventTimestamp(now);
            
            // Use socket for all communication since we can't use client events on public channels
            if (socketRef.current) {
              socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                roomId: roomIdRef.current,
                code,
                author: username
              });
              console.log("Sent code change via socket");
            } else {
              console.warn("No way to emit code change - local mode only");
            }
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
  }, []);

  // Update editor mode when language changes
  useEffect(() => {
    if (editorRef.current && language) {
      editorRef.current.setOption("mode", getModeForLanguage(language.id));
    }
  }, [language]);
  
  return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;
