# Voice2Text: AI-Powered Audio Transcription & User Story Generator

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
</div>

<br />

Voice2Text is a modern web application that streamlines the software requirements gathering process by leveraging AI technology to transcribe audio recordings into text and generate structured user stories. Perfect for product managers, business analysts, and development teams.

## Features

- *Audio Transcription*: Convert audio recordings to text using Google's Gemini AI
- *Text Input Option*: Directly input requirements text if you already have it
- *Keyword Selection*: Focus user stories on specific keywords or domains
- *AI-Powered User Story Generation*: Automatically create user stories in standard format
- *Responsive Design*: Works seamlessly on desktop and mobile devices
- *Drag & Drop Interface*: Easy file upload with visual feedback
- *Download Results*: Save generated user stories as text files
- *Modern UI*: Clean, intuitive interface built with shadcn/ui components

## Demo

![Voice2Text Demo](https://via.placeholder.com/800x400?text=Voice2Text+Demo)

## Supported File Formats

| Audio | Video | Text |
|-------|-------|------|
| MP3   | MP4   | TXT  |
| WAV   | MOV   |      |
| M4A   | AVI   |      |
| OGG   | WEBM  |      |
| WEBM  |       |      |

## Quick Start

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- Google Gemini API key
- Firebase project (optional, for storage)

### Installation

1. *Clone the repository*
   bash
   git clone https://github.com/yourusername/voice2text.git
   cd voice2text
   

2. *Install dependencies*
   bash
   npm install
   # or
   yarn install
   

3. *Set up environment variables*
   Create a .env.local file in the root directory with:
   
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   

4. *Start the development server*
   bash
   npm run dev
   # or
   yarn dev
   

5. *Open your browser*
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure


voice2text/
├── app/                  # Next.js app directory
│   ├── api/              # API routes
│   │   └── generate-stories/  # User story generation endpoint
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
│   ├── AudioUploader.tsx # Main component for audio upload and processing
│   └── ui/               # UI components from shadcn/ui
├── hooks/                # Custom React hooks
│   └── use-toast.ts      # Toast notification hook
├── lib/                  # Utility functions and services
│   ├── firebase.ts       # Firebase configuration
│   ├── gemini.ts         # Gemini API integration
│   ├── keywords.ts       # Predefined keywords for user stories
│   └── utils.ts          # Helper functions
└── public/               # Static assets


## Technologies Used

- *Frontend*
  - [Next.js 14](https://nextjs.org/) - React framework
  - [TypeScript](https://www.typescriptlang.org/) - Type safety
  - [Tailwind CSS](https://tailwindcss.com/) - Styling
  - [shadcn/ui](https://ui.shadcn.com/) - UI components
  - [React Dropzone](https://react-dropzone.js.org/) - File upload

- *Backend & Services*
  - [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction) - Backend API
  - [Firebase](https://firebase.google.com/) - Database and storage
  - [Google Gemini API](https://ai.google.dev/) - AI transcription and generation

## How It Works

1. *Input*: Users can either upload an audio file or directly input text requirements
2. *Transcription*: If an audio file is uploaded, it's sent to Gemini API for transcription
3. *Keyword Selection*: Users select relevant keywords to focus the user story generation
4. *Generation*: The system sends the requirements and keywords to Gemini API
5. *Output*: Generated user stories are displayed and can be downloaded as a text file

## Use Cases

- *Product Managers*: Convert meeting recordings into actionable user stories
- *Business Analysts*: Transform client requirements into structured development tasks
- *Agile Teams*: Quickly generate user stories from verbal discussions
- *UX Researchers*: Convert user interview recordings into requirements

## Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch: git checkout -b feature/amazing-feature
3. Commit your changes: git commit -m 'Add amazing feature'
4. Push to the branch: git push origin feature/amazing-feature
5. Open a Pull Request

Please make sure to update tests as appropriate and follow the code style.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

If you have any questions or feedback, please open an issue or contact the project maintainers.

---

<div align="center">
  <p>Made with ❤ by the Voice2Text Team</p>
</div>