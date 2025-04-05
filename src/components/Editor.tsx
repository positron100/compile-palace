
import React, { useRef } from "react";
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

const Editor: React.FC<EditorProps> = ({ 
  socketRef, 
  roomId, 
  onCodeChange, 
  language, 
  username = 'Anonymous' 
}) => {
  const codeRef = useRef<string>(getRoomCode(roomId) || "");
  
  // Setup CodeMirror editor
  const { editorRef, ignoreChangeRef } = useEditorSetup({
    onCodeChange: (code: string) => {
      codeRef.current = code;
      onCodeChange(code);
    },
    languageId: language.id
  });
  
  // Setup collaboration features
  useCollaboration({
    socketRef,
    roomId,
    username,
    editorRef,
    ignoreChangeRef,
    onCodeChange: (code: string) => {
      codeRef.current = code;
      onCodeChange(code);
    }
  });
  
  return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;
