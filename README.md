# DP2 — User Story Generator

Convert software requirements into structured AI-generated user stories. Supports text, PDF, DOCX, audio, and video input. Compare multiple AI models side by side with live per-model loading and quality metrics.

---

## Features

### Input
- **Manual text** — paste requirements directly
- **File upload** — PDF, DOCX, TXT, MP3, WAV, M4A, MP4, MOV, AVI, WebM (up to 100 MB)
- **Auto domain detection** — classifies requirements into 1 of 10 domains (E-commerce, Healthcare, Education, etc.) and pre-fills relevant keywords

### Story Generation
- **4 output formats** — Standard + Acceptance Criteria, Gherkin BDD, INVEST, Jira-ready
- **Up to 20 stories** per generation
- **Keyword focus** — up to 10 keywords guide the AI toward specific feature areas
- **4 AI models** — pick the one that fits your setup (see Models section)

### Model Comparison
- Run all available models on the same prompt simultaneously
- **Per-model live loading** — each card shows its own progress bar and run counter; fast models (Groq) populate immediately while local models are still running
- **1×, 3×, or 5× runs** per model with averaged metrics for statistical reliability
- **5 quality metrics** scored automatically: Format Compliance, Role Specificity, AC Coverage, Story Uniqueness, Overall Score
- **Bar chart + radar chart** appear as models complete
- **CSV export** of the full scorecard

### Export
- **Download as `.txt`** — full requirements + keywords + stories
- **Export to Jira** — creates one Story issue per user story with ADF-formatted descriptions and acceptance criteria bullet lists

### Other
- Dark / light mode
- Health check endpoint at `/api/health`
- Startup log — all model statuses printed to console when the server starts

---

## AI Models

| Model | Provider | Cost | Speed | Notes |
|-------|----------|------|-------|-------|
| **Gemini 2.5 Flash** | Google | Free tier | Fast | Required — used for extraction + domain detection |
| **Llama 3.3 70B** | Groq (cloud) | Free tier | Very fast | Requires `GROQ_API_KEY` |
| **Llama 3.1 8B** | Ollama (local) | Free | Moderate | Requires Ollama running locally |
| **Qwen 2.5 7B** | Ollama (local) | Free | Moderate | Requires Ollama running locally |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/voice2text.git
cd voice2text
npm install
```

### 2. Configure environment

Copy the example and fill in your keys:

```bash
cp .env.example .env.local
```

**.env.local minimum (Gemini only):**
```env
GOOGLE_API_KEY=AIzaSy...
```

**Full configuration:**
```env
# Required
GOOGLE_API_KEY=AIzaSy...

# Optional — Groq (free at console.groq.com)
GROQ_API_KEY=gsk_...

# Optional — Local Ollama
LLAMA_API_URL=http://localhost:11434/api/generate
LLAMA_MODEL=llama3.1:8b
QWEN_MODEL=qwen2.5:7b-instruct-q4_K_M

# Optional — Jira export
JIRA_BASE_URL=https://your-site.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=ATATT3x...
JIRA_PROJECT_KEY=SCRUM
```

### 3. Set up local models (optional)

Install [Ollama](https://ollama.com), then pull the models:

```bash
ollama pull llama3.1:8b
ollama pull qwen2.5:7b-instruct-q4_K_M
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The console will print a startup status table showing which models are ready.

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/generate-stories` | POST | Generate stories with Gemini |
| `/api/generate-stories-groq` | POST | Generate stories with Groq |
| `/api/generate-stories-llama` | GET / POST | Check availability / generate with Llama |
| `/api/generate-stories-qwen` | GET / POST | Check availability / generate with Qwen |
| `/api/compare-models` | POST | Run all models on one prompt (server-side) |
| `/api/extract-text` | POST | Extract text from uploaded file |
| `/api/detect-domain` | POST | Classify requirements into a domain |
| `/api/export-jira` | POST | Create Jira Story issues |
| `/api/health` | GET | Service health and config check |

---

## Getting API Keys

| Service | Where to get it | Free? |
|---------|----------------|-------|
| Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | Yes |
| Groq | [console.groq.com](https://console.groq.com) → API Keys | Yes |
| Jira API token | Atlassian → Account Settings → Security → API tokens | Yes (free Jira tier) |

---

## Tech Stack

- **Framework** — Next.js 13 (App Router)
- **Language** — TypeScript
- **Styling** — Tailwind CSS + shadcn/ui + Radix UI
- **AI** — Google Generative AI SDK, Groq OpenAI-compatible API, Ollama REST API
- **Charts** — Recharts (BarChart, RadarChart)
- **Validation** — Zod
- **File parsing** — Mammoth (DOCX), Google Gemini (PDF/audio/video)
- **Drag and drop** — react-dropzone

---

## Project Structure

```
app/
  api/
    compare-models/         # Bulk multi-model comparison
    detect-domain/          # Requirement domain classifier
    export-jira/            # Jira issue creator
    extract-text/           # File text extraction
    generate-stories/       # Gemini story generation
    generate-stories-groq/  # Groq story generation
    generate-stories-llama/ # Ollama Llama story generation
    generate-stories-qwen/  # Ollama Qwen story generation
    health/                 # Health check
    transcribe/             # Audio transcription (Gemini)
    transcribe-llama/       # Audio transcription (Whisper/Ollama)
  page.tsx
  layout.tsx

components/
  AudioUploader.tsx         # Main UI — all feature state
  ModelComparison.tsx       # Per-model parallel comparison UI
  core/                     # Button, Card, Form, Tabs primitives
  ui/                       # shadcn/ui components

lib/
  gemini.ts                 # Gemini client wrapper
  keywords.ts               # 10 keyword categories, 70+ keywords
  rate-limit.ts             # In-memory rate limiters
  startup-check.ts          # Boot-time model availability check
  validators.ts             # Zod schemas

contexts/
  ThemeContext.tsx           # Dark/light mode

types/
  index.ts                  # AIModel, OutputFormat, UserStoryResult, etc.

instrumentation.ts           # Next.js startup hook
```

---

## Startup Console Output

When `npm run dev` or `npm start` runs, the server prints:

```
┌─────────────────────────────────────────────────┐
│      DP2 User Story Generator — startup check    │
└─────────────────────────────────────────────────┘
  ✅  Gemini 2.5 Flash              gemini-2.5-flash · key configured
  ✅  Groq  (Llama 3.3 70B)         llama-3.3-70b-versatile · key configured
  ✅  Llama (llama3.1:8b)           llama3.1:8b
  ✅  Qwen  (qwen2.5:7b-...)        qwen2.5:7b-instruct-q4_K_M
  ⚠️   Jira                          one or more JIRA_* env vars not set
───────────────────────────────────────────────────
```

Icons: `✅` ready · `⚠️` key missing or model not pulled · `❌` service unreachable

---

## Quality Metrics (Comparison)

| Metric | What it measures |
|--------|-----------------|
| **Format** | % of stories following "As a X, I want Y so that Z" |
| **Roles** | % using specific roles rather than generic "user" |
| **AC** | % of stories with Given/When/Then acceptance criteria |
| **Unique** | % of stories covering distinct topics (fingerprint dedup) |
| **Overall** | Average of the four above |
| **Speed** | Inverse of average response time (radar chart only) |

---

## License

MIT
