import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import "./LaptopIntro.css";

type Token = { text: string; cls?: "kw" | "fn" | "var" | "str" };

const LINES: { indent: number; tokens: Token[] }[] = [
  { indent: 0, tokens: [{ text: "def ", cls: "kw" }, { text: "main", cls: "fn" }, { text: "():" }] },
  { indent: 1, tokens: [{ text: "print", cls: "fn" }, { text: "(" }, { text: '"Hello, World!"', cls: "str" }, { text: ")" }] },
  { indent: 0, tokens: [] },
  { indent: 0, tokens: [{ text: "main", cls: "fn" }, { text: "()" }] },
];

const LINE_LENGTHS = LINES.map((line) => line.tokens.reduce((n, t) => n + t.text.length, 0));
const TOTAL_LENGTH = LINE_LENGTHS.reduce((a, b) => a + b, 0);

/** Trims a token line down to `n` visible characters, splitting the token that straddles the cut. */
function sliceLine(tokens: Token[], n: number): Token[] {
  if (n <= 0) return [];
  const out: Token[] = [];
  let remaining = n;
  for (const token of tokens) {
    if (remaining <= 0) break;
    if (token.text.length <= remaining) {
      out.push(token);
      remaining -= token.text.length;
    } else {
      out.push({ ...token, text: token.text.slice(0, remaining) });
      remaining = 0;
    }
  }
  return out;
}

type Stage = "closed" | "code" | "compiling" | "output" | "closing";

interface LaptopIntroProps {
  /**
   * Replays the whole sequence forever instead of settling at the output
   * frame. Lid-close is the same transform as opening, just toggled back
   * off — so the reverse leg is free and smooth, never a remount or a hard
   * cut back to frame 0.
   */
  loop?: boolean;
}

/**
 * "Compile Palace is starting up": the lid opens, a Python hello-world types
 * itself in, then a brief compile/run beat reveals the output. Simple,
 * direct lid-open choreography — no camera rig. One `stage` state machine
 * drives both the CSS transform and the terminal content; every step is a
 * CSS transition or a plain setTimeout char counter — no rAF loop, no
 * canvas. Reduced motion jumps straight to the open/output end state.
 */
export function LaptopIntro({ loop = false }: LaptopIntroProps) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>(reduce ? "output" : "closed");
  const [revealed, setRevealed] = useState(reduce ? TOTAL_LENGTH : 0);
  const opened = stage === "code" || stage === "compiling" || stage === "output";

  // Lid opens -> compile/run -> (loop) closes -> reopens.
  useEffect(() => {
    if (reduce) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (stage === "closed") t = setTimeout(() => setStage("code"), 200);
    else if (stage === "compiling") t = setTimeout(() => setStage("output"), 650);
    else if (stage === "output") t = setTimeout(() => loop && setStage("closing"), 1600);
    else if (stage === "closing") {
      t = setTimeout(() => {
        setRevealed(0);
        setStage("closed");
      }, 900);
    }
    return () => t && clearTimeout(t);
  }, [stage, reduce, loop]);

  // Python code types once the lid is open, then hands off to compiling.
  useEffect(() => {
    if (reduce || stage !== "code") return;
    if (revealed >= TOTAL_LENGTH) {
      const t = setTimeout(() => setStage("compiling"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealed((n) => n + 1), 32);
    return () => clearTimeout(t);
  }, [stage, revealed, reduce]);

  const ready = stage === "output";
  const terminalPhase = stage === "compiling" ? "compiling" : stage === "output" ? "output" : "code";

  const lines = useMemo(() => {
    let consumed = 0;
    return LINES.map((line, i) => {
      const lineLen = LINE_LENGTHS[i];
      const visible = Math.max(0, Math.min(lineLen, revealed - consumed));
      consumed += lineLen;
      return { indent: line.indent, tokens: sliceLine(line.tokens, visible), isCurrent: visible > 0 && visible < lineLen };
    });
  }, [revealed]);

  return (
    <div className="laptop-scene" data-ready={ready || undefined} aria-hidden="true">
      <div className={`laptop ${opened ? "laptop--open" : ""}`}>
        <div className="laptop__screen">
          <div className="laptop__bezel">
            <div className="laptop__cam" />
          </div>
          <div className="laptop__display">
            <div className="laptop__dots">
              <span />
              <span />
              <span />
            </div>
            <pre className="laptop__code">
              {lines.map((line, i) => (
                <div className="laptop-line" key={i} style={{ paddingLeft: `${line.indent * 1.1}rem` }}>
                  {line.tokens.map((t, j) => (
                    <span key={j} className={t.cls ? `tok-${t.cls}` : undefined}>
                      {t.text}
                    </span>
                  ))}
                  {line.isCurrent && <span className="laptop__caret" />}
                </div>
              ))}
            </pre>
            <div className="laptop__terminal" data-phase={terminalPhase}>
              <div className="laptop__prompt">$ python main.py</div>
              <div className="laptop__output">Hello, welcome to Compile Palace.</div>
            </div>
          </div>
        </div>
        <div className="laptop__hinge" />
        <div className="laptop__base">
          <div className="laptop__trackpad" />
        </div>
      </div>
      {!loop && (
        <p className="laptop-scene__tagline" data-visible={ready || undefined}>
          Compile Palace is ready.
        </p>
      )}
    </div>
  );
}
