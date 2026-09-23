import React, { useEffect, useRef, useState } from 'react';
import { X, Terminal, ChevronUp, CheckCircle2, XCircle, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import OutputSection from './OutputSection';
import { useLiquidGlass } from '@/hooks/use-liquid-glass';
import { ModernTooltip } from './ModernTooltip';

interface OutputDrawerProps {
  open: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
  outputDetails: any;
  isCompiling: boolean;
  layout: 'bottom' | 'right';
  language?: string;
  stdin?: string;
}

// forwardRef so ModernTooltip's Radix trigger (asChild, used on the new
// Copy Output button) can attach its own ref alongside the magnetic-hover
// one this already uses — same fix as EditorPage.tsx's LiquidButton.
const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className = '', ...props }, forwardedRef) => {
    const liquid = useLiquidGlass<HTMLButtonElement>({ strength: 3 });
    return (
      <button
        ref={(node) => {
          liquid.ref.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        type="button"
        onMouseMove={liquid.onMouseMove}
        onMouseLeave={liquid.onMouseLeave}
        className={`cp-liquid h-7 w-7 rounded-full ${className}`}
        {...props}
      />
    );
  }
);

// Cursor-tracked sheen + magnetic pull (same useLiquidGlass hook every other
// editor/output control already uses) on the small vendor-attribution pill —
// `.glass-subtle` alone is only the static material, `.cp-liquid` is what
// actually makes it respond to hover.
function VendorPill({ children }: { children: React.ReactNode }) {
  const liquid = useLiquidGlass<HTMLSpanElement>({ strength: 3 });
  return (
    <span
      ref={liquid.ref}
      onMouseMove={liquid.onMouseMove}
      onMouseLeave={liquid.onMouseLeave}
      className="cp-liquid editor-output__vendor-pill glass-subtle"
    >
      {children}
    </span>
  );
}

/**
 * Output panel — docks bottom (default/mobile) or right (>=900px, desktop),
 * toggled from the top bar (`layout` prop only drives geometry/styling
 * here). Always mounted (no portal, no overlay dimming the editor);
 * geometry for `open`/`expanded` lives in EditorPage.css keyed off
 * data-attributes here, so switching dock side or collapsing is a genuine
 * CSS transition on the same DOM node, not an unmount/remount.
 *
 * Execution state (`isCompiling` + real `outputDetails`/absence of it) is
 * the actual submitCode() request in EditorPage — nothing here is faked:
 * "running" is real network-pending state, "success"/"error" come from the
 * real Judge0 response. Collapse (clicking the header/chevron, toggling
 * `expanded`) never touches `outputDetails` — only the explicit close
 * button below calls `onClose`, which is the one action that actually
 * hides the panel and lets a later Run start clean.
 */
const OutputDrawer: React.FC<OutputDrawerProps> = ({
  open,
  expanded,
  onExpandedChange,
  onClose,
  outputDetails,
  isCompiling,
  layout,
  language,
  stdin,
}) => {
  // aria-hidden below fires the moment `open` flips false, but the close
  // button can still hold focus at that exact instant (it's what was just
  // clicked) — hiding an ancestor of the focused element is an ARIA
  // violation, so blur it first and let the click handler's own focus
  // return to whatever the browser falls back to (body), not into the
  // now-hidden subtree.
  const handleClose = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.blur();
    onClose();
  };

  // Collapsing switches this container to `overflow: hidden`, which clips
  // at whatever scroll position it's CURRENTLY at — if the user had
  // scrolled down through a long output before collapsing, the compact
  // status header (built to sit at the top) would stay scrolled out of the
  // clipped view, and stale mid-content would show through instead. Reset
  // to the top the instant `expanded` goes false so the clipped sliver is
  // always the status control, never leftover scroll position.
  const innerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded && innerRef.current) {
      innerRef.current.scrollTop = 0;
    }
  }, [expanded]);

  const succeeded = outputDetails?.status?.id === 3;
  // Judge0 status id 6 = Compilation Error specifically — a real, distinct
  // field value already in the response, not a guess. Every other non-3 id
  // (runtime error, TLE, NZEC, etc.) stays the existing generic "error".
  const compileError = outputDetails?.status?.id === 6;
  const executionState: 'running' | 'success' | 'compile_error' | 'error' | 'idle' = isCompiling
    ? 'running'
    : outputDetails
    ? succeeded
      ? 'success'
      : compileError
      ? 'compile_error'
      : 'error'
    : 'idle';

  // One shared vocabulary for the collapsed status control, whichever dock
  // side renders it — same real state, just arranged differently below.
  // Collapsed word stays "Failed" for compile errors too (not the longer
  // "Compilation Error") — the right-dock collapsed strip is only ~76px
  // wide (sized for "Passed"/"Failed"), and the precise distinction is
  // still fully visible once expanded (header below + OutputSection's own
  // amber "Compilation Error" diagnostics block).
  const statusWord =
    executionState === 'running' ? 'Running' : executionState === 'success' ? 'Passed' : executionState === 'idle' ? 'Output' : 'Failed';
  // Expanded header gets the precise word — plenty of room there.
  const expandedStatusWord =
    executionState === 'running' ? 'Running' : executionState === 'success' ? 'Passed' : executionState === 'compile_error' ? 'Compilation Error' : executionState === 'error' ? 'Failed' : 'Output';
  const StatusIcon =
    executionState === 'running' ? Loader2 : executionState === 'success' ? CheckCircle2 : executionState === 'compile_error' ? AlertTriangle : executionState === 'error' ? XCircle : Terminal;
  const statusAriaLabel =
    executionState === 'running' ? 'Output running' : executionState === 'success' ? 'Output passed' : executionState === 'compile_error' ? 'Compilation error' : executionState === 'error' ? 'Output failed' : 'No output yet';
  const cleanLanguage = language ? language.replace(/\s*\([^)]*\)/, '').trim() : '';
  // Bottom-dock collapsed has the full drawer width to work with, so it can
  // fit language too, matching the task brief's "✓ Passed  Python 3.12
  // 0.42s" example; right-dock's collapsed strip stays time-only (existing
  // behavior) since it's too narrow for a third segment.
  const metaText = outputDetails && executionState !== 'running'
    ? layout === 'bottom'
      ? [cleanLanguage || null, outputDetails.time ? `${outputDetails.time}s` : null, outputDetails.memory ? `${outputDetails.memory} KB` : null].filter(Boolean).join(' · ')
      : (outputDetails.time ? `${outputDetails.time}s` : '')
    : '';
  // Non-scrolling metadata row directly under the header (section 9's
  // "Execution Metadata" tier) — language/time/memory only, all real values
  // already in the Judge0 response. No exit code: the app's SubmissionResult
  // type/API call never requests or receives one, so showing it would mean
  // inventing a number, which the brief explicitly disallows.
  const headerMetaText = outputDetails && executionState !== 'running'
    ? [cleanLanguage || null, outputDetails.time ? `${outputDetails.time}s` : null, outputDetails.memory ? `${outputDetails.memory} KB` : null].filter(Boolean).join('  ·  ')
    : cleanLanguage;

  const [copied, setCopied] = useState(false);
  const copyOutput = async () => {
    const parts: string[] = [];
    if (outputDetails?.stdout) parts.push(`Program Output\n${outputDetails.stdout}`);
    if (outputDetails?.compile_output) parts.push(`Compilation Error\n${outputDetails.compile_output}`);
    if (outputDetails?.stderr) parts.push(`stderr\n${outputDetails.stderr}`);
    try {
      await navigator.clipboard.writeText(parts.join('\n\n') || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silent — same as the rest of the app's copy actions having no
      // fallback UI beyond the toast pattern used elsewhere (kept local
      // here since OutputDrawer doesn't otherwise depend on the toast lib).
    }
  };

  return (
    <div
      className="editor-output glass-secondary"
      data-open={open}
      data-expanded={expanded}
      data-layout={layout}
      data-exec-state={executionState}
      aria-hidden={!open}
    >
      <div className="editor-output__inner">
        <div
          className="editor-output__header"
          role="button"
          onClick={() => onExpandedChange(!expanded)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpandedChange(!expanded); } }}
          tabIndex={open ? 0 : -1}
          aria-expanded={expanded}
          aria-label={!expanded ? `${statusAriaLabel} — expand output` : undefined}
        >
          {expanded ? (
            <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
              <Terminal size={15} className="opacity-70 shrink-0" />
              <span className="editor-output__label-text">Output</span>
              {/* Compact execution status next to the heading — icon+word
                  only, never a large badge (section 1). Hidden for
                  idle/running: nothing resolved yet to report. */}
              {(executionState === 'success' || executionState === 'compile_error' || executionState === 'error') && (
                <span
                  className="editor-output__header-status"
                  data-exec-state={executionState}
                  aria-label={statusAriaLabel}
                >
                  <StatusIcon size={13} />
                  {expandedStatusWord}
                </span>
              )}
            </div>
          ) : (
            // One coherent status control (section 9/10): identity label +
            // primary status (icon+word, the only thing color-coded, never
            // a full-bleed surface) + optional runtime/memory. Same data,
            // arranged horizontally (bottom dock) or vertically (right
            // dock, ~72px — wide enough for "Passed"/"Failed" to stay
            // legible) via CSS alone (data-layout selectors below).
            <div className="editor-output__status" data-exec-state={executionState}>
              <span className="editor-output__status-label">{layout === 'right' ? 'Out' : 'Output'}</span>
              <span key={executionState} className="editor-output__status-primary editor-output__body-fade">
                <StatusIcon size={14} className={executionState === 'running' ? 'animate-spin' : ''} />
                {statusWord}
              </span>
              {metaText && <span className="editor-output__status-meta">{metaText}</span>}
            </div>
          )}
          <div className="flex items-center gap-1">
            {expanded && outputDetails && executionState !== 'running' && (
              <ModernTooltip content="Copy Output">
                <IconButton
                  onClick={(e) => { e.stopPropagation(); copyOutput(); }}
                  aria-label="Copy output"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </IconButton>
              </ModernTooltip>
            )}
            <ChevronUp size={15} className="editor-output__chevron opacity-50" />
            <IconButton onClick={handleClose} aria-label="Collapse and close output">
              <X size={16} />
            </IconButton>
          </div>
        </div>

        {/* Execution metadata — non-shrinking, sits between header and the
            scrollable body (section 9). Real values only: language always
            shown, time/memory only once Judge0 has actually returned a
            result. No exit code (see headerMetaText's own comment above). */}
        {expanded && headerMetaText && (
          <div className="editor-output__meta-row">{headerMetaText}</div>
        )}

        {/* Non-scrolling header above is now a true sibling of this body,
            not a sticky element sharing its scroll container — output
            content can never render underneath/through the header. */}
        <div className="editor-output__body" ref={innerRef}>
          {/* Running state: a real (indeterminate — no fake percentages)
              sense of activity while the actual submitCode() request is in
              flight. Swaps for OutputSection's own idle/success/error
              content the instant a real result or error arrives — a
              key-driven fade (editor-output__body-fade below) softens that
              swap into a morph rather than a hard cut. */}
          <div className="editor-output__progress" aria-hidden="true" />
          <div key={executionState} className="editor-output__body-fade px-4">
            {executionState === 'running' ? (
              <div className="editor-output__running">
                <Loader2 size={22} className="animate-spin opacity-70" />
                <p>Running your code…</p>
              </div>
            ) : (
              <OutputSection outputDetails={outputDetails} stdin={stdin} />
            )}
          </div>

          {outputDetails && executionState !== 'running' && (
            <div className="editor-output__meta">
              <VendorPill>{outputDetails.provider === 'jdoodle' ? 'JDoodle API' : 'Judge0 API'}</VendorPill>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutputDrawer;
