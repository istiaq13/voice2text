# Voice2Text: AI-Powered Audio Transcription & User Story Generator

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-13.5.1-black?style=for-the-badge&logo=next.js" alt="Next.js 13.5.1" />
  <img src="https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
</div>

<br />

Voice2Text is a modern web application that streamlines the software requirements gathering process by leveraging AI technology to transcribe audio recordings into text and generate structured user stories. Perfect for product managers, business analysts, and development teams.

## Features

- **Multiple Input Methods**: Upload documents (PDF, Word, Text, Markdown) or media files (audio/video), or enter text directly
- **Advanced Text Extraction**: Extract text from PDFs and Word documents using AI-powered analysis
- **Audio & Video Transcription**: Convert audio and video recordings to text using Google's Gemini AI
- **Dual AI Model Support**: Choose between cloud-based Gemini AI or local Llama models
  - **Gemini AI**: Fast, cloud-based, highly accurate
  - **Llama (Local)**: Privacy-focused, runs on your machine, no internet required
- **Smart Keyword System**: 
  - Browse keywords by category (E-commerce, Authentication, Healthcare, etc.)
  - AI-suggested keywords based on your requirements
  - Add custom keywords
  - Select up to 10 keywords to focus your user stories
- **AI-Powered User Story Generation**: Automatically create user stories in standard format
- **Dark Mode Support**: Full dark mode with elegant theme switching
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Drag & Drop Interface**: Easy file upload with visual feedback
- **Download Results**: Save generated user stories as text files
- **Modern UI**: Clean, intuitive interface built with shadcn/ui components
- **Auto-Detection**: Automatically detects if local Llama model is available

## Demo

![Voice2Text Demo](https://via.placeholder.com/800x400?text=Voice2Text+Demo)

## Supported File Formats

| Documents | Audio | Video |
|-----------|-------|-------|
| PDF       | MP3   | MP4   |
| DOCX      | WAV   | MOV   |
| TXT       | M4A   | AVI   |
| MD        | OGG   | WEBM  |
|           | WEBM  |       |

## Quick Start

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- Google Gemini API key
- Firebase project (optional, for storage)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/istiaq13/voice2text.git
   cd voice2text
   ```
   

2. *Install dependencies*
   bash
   npm install
   # or
   yarn install
   

3. **Set up environment variables**
   Create a `.env.local` file in the root directory with:
   ```env
   # Google Gemini API
   GOOGLE_API_KEY=your_gemini_api_key
   
   # Local Llama Configuration (Optional - for Ollama)
   LLAMA_API_URL=http://localhost:11434/api/generate
   LLAMA_MODEL=llama2
   
   # Firebase Configuration (optional)
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **(Optional) Set up local Llama model**
   To use the local Llama model for user story generation:
   
   a. Install [Ollama](https://ollama.ai):
   ```bash
   # Windows: Download from https://ollama.ai/download
   # macOS: brew install ollama
   # Linux: curl https://ollama.ai/install.sh | sh
   ```
   
   b. Pull a Llama model:
   ```bash
   ollama pull llama2
   # or for a larger model
   ollama pull llama2:13b
   ```
   
   c. Start Ollama (it should auto-start, or run):
   ```bash
   ollama serve
   ```
   
   The app will automatically detect if Ollama is running and enable the Llama button.

5. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure


```
voice2text/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── extract-text/     # Document/media text extraction endpoint
│   │   ├── generate-stories/ # Gemini user story generation endpoint
│   │   ├── generate-stories-llama/ # Llama user story generation endpoint
│   │   ├── transcribe/       # Gemini audio transcription endpoint
│   │   └── transcribe-llama/ # Llama audio transcription endpoint
│   ├── globals.css           # Global styles with dark mode support
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── components/               # React components
│   ├── AudioUploader.tsx     # Main component with file upload, keyword selection, and story generation
│   ├── core/                 # Core UI components
│   │   ├── button.tsx        # Button component
│   │   ├── form.tsx          # Form components (Input, Select, Textarea)
│   │   ├── layout.tsx        # Layout components (Card, Tabs)
│   │   └── navigation.tsx    # Navigation components
│   └── ui/                   # Additional UI components
│       └── badge.tsx         # Badge component for keywords
├── contexts/                 # React contexts
│   └── ThemeContext.tsx      # Dark mode theme provider
├── hooks/                    # Custom React hooks
│   └── use-toast.ts          # Toast notification hook
├── lib/                      # Utility functions and services
│   ├── firebase.ts           # Firebase configuration
│   ├── gemini.ts             # Google Gemini API integration
│   ├── keywords.ts           # Categorized software keywords
│   └── utils.ts              # Helper utilities
├── types/                    # TypeScript type definitions
│   └── index.ts              # Shared types
├── .env.local                # Environment variables (create this)
├── next.config.js            # Next.js configuration
├── package.json              # Dependencies and scripts
├── tailwind.config.ts        # Tailwind CSS configuration with dark mode
└── tsconfig.json             # TypeScript configuration
```


## Technologies Used

- **Frontend**
  - [Next.js 13.5.1](https://nextjs.org/) - React framework
  - [TypeScript](https://www.typescriptlang.org/) - Type safety
  - [Tailwind CSS](https://tailwindcss.com/) - Styling
  - [shadcn/ui](https://ui.shadcn.com/) - UI components
  - [React Dropzone](https://react-dropzone.js.org/) - File upload

- **Backend & Services**
  - [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction) - Backend API
  - [Firebase](https://firebase.google.com/) - Database and storage (optional)
  - [Google Gemini API](https://ai.google.dev/) - AI transcription and generation

## How It Works

1. **Input Requirements**: Users can upload documents (PDF, Word, Text, Markdown), media files (audio/video), or directly input text requirements
2. **Text Extraction**: Documents are processed to extract text; audio/video files are transcribed using Gemini AI
3. **Keyword Selection**: Users select up to 10 relevant keywords from categorized options or add custom ones. AI suggests keywords based on the requirements
4. **AI Model Selection**: Choose between Gemini AI (cloud-based) or Llama (local, privacy-focused)
5. **Story Generation**: The system sends the requirements and keywords to the selected AI model to generate user stories
6. **Output**: Generated user stories are displayed in standard format and can be downloaded as a text file

## Use Cases

- **Product Managers**: Convert meeting recordings into actionable user stories, or upload requirement documents
- **Business Analysts**: Transform client requirements (documents or recordings) into structured development tasks
- **Agile Teams**: Quickly generate user stories from verbal discussions or written specifications
- **UX Researchers**: Convert user interview recordings or notes into requirements
- **Consultants**: Process client documents and generate structured user stories efficiently

## Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please make sure to update tests as appropriate and follow the code style.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

If you have any questions or feedback, please open an issue or contact the project maintainers.

---

<div align="center">
  <p>Made by the Voice2Text Team</p>
</div>