// Runs once at server startup via instrumentation.ts
// Checks every model/service and logs a status table to the console.
// Avoids live API calls for cloud services — key format validation is enough for startup.

const OLLAMA_BASE =
  (process.env.LLAMA_API_URL || 'http://localhost:11434/api/generate').replace('/api/generate', '');

const LLAMA_MODEL = process.env.LLAMA_MODEL || 'llama3.1:8b';
const QWEN_MODEL  = process.env.QWEN_MODEL  || 'qwen2.5:7b-instruct-q4_K_M';

type Status = 'ok' | 'missing_key' | 'unreachable' | 'model_not_found';

interface ModelStatus {
  name: string;
  status: Status;
  detail: string;
}

function checkGemini(): ModelStatus {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return { name: 'Gemini 2.5 Flash', status: 'missing_key', detail: 'GOOGLE_API_KEY not set' };
  if (!key.startsWith('AIza')) return { name: 'Gemini 2.5 Flash', status: 'missing_key', detail: 'GOOGLE_API_KEY looks invalid' };
  return { name: 'Gemini 2.5 Flash', status: 'ok', detail: 'gemini-2.5-flash · key configured' };
}

function checkGroq(): ModelStatus {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { name: 'Groq  (Llama 3.3 70B)', status: 'missing_key', detail: 'GROQ_API_KEY not set' };
  if (!key.startsWith('gsk_')) return { name: 'Groq  (Llama 3.3 70B)', status: 'missing_key', detail: 'GROQ_API_KEY looks invalid' };
  return { name: 'Groq  (Llama 3.3 70B)', status: 'ok', detail: 'llama-3.3-70b-versatile · key configured' };
}

async function checkOllamaModel(modelName: string, displayName: string): Promise<ModelStatus> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
    } finally {
      clearTimeout(tid);
    }
    if (!res.ok) return { name: displayName, status: 'unreachable', detail: `Ollama HTTP ${res.status}` };
    const data = await res.json() as { models?: { name: string }[] };
    const found = (data.models ?? []).some(m => m.name === modelName);
    return {
      name: displayName,
      status: found ? 'ok' : 'model_not_found',
      detail: found ? modelName : `run: ollama pull ${modelName}`,
    };
  } catch {
    return { name: displayName, status: 'unreachable', detail: 'Ollama not running — start with: ollama serve' };
  }
}

function checkJira(): ModelStatus {
  const base  = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const proj  = process.env.JIRA_PROJECT_KEY;
  if (!base || !email || !token || !proj) {
    return { name: 'Jira ', status: 'missing_key', detail: 'one or more JIRA_* env vars not set' };
  }
  return { name: 'Jira ', status: 'ok', detail: `project ${proj} · credentials configured` };
}

export async function checkAllModels(): Promise<void> {
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│      DP2 User Story Generator — startup check    │');
  console.log('└─────────────────────────────────────────────────┘');

  // Cloud checks are synchronous (key validation only — no live calls at boot)
  // Ollama checks are async but wrapped with their own try/catch, so Promise.all is safe
  const [gemini, groq, llama, qwen, jira] = await Promise.all([
    Promise.resolve(checkGemini()),
    Promise.resolve(checkGroq()),
    checkOllamaModel(LLAMA_MODEL, `Llama (${LLAMA_MODEL})`),
    checkOllamaModel(QWEN_MODEL,  `Qwen  (${QWEN_MODEL})`),
    Promise.resolve(checkJira()),
  ]);

  const icon: Record<Status, string> = {
    ok:              '  ✅',
    missing_key:     '  ⚠️ ',
    unreachable:     '  ❌',
    model_not_found: '  ⚠️ ',
  };

  for (const r of [gemini, groq, llama, qwen, jira]) {
    const label = r.name.padEnd(26);
    console.log(`${icon[r.status]}  ${label}  ${r.detail}`);
  }

  console.log('─'.repeat(51) + '\n');
}
