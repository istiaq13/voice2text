
// Client-side function to transcribe audio via API route
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