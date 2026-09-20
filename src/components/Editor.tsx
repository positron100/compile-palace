
import React, { useRef, useCallback, memo, useEffect } from "react";
import { useEditorSetup } from "../hooks/useEditorSetup";
import { useCollaboration } from "../hooks/useCollaboration";
import { getRoomCode } from "../socket";

interface EditorProps {
  socketRef: React.MutableRefObject<any>;
  roomId: string;
  onCodeChange: (code: string) => void;
  language: {
    id: number;
    name: string;
  };
  username?: string;
  initialCode?: string | null;
}

const Editor: React.FC<EditorProps> = memo(({
  socketRef,
  roomId,
  onCodeChange,
  language,
  username = 'Anonymous',
  initialCode = null
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
  const { handleRemoteChange, requestCodeSync } = useCollaboration({
    socketRef,
    roomId,
    username,
    editorRef,
    ignoreChangeRef,
    onCodeChange: handleCodeChange
  });
  
  // Apply initial code if available when the component mounts, or once it
  // arrives from the database (initialCode resolves asynchronously after mount)
  useEffect(() => {
    const codeToApply = initialCode || getRoomCode(roomId);
    if (codeToApply && editorRef.current && !codeRef.current) {
      // Set flag to ignore the change event this will trigger
      ignoreChangeRef.current = true;
      editorRef.current.setValue(codeToApply);
      codeRef.current = codeToApply;
      onCodeChange(codeToApply);
      setTimeout(() => {
        ignoreChangeRef.current = false;
      }, 10);
    } else if (!codeToApply && socketRef.current) {
      // Explicitly request code sync if we don't have initial code
      // This helps ensure new users get the latest code
      requestCodeSync();
    }
  }, [roomId, onCodeChange, editorRef, ignoreChangeRef, socketRef, requestCodeSync, initialCode]);
  
  return <textarea id="realtimeEditor"></textarea>;
});

Editor.displayName = "Editor";

export default Editor;
