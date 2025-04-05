
import React, { useRef, useCallback, memo, useEffect } from "react";
import { useEditorSetup } from "../hooks/useEditorSetup";
import { useCollaboration } from "../hooks/useCollaboration";
import { getRoomCode, updateRoomCode } from "../pusher";

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

const Editor: React.FC<EditorProps> = memo(({ 
  socketRef, 
  roomId, 
  onCodeChange, 
  language, 
  username = 'Anonymous' 
}) => {
  const codeRef = useRef<string>(getRoomCode(roomId) || "");
  
  // Memoize the code change handler to prevent unnecessary re-renders
  const handleCodeChange = useCallback((code: string) => {
    codeRef.current = code;
    onCodeChange(code);
    
    // Directly update the room code when it changes
    updateRoomCode(roomId, code);
  }, [onCodeChange, roomId]);
  
  // Setup CodeMirror editor
  const { editorRef, ignoreChangeRef } = useEditorSetup({
    onCodeChange: handleCodeChange,
    languageId: language.id
  });
  
  // Setup collaboration features
  const { handleRemoteChange } = useCollaboration({
    socketRef,
    roomId,
    username,
    editorRef,
    ignoreChangeRef,
    onCodeChange: handleCodeChange
  });
  
  // Apply initial code if available when the component mounts
  useEffect(() => {
    const initialCode = getRoomCode(roomId);
    if (initialCode && editorRef.current && !codeRef.current) {
      // Set flag to ignore the change event this will trigger
      ignoreChangeRef.current = true;
      editorRef.current.setValue(initialCode);
      codeRef.current = initialCode;
      onCodeChange(initialCode);
      setTimeout(() => {
        ignoreChangeRef.current = false;
      }, 10);
    }
  }, [roomId, onCodeChange, editorRef, ignoreChangeRef]);
  
  return <textarea id="realtimeEditor"></textarea>;
});

Editor.displayName = "Editor";

export default Editor;
