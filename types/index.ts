// User Story related types
export interface UserStoryResult {
  requirements: string;
  keywords: string[];
  userStories: string;
  numStories: number;
  timestamp: Date;
  status: 'processing' | 'completed' | 'error';
  model?: AIModel;
  outputFormat?: OutputFormat;
}

// API Response types
export interface TranscriptionResponse {
  transcription: string;
}

// Timestamped transcription — the foundation of VERA's story-to-source
// traceability. A word only carries a timestamp if the ASR engine reported
// one; segments always do.
export interface TranscriptWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
  probability: number;
}

export interface TranscriptSegment {
  id: number;
  start: number; // seconds
  end: number; // seconds
  text: string;
  words: TranscriptWord[];
}

export interface WhisperTranscriptionResponse {
  engine: 'faster-whisper';
  model: string;
  language: string;
  languageProbability: number;
  duration: number; // seconds
  text: string; // full transcript, segments joined
  segments: TranscriptSegment[];
  fileName: string;
  fileSize: number;
}

// The refinement-loop ablation's two arms: 'grounded' ties revision feedback
// to the transcript segment; 'quality-only' improves quality with no mention
// of the source at all (matching prior quality-only refinement work) — the
// comparison the study's headline result (RQ3) is built on.
export type RefinementMode = 'grounded' | 'quality-only';

// One attempt in the source-grounded refinement loop.
export interface RefinementAttempt {
  iteration: number;
  storyText: string;
  faithfulScore: number;
  qualityScore: number;
}

// Three of USeR's eight quality metrics (Hallmann et al., arXiv 2503.02049) —
// the ones computable on a single story rather than a full backlog. See
// lib/user-metrics.ts for what's adapted and what's deferred.
export interface USeRMetrics {
  formatComplete: number;
  readable: number;
  easyLanguage: number;
}

// The result of grounding one generated story against the transcript and,
// if needed, running it through the refinement loop.
export interface VerifiedStory {
  storyText: string; // the best version kept, not necessarily the last
  originalStoryText: string;
  segmentId: number | null;
  start: number | null;
  end: number | null;
  faithfulScore: number;
  qualityScore: number;
  faithful: boolean;
  verified: boolean; // meaning depends on mode: grounded checks faithful AND quality; quality-only checks quality alone
  reason: string;
  iterations: number;
  history: RefinementAttempt[];
  userMetrics: USeRMetrics;
  mode: RefinementMode;
}

export interface VerifyStoriesResponse {
  judgeProvider: string;
  mode: RefinementMode;
  results: VerifiedStory[];
  summary: {
    totalStories: number;
    verifiedCount: number;
    avgFaithfulScore: number;
    avgQualityScore: number;
  };
}

export interface StoriesResponse {
  stories: string;
}

export interface APIError {
  error: string;
}

// Model availability
export interface ModelAvailability {
  gemini: boolean;
  llama: boolean;
}

// AI Model types
export type AIModel = 'gemini' | 'groq' | 'llama' | 'qwen';

// Output format types
export type OutputFormat = 'standard' | 'gherkin' | 'invest' | 'jira';

// File upload types
export interface FileUploadState {
  file: File | null;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

// Component Props types
export interface AudioUploaderProps {
  onComplete?: (result: UserStoryResult) => void;
  defaultKeywords?: string[];
  maxStories?: number;
}

// Keyword types
export interface KeywordCategory {
  name: string;
  keywords: string[];
}

// Configuration types
export interface AppConfig {
  maxFileSize: number; // in bytes
  supportedAudioFormats: string[];
  supportedVideoFormats: string[];
  supportedTextFormats: string[];
  minRequirementsLength: number;
  maxRequirementsLength: number;
}
