// User Story related types
export interface UserStoryResult {
  requirements: string;
  keywords: string[];
  userStories: string;
  numStories: number;
  timestamp: Date;
  status: 'processing' | 'completed' | 'error';
  model?: 'gemini' | 'llama';
}

// API Response types
export interface TranscriptionResponse {
  transcription: string;
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
export type AIModel = 'gemini' | 'llama';

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
