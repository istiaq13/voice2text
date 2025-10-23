/**
 * Shared API utilities for story generation
 */

/**
 * Build a prompt for user story generation
 */
export function buildStoryGenerationPrompt(
  requirements: string,
  keywords: string[],
  numStories: number
): string {
  const keywordsText = keywords.length > 0 
    ? ` Focus on these keywords: ${keywords.join(', ')}.` 
    : '';

  return `Generate exactly ${numStories} user stories based on these software requirements: 

${requirements}

${keywordsText}

Please format the user stories as:
1. As a [user type], I want [goal] so that [benefit].
2. As a [user type], I want [goal] so that [benefit].
...and so on.

Make sure each user story follows the standard format and is relevant to the requirements provided.`;
}

/**
 * Handle API errors consistently
 */
export function handleAPIError(error: unknown): { error: string; status: number } {
  console.error('API Error:', error);

  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('API key')) {
      return {
        error: 'API configuration error. Please contact the administrator.',
        status: 500,
      };
    }

    if (error.message.includes('network') || error.message.includes('fetch')) {
      return {
        error: 'Network error. Please check your connection and try again.',
        status: 503,
      };
    }

    if (error.message.includes('timeout')) {
      return {
        error: 'Request timed out. Please try again.',
        status: 408,
      };
    }

    // Generic error with message
    return {
      error: error.message || 'An unexpected error occurred',
      status: 500,
    };
  }

  // Unknown error type
  return {
    error: 'An unexpected error occurred',
    status: 500,
  };
}

/**
 * Validate and extract response text
 */
export function validateResponseText(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') {
    throw new Error('No valid response received from AI model');
  }

  const trimmedText = text.trim();
  
  if (trimmedText.length === 0) {
    throw new Error('Empty response received from AI model');
  }

  return trimmedText;
}

/**
 * Check if API key is configured
 */
export function checkAPIKey(apiKey: string | undefined): boolean {
  return Boolean(apiKey && apiKey.trim().length > 0);
}
