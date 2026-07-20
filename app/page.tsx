import Link from 'next/link';
import { Link2, ShieldCheck, Cpu, ClipboardCheck } from 'lucide-react';
import { SiteHeader } from '@/components/site/SiteHeader';
import { TraceDemo } from '@/components/site/TraceDemo';

const PIPELINE = [
  {
    n: '01',
    title: 'Record',
    body: 'Capture a requirements meeting as audio — clear or noisy, it doesn’t need to be clean.',
  },
  {
    n: '02',
    title: 'Transcribe',
    body: 'Speech becomes a timestamped transcript, so every moment stays addressable.',
  },
  {
    n: '03',
    title: 'Generate',
    body: 'An LLM drafts structured user stories straight from what was actually discussed.',
  },
  {
    n: '04',
    title: 'Verify & anchor',
    body: 'Each story is checked against its source segment and linked to the exact timestamp it came from.',
  },
  {
    n: '05',
    title: 'Refine',
    body: 'Stories that don’t hold up are rewritten and re-checked against the source, not just polished for style.',
  },
];

const REASONS = [
  {
    icon: Link2,
    title: 'Grounded, not just generated',
    body: 'Every story links back to the moment it came from. If you don’t trust it, go and check.',
  },
  {
    icon: ShieldCheck,
    title: 'Faithful by construction',
    body: 'Refining a story for polish shouldn’t mean it starts inventing details. Revisions are checked against the transcript before they’re kept.',
  },
  {
    icon: Cpu,
    title: 'Local or cloud, your choice',
    body: 'Compare a small model running on your own machine against Gemini or Groq, on the same recording.',
  },
  {
    icon: ClipboardCheck,
    title: 'Measured with a real framework',
    body: 'Story quality is scored against the established QUS framework — not a rubric invented for the demo.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-3xl">
            <p className="mono-chip text-xs font-medium text-highlight-foreground bg-highlight/15 border border-highlight/30 inline-block px-2.5 py-1 rounded-full mb-6">
              LLM-powered requirements elicitation
            </p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Every story VERA writes points back to the moment it was said.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
              VERA turns a recorded requirements meeting into structured user stories — each one
              anchored to its source in the recording and checked against what was actually said,
              so nothing gets invented along the way.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/studio"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Open Studio
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                See how it works
              </Link>
            </div>
          </div>

          <div className="mt-14 sm:mt-16">
            <TraceDemo />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-border bg-card/40">
          <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
            <p className="mono-chip text-xs font-medium text-muted-foreground uppercase tracking-wide">
              The pipeline
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
              From a recording to a verified story
            </h2>

            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {PIPELINE.map((step) => (
                <li key={step.n} className="space-y-2">
                  <span className="mono-chip block text-2xl font-semibold text-primary/40">
                    {step.n}
                  </span>
                  <h3 className="font-medium text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why VERA */}
        <section className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Why VERA
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {REASONS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl border border-border bg-card">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Bring your own meeting, or start with text.
              </h2>
              <p className="mt-2 text-muted-foreground max-w-xl">
                The studio accepts audio, video, or plain requirements text — pick what you have.
              </p>
            </div>
            <Link
              href="/studio"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
            >
              Open Studio
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>VERA — a research project in LLM-powered requirements elicitation.</span>
          <Link href="/studio" className="hover:text-foreground transition-colors">
            Open Studio &rarr;
          </Link>
        </div>
      </footer>
    </div>
  );
}
