
import { GoogleGenerativeAI } from '@google/generative-ai';

// Use the provided Gemini API key directly
const genAI = new GoogleGenerativeAI('AIzaSyBl3DxNKn5MMo7ZXFs4qnTkC69Tzc_6y4w');


export async function transcribeAudio(audioFile: File): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert file to base64 using FileReader (browser compatible)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:...;base64, part
        const base64String = result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioFile);
    });

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: audioFile.type
        }
      },
      'Please transcribe this audio file and return only the text content.'
    ]);

    return result.response.text();
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error('Failed to transcribe audio');
  }
}