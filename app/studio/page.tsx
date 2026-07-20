import AudioUploader from '@/components/AudioUploader';
import { SiteHeader } from '@/components/site/SiteHeader';

export default function StudioPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-2 text-center">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Studio</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
          Paste requirements, or upload a recording or document, and generate structured user stories.
        </p>
      </div>
      <AudioUploader />
    </div>
  );
}
