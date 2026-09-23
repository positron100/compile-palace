
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
import "codemirror/addon/selection/active-line";
// CodeMirror's own built-in overlay-scrollbar model — already part of the
// installed `codemirror` package, not a new dependency. `scrollbarStyle:
// "overlay"` (below) makes it the ACTUAL scroll container's scrollbar (real
// scrollTop/scrollLeft, real wheel/keyboard/drag support all still native to
// CodeMirror — nothing reimplemented), just rendered as a thin
// `position: absolute` pill instead of the browser's default UI. It also
// auto-offsets the horizontal bar past the gutter's own measured width
// (`measure.barLeft` in the addon source), so the "must not overlap the
// gutter" requirement is satisfied by the library itself, not new code.
import "codemirror/addon/scroll/simplescrollbars";
import "codemirror/addon/scroll/simplescrollbars.css";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/neat.css";

interface UseEditorSetupProps {
  onCodeChange: (code: string) => void;
  languageId: number;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
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

export const useEditorSetup = ({ onCodeChange, languageId, textareaRef }: UseEditorSetupProps) => {
  const editorRef = useRef<Codemirror.Editor | null>(null);
  const ignoreChangeRef = useRef<boolean>(false);

  // Initialize editor
  useEffect(() => {
    async function init() {
      // Was `document.getElementById("realtimeEditor")` — a bare ID lookup
      // has no guarantee about when it runs relative to this component's own
      // commit, unlike a ref (React attaches refs before this effect can run
      // for the same render). Under the Room -> Editor View Transition
      // (flushSync + document.startViewTransition in stageTransition.ts),
      // that guarantee occasionally didn't hold: the lookup missed once,
      // this effect's `[]` deps meant it could never retry, and CodeMirror
      // never initialized for the rest of that mount — the raw textarea sat
      // there unstyled (reads as a blank editor) until a full page reload
      // reran everything from scratch. A ref removes the race instead of
      // papering over it with a retry loop.
      const textarea = textareaRef.current;
      if (!textarea) return;

      editorRef.current = Codemirror.fromTextArea(
        textarea,
        {
          mode: getModeForLanguage(languageId),
          theme: "neat",
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
          undoDepth: 200,
          historyEventDelay: 200,
          styleActiveLine: true,
          scrollbarStyle: "overlay"
        }
      );

      // Handle initial editor content
      if (editorRef.current) {
        const initialCode = editorRef.current.getValue();
        onCodeChange(initialCode);
      }

      // Section 7 — "scrolling" brightens the bars, fading back to idle a
      // moment after scrolling stops. A plain class toggle via a ref'd DOM
      // node (not React state) so this never re-renders the component on
      // every scroll tick (section 13) — CodeMirror's own "scroll" event is
      // the real scroll container's event, not a synthetic wheel handler.
      let scrollFadeTimer: ReturnType<typeof setTimeout> | null = null;
      editorRef.current?.on("scroll", (cmInstance) => {
        const wrapper = cmInstance.getWrapperElement();
        wrapper.classList.add("cp-cm-scrolling");
        if (scrollFadeTimer) clearTimeout(scrollFadeTimer);
        scrollFadeTimer = setTimeout(() => {
          wrapper.classList.remove("cp-cm-scrolling");
        }, 700);
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
