
import { useState, useEffect, useRef, useCallback } from "react";
import ACTIONS from "../Actions";
import pusher, { updateRoomCode, getRoomCode, getChannelType } from "../pusher";
import { toast } from "sonner";

interface UseCollaborationProps {
  socketRef: React.MutableRefObject<any>;
  roomId: string;
  username: string;
  editorRef: React.MutableRefObject<any>;
  ignoreChangeRef: React.MutableRefObject<boolean>;
  onCodeChange: (code: string) => void;
}

export const useCollaboration = ({
  socketRef,
  roomId,
  username,
  editorRef,
  ignoreChangeRef,
  onCodeChange
}: UseCollaborationProps) => {
  const [channel, setChannel] = useState<any>(null);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<number>(0);
  const previousCodeRef = useRef<string>("");
  const roomIdRef = useRef<string>(roomId);
  const THROTTLE_MS = 50; // Reduced from 100ms for faster updates
  
  // Update roomId ref when prop changes
  useEffect(() => {
    roomIdRef.current = roomId;
    // Save username in localStorage for Pusher auth
    if (username) {
      localStorage.setItem('username', username);
    }
  }, [roomId, username]);

  // Handle remote code changes
  const handleRemoteChange = useCallback((data: { code: string, author?: string }) => {
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
      
      // Update global room state
      updateRoomCode(roomIdRef.current, data.code);
      
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
  }, [editorRef, ignoreChangeRef, onCodeChange, username]);

  // Handler for sync requests
  const handleSyncRequest = useCallback((data: any) => {
    console.log("Received code sync request from:", data?.requestor || "unknown");
    if (editorRef.current) {
      const currentCode = editorRef.current.getValue();
      const storedCode = getRoomCode(roomIdRef.current);
      
      // Use current code, stored code, or previous code - in that order
      const codeToSync = currentCode || storedCode || previousCodeRef.current;
      
      // Only send sync if we have code or we're the first user (room creator)
      if (codeToSync) {
        // Send via socket AND client event for redundancy
        if (socketRef.current) {
          socketRef.current.emit(ACTIONS.SYNC_RESPONSE, {
            roomId: roomIdRef.current,
            code: codeToSync,
            author: username
          });
          console.log("Sent sync via socket");
          
          // Also update global state
          updateRoomCode(roomIdRef.current, codeToSync);
        }
        
        // Also try to broadcast through the channel if it's available
        if (channel) {
          try {
            // Use trigger instead of client event since we're on a public channel
            channel.trigger(ACTIONS.SYNC_RESPONSE, {
              code: codeToSync,
              author: username
            });
            console.log("Sent sync via channel trigger");
          } catch (err) {
            console.error("Error sending sync via channel", err);
          }
        }
      } else {
        console.log("No code to sync yet");
      }
    }
  }, [channel, editorRef, roomIdRef, socketRef, username]);

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
      // Unbind all previous events from old channels if any
      if (channel) {
        channel.unbind_all();
      }
      
      const newChannel = pusher.subscribe(channelName);
      console.log(`Successfully subscribed to channel: ${channelName}`, newChannel);
      
      // Set up event handlers for public events
      newChannel.bind(ACTIONS.CODE_CHANGE, handleRemoteChange);
      newChannel.bind(ACTIONS.SYNC_CODE, handleRemoteChange);
      newChannel.bind(ACTIONS.SYNC_RESPONSE, handleRemoteChange);
      newChannel.bind(ACTIONS.SYNC_REQUEST, handleSyncRequest);
      newChannel.bind(ACTIONS.CODE_UPDATE, handleRemoteChange);
      newChannel.bind(ACTIONS.CODE_BROADCAST, handleRemoteChange);
      newChannel.bind(ACTIONS.ROOM_CODE_UPDATE, handleRemoteChange);
      
      // Add an event handler for acknowledging user presence
      newChannel.bind(ACTIONS.JOIN_ROOM, (data: any) => {
        console.log(`User ${data.username} joined the room`);
        // If we have any code, send it as a response
        if (editorRef.current) {
          const currentCode = editorRef.current.getValue();
          const storedCode = getRoomCode(roomIdRef.current);
          
          // Use current code, stored code, or previous code - in that order
          const codeToSync = currentCode || storedCode || previousCodeRef.current;
          
          if (codeToSync) {
            // Send via socket
            if (socketRef.current) {
              socketRef.current.emit(ACTIONS.SYNC_RESPONSE, {
                roomId: roomIdRef.current,
                code: codeToSync,
                author: username
              });
              console.log(`Sent current code to new user ${data.username} via socket`);
              
              // Also update global state
              updateRoomCode(roomIdRef.current, codeToSync);
            }
            
            // Also try to broadcast through the channel
            try {
              // Use trigger instead of client event for public channels
              newChannel.trigger(ACTIONS.SYNC_RESPONSE, {
                code: codeToSync,
                author: username
              });
              console.log(`Sent current code to new user ${data.username} via channel trigger`);
            } catch (err) {
              console.error("Error sending sync via channel", err);
            }
          }
        }
      });
      
      // When subscription succeeds, announce presence and request initial code
      newChannel.bind('pusher:subscription_succeeded', () => {
        console.log('Successfully subscribed to public channel:', channelName);
        
        // Check for existing code in global state
        const storedCode = getRoomCode(roomIdRef.current);
        if (storedCode) {
          console.log('Found stored code in global state, applying it');
          handleRemoteChange({ code: storedCode, author: 'system' });
        }
        
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
            
            // Global sync request
            socketRef.current.emit(ACTIONS.GLOBAL_SYNC_REQUEST, { 
              roomId: roomIdRef.current,
              requestor: username 
            });
            console.log("Requesting global state sync via socket");
          }, 300);
        }
        
        // Also try to broadcast through the channel
        try {
          // Use trigger for public channels
          newChannel.trigger(ACTIONS.JOIN_ROOM, {
            username,
            timestamp: Date.now()
          });
          console.log(`Announced joining room as ${username} via channel trigger`);
          
          // Also request code sync via channel
          newChannel.trigger(ACTIONS.SYNC_REQUEST, {
            requestor: username
          });
          console.log("Requesting initial code sync via channel trigger");
        } catch (err) {
          console.error("Error sending join/sync events via channel", err);
        }
      });
      
      // Global sync response handler
      newChannel.bind(ACTIONS.GLOBAL_SYNC_RESPONSE, (data: any) => {
        console.log("Received global sync response:", data);
        if (data && data.code) {
          handleRemoteChange({ code: data.code, author: 'system' });
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
          
          // Then unbind and unsubscribe
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
  }, [roomId, username, socketRef, handleRemoteChange, handleSyncRequest, editorRef, channel]);

  // Setup handlers for editor changes
  const setupEditorChangeHandlers = useCallback(() => {
    if (!editorRef.current) return;

    // Handling code changes with reduced throttling for faster updates
    editorRef.current.on("change", (instance: any, changes: any) => {
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
        
        // Update global state
        updateRoomCode(roomIdRef.current, code);
        
        // Reduced throttle time for faster real-time updates
        const now = Date.now();
        if (now - lastEventTimestamp > THROTTLE_MS && roomIdRef.current) {
          setLastEventTimestamp(now);
          
          // Use socket for communication
          if (socketRef.current) {
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
              roomId: roomIdRef.current,
              code,
              author: username
            });
            
            // Also emit the CODE_BROADCAST event for redundancy
            socketRef.current.emit(ACTIONS.CODE_BROADCAST, {
              roomId: roomIdRef.current,
              code,
              author: username
            });
            
            // Emit the new consistent event name
            socketRef.current.emit(ACTIONS.ROOM_CODE_UPDATE, {
              roomId: roomIdRef.current,
              code,
              author: username
            });
          }
          
          // Also try to broadcast via channel
          if (channel) {
            try {
              // Use trigger for public channels
              channel.trigger(ACTIONS.CODE_BROADCAST, {
                code,
                author: username
              });
              
              // Also use the new consistent event name
              channel.trigger(ACTIONS.ROOM_CODE_UPDATE, {
                code,
                author: username
              });
            } catch (err) {
              console.error("Error broadcasting code change via channel", err);
            }
          }
        }
      }
    });
  }, [editorRef, ignoreChangeRef, lastEventTimestamp, onCodeChange, roomIdRef, socketRef, username, channel]);

  // Setup editor change handlers when editor and channel are ready
  useEffect(() => {
    if (editorRef.current) {
      setupEditorChangeHandlers();
    }
  }, [editorRef, setupEditorChangeHandlers]);

  return {
    channel,
    handleRemoteChange,
    handleSyncRequest
  };
};
