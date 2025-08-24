# Audio to Text Converter

A modern web application that converts audio files to text using AI-powered transcription with Google's Gemini API and Firebase for data storage.

## Features

- 🎵 **Audio Upload**: Drag and drop or click to upload audio files
- 🤖 **AI Transcription**: Powered by Google's Gemini API
- 📊 **Firebase Integration**: Store transcription results in Firestore
- 📱 **Responsive Design**: Works perfectly on all devices
- 💾 **Download Results**: Download transcribed text as .txt files
- 🎨 **Beautiful UI**: Clean blue, light gray, and white theme

## Supported Audio Formats

- MP3
- WAV
- M4A
- OGG
- WebM

## Setup Instructions

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up Firebase**:
   - Create a new Firebase project at https://console.firebase.google.com
   - Enable Firestore Database
   - Enable Storage (if needed)
   - Copy your Firebase configuration

4. **Set up Gemini API**:
   - Get your Gemini API key from Google AI Studio
   - Add it to your environment variables

5. **Configure Environment Variables**:
   - Copy `.env.example` to `.env.local`
   - Fill in your Firebase and Gemini API configurations

6. **Run the development server**: `npm run dev`

## Environment Variables

Create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

## Technologies Used

- **Next.js 13** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Firebase** - Database and storage
- **Google Gemini API** - AI transcription
- **React Dropzone** - File upload handling

## How It Works

1. **Upload**: Users drag and drop or select an audio file
2. **Process**: The audio is sent to Gemini API for transcription
3. **Store**: Results are saved to Firebase Firestore
4. **Download**: Users can download the transcribed text

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.