// The signature visual: a transcript moment on one side, the story it produced
// on the other, joined by the same amber highlight used everywhere traceability
// shows up in the product. Hovering the story intensifies the source phrase —
// a small, honest illustration of "click a story, see where it came from."
export function TraceDemo() {
  return (
    <div className="group relative grid gap-4 sm:grid-cols-[1fr_auto_1fr] items-center rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      {/* Source segment */}
      <div className="space-y-2">
        <div className="mono-chip inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-highlight" />
          04:12 — meeting recording
        </div>
        <p className="font-mono text-sm leading-relaxed text-muted-foreground">
          "...and students should be able to renew a book online{' '}
          <span className="source-mark text-foreground transition-colors group-hover:bg-highlight/70">
            themselves, as long as nobody else has requested it
          </span>
          , so they're not stuck coming into the library for that..."
        </p>
      </div>

      {/* Connector */}
      <div className="flex sm:flex-col items-center justify-center gap-1 text-highlight">
        <span className="hidden sm:block h-8 w-px bg-border" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-2 text-center">
          anchors to
        </span>
        <span className="hidden sm:block h-8 w-px bg-border" />
      </div>

      {/* Generated story segment */}
      <div className="rounded-xl border border-border bg-background p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="mono-chip text-xs text-muted-foreground">02</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-verified">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Verified
          </span>
        </div>
        <p className="text-sm leading-relaxed">
          <span className="font-semibold text-primary">As a student</span>, I want{' '}
          <span className="font-medium">to renew a borrowed book online</span> so that{' '}
          I don't have to visit the library if no one else has requested it.
        </p>
        <button className="mono-chip text-xs text-muted-foreground hover:text-highlight transition-colors">
          ▶ 04:12
        </button>
      </div>
    </div>
  );
}
