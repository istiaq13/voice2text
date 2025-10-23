
// Client-side function to transcribe audio via API route (Legacy - kept for compatibility)
export async function transcribeAudio(audioFile: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('audio', audioFile);

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to transcribe audio');
    }

    const { transcription } = await response.json();
    return transcription;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error('Failed to transcribe audio');
  }
}

// Unified function to extract text from any supported file type
export async function extractTextFromFile(file: File, model: 'gemini' | 'llama' = 'gemini'): Promise<{
  text: string;
  method: string;
  fileType: string;
  characterCount: number;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);

    const response = await fetch('/api/extract-text', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract text from file');
    }

    const data = await response.json();
    return {
      text: data.text,
      method: data.method,
      fileType: data.fileType,
      characterCount: data.characterCount
    };
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw error;
  }
}