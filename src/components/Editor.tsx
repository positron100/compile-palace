
import React, { useRef, useCallback, memo } from "react";
import { useEditorSetup } from "../hooks/useEditorSetup";
import { useCollaboration } from "../hooks/useCollaboration";
import { getRoomCode } from "../pusher";

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
  }, [onCodeChange]);
  
  // Setup CodeMirror editor
  const { editorRef, ignoreChangeRef } = useEditorSetup({
    onCodeChange: handleCodeChange,
    languageId: language.id
  });
  
  // Setup collaboration features
  useCollaboration({
    socketRef,
    roomId,
    username,
    editorRef,
    ignoreChangeRef,
    onCodeChange: handleCodeChange
  });
  
  return <textarea id="realtimeEditor"></textarea>;
});

Editor.displayName = "Editor";

export default Editor;
