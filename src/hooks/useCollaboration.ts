
import { useEffect, useRef, useCallback } from "react";
import ACTIONS from "../Actions";
import { updateRoomCode, getRoomCode } from "../socket";
import { toast } from "sonner";
import { debounce } from "lodash";

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
  const previousCodeRef = useRef<string>("");
  const roomIdRef = useRef<string>(roomId);
  const THROTTLE_MS = 500;
  const syncAttemptRef = useRef<number>(0);
  const MAX_SYNC_ATTEMPTS = 3;
  
  // Update roomId ref when prop changes
  useEffect(() => {
    roomIdRef.current = roomId;
    // Save username in localStorage
    if (username) {
      localStorage.setItem('username', username);
    }
  }, [roomId, username]);

  // Handle remote code changes
  const handleRemoteChange = useCallback((data: { code: string, author?: string }) => {
    if (!editorRef.current || !data.code) {
      return;
    }
    
    // Skip if the code is exactly the same (prevents unnecessary updates)
    if (data.code === previousCodeRef.current) {
      return;
    }
    
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
      
      // Update room code store
      updateRoomCode(roomIdRef.current, data.code);
      
      // Notify parent component
      onCodeChange(data.code);
      
      // Reset sync attempts since we got code
      syncAttemptRef.current = 0;
      
      // Show toast only if the author is different from the current user
      if (data.author && data.author !== username) {
        toast.info(`Code updated by ${data.author}`);
      }
    } catch (err) {
      // Error handling
      console.error('Error applying remote code change:', err);
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
    if (editorRef.current && socketRef.current) {
      const currentCode = editorRef.current.getValue();
      const storedCode = getRoomCode(roomIdRef.current);
      
      // Use current code, stored code, or previous code - in that order
      const codeToSync = currentCode || storedCode || previousCodeRef.current;
      
      // Only send sync if we have code
      if (codeToSync) {
        socketRef.current.emit(ACTIONS.SYNC_RESPONSE, {
          roomId: roomIdRef.current,
          code: codeToSync,
          author: username
        });
        
        // Also update room code store
        updateRoomCode(roomIdRef.current, codeToSync);
      }
    }
  }, [editorRef, roomIdRef, socketRef, username]);

  // Request code sync - can be called multiple times with backoff
  const requestCodeSync = useCallback(() => {
    if (syncAttemptRef.current >= MAX_SYNC_ATTEMPTS || !socketRef.current) {
      return;
    }
    
    // Exponential backoff for retries
    const delay = syncAttemptRef.current === 0 ? 300 : 1000 * Math.pow(2, syncAttemptRef.current - 1);
    
    setTimeout(() => {
      if (socketRef.current) {
        // Request code sync from other users
        socketRef.current.emit(ACTIONS.SYNC_REQUEST, { 
          roomId: roomIdRef.current,
          requestor: username
        });
        
        // Increment attempt counter
        syncAttemptRef.current += 1;
      }
    }, delay);
  }, [roomIdRef, socketRef, username]);

  // Subscribe to socket events
  useEffect(() => {
    if (!roomId || !socketRef.current) {
      return;
    }
    
    const socket = socketRef.current;
    
    // Set up event handlers
    socket.on(ACTIONS.CODE_CHANGE, handleRemoteChange);
    socket.on(ACTIONS.SYNC_CODE, handleRemoteChange);
    socket.on(ACTIONS.SYNC_RESPONSE, handleRemoteChange);
    socket.on(ACTIONS.SYNC_REQUEST, handleSyncRequest);
    
    // Clear attempt counter on new subscription
    syncAttemptRef.current = 0;
    
    // Request initial code sync when joining with retry mechanism
    requestCodeSync();
    
    // Apply any stored code from local storage
    const storedCode = getRoomCode(roomIdRef.current);
    if (storedCode) {
      handleRemoteChange({ code: storedCode, author: 'system' });
    }
    
    // Cleanup event listeners when component unmounts or roomId changes
    return () => {
      socket.off(ACTIONS.CODE_CHANGE, handleRemoteChange);
      socket.off(ACTIONS.SYNC_CODE, handleRemoteChange);
      socket.off(ACTIONS.SYNC_RESPONSE, handleRemoteChange);
      socket.off(ACTIONS.SYNC_REQUEST, handleSyncRequest);
    };
  }, [roomId, username, socketRef, handleRemoteChange, handleSyncRequest, requestCodeSync]);

  // Setup handlers for editor changes with debouncing
  useEffect(() => {
    if (!editorRef.current || !socketRef.current) return;
    
    // Debounced function to send code changes
    const sendCodeChange = debounce((code: string) => {
      if (socketRef.current && roomIdRef.current) {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId: roomIdRef.current,
          code,
          author: username
        });
        
        // Also update room code store
        updateRoomCode(roomIdRef.current, code);
      }
    }, THROTTLE_MS);
    
    // Handle editor changes
    const handleEditorChange = (instance: any, changes: any) => {
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
        
        // Send code change to other clients
        sendCodeChange(code);
      }
    };
    
    // Add change handler to editor
    editorRef.current.on("change", handleEditorChange);
    
    // Cleanup
    return () => {
      editorRef.current?.off("change", handleEditorChange);
      sendCodeChange.cancel();
    };
  }, [editorRef, ignoreChangeRef, onCodeChange, roomIdRef, socketRef, username, THROTTLE_MS]);

  return {
    handleRemoteChange,
    handleSyncRequest,
    requestCodeSync
  };
};
