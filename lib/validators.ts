import { z } from 'zod';

// Supported file types
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

const AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/m4a',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
];

const VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
];

const ALL_SUPPORTED_TYPES = [...DOCUMENT_TYPES, ...AUDIO_TYPES, ...VIDEO_TYPES];

// File upload validation schema
export const fileUploadSchema = z.object({
  file: z.custom<File>((val) => val instanceof File, {
    message: 'Invalid file object',
  })
    .refine((file) => file.size > 0, {
      message: 'File is empty',
    })
    .refine((file) => file.size <= 100 * 1024 * 1024, {
      message: 'File size must be less than 100MB',
    })
    .refine(
      (file) => {
        const fileType = file.type || '';
        // Also check file extension as fallback
        const extension = file.name.split('.').pop()?.toLowerCase();
        const validExtensions = ['pdf', 'docx', 'txt', 'md', 'mp3', 'wav', 'm4a', 'ogg', 'webm', 'mp4', 'mov', 'avi'];
        
        return ALL_SUPPORTED_TYPES.includes(fileType) || (extension && validExtensions.includes(extension));
      },
      {
        message: 'Invalid file type. Please upload a supported document, audio, or video file.',
      }
    ),
});

// Requirements text validation
export const requirementsSchema = z.object({
  requirements: z.string()
    .min(20, 'Requirements must be at least 20 characters')
    .max(50000, 'Requirements must be less than 50,000 characters')
    .trim()
    .refine((val) => val.length > 0, {
      message: 'Requirements cannot be empty',
    }),
  selectedKeywords: z.array(z.string().min(1).max(50))
    .min(1, 'At least one keyword is required')
    .max(10, 'Maximum 10 keywords allowed'),
  numStories: z.number()
    .int('Number of stories must be an integer')
    .min(1, 'Must generate at least 1 story')
    .max(20, 'Maximum 20 stories allowed')
    .default(5),
});

// API request validation for story generation
export const storyGenerationRequestSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(100000, 'Prompt is too long'),
});

// Extract text API request validation
export const extractTextRequestSchema = z.object({
  file: z.custom<File>(),
  model: z.enum(['gemini', 'llama']).optional().default('gemini'),
});

// Keyword validation
export const keywordSchema = z.string()
  .min(1, 'Keyword cannot be empty')
  .max(50, 'Keyword must be less than 50 characters')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Keyword can only contain letters, numbers, spaces, hyphens, and underscores');

// Custom keyword array validation
export const keywordsArraySchema = z.array(keywordSchema)
  .max(10, 'Maximum 10 keywords allowed');

// Validation helper functions
export function validateRequirements(data: unknown) {
  return requirementsSchema.parse(data);
}

export function validateFileUpload(file: unknown) {
  return fileUploadSchema.parse({ file });
}

export function validateStoryGenerationRequest(data: unknown) {
  return storyGenerationRequestSchema.parse(data);
}

export function validateKeyword(keyword: string) {
  return keywordSchema.parse(keyword);
}

export function validateKeywordsArray(keywords: string[]) {
  return keywordsArraySchema.parse(keywords);
}

// Safe validation that returns errors instead of throwing
export function safeValidateRequirements(data: unknown) {
  const result = requirementsSchema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : null,
    error: result.success ? null : result.error.errors[0]?.message || 'Validation failed',
  };
}

export function safeValidateFileUpload(file: unknown) {
  const result = fileUploadSchema.safeParse({ file });
  return {
    success: result.success,
    data: result.success ? result.data : null,
    error: result.success ? null : result.error.errors[0]?.message || 'Invalid file',
  };
}

export function safeValidateStoryGenerationRequest(data: unknown) {
  const result = storyGenerationRequestSchema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : null,
    error: result.success ? null : result.error.errors[0]?.message || 'Invalid request',
  };
}
