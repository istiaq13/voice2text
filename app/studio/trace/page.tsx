import { TraceStudio } from '@/components/story-generator/TraceStudio';
import { SiteHeader } from '@/components/site/SiteHeader';

export default function TraceStudioPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-2 text-center">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Traceable Studio</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
          Upload a meeting recording. Every generated story is checked against the transcript and
          anchored to the moment it came from.
        </p>
      </div>
      <TraceStudio />
    </div>
  );
}
