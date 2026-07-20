'use client';

import { useState, useEffect } from 'react';

export interface ModelAvailability {
  gemini: boolean;
  groq: boolean;
  groqModel: string;
  llama: boolean;
  llamaModel: string;
  qwen: boolean;
  qwenModel: string;
  isChecking: boolean;
}

// Probes the optional model routes (Groq/Ollama) once on mount so the UI can
// show which models are usable. Gemini is always assumed available.
export function useModelAvailability(): ModelAvailability {
  const [groq, setGroq] = useState(false);
  const [groqModel, setGroqModel] = useState('');
  const [llama, setLlama] = useState(false);
  const [llamaModel, setLlamaModel] = useState('');
  const [qwen, setQwen] = useState(false);
  const [qwenModel, setQwenModel] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAvailability = async () => {
      const [llamaRes, groqRes, qwenRes] = await Promise.allSettled([
        fetch('/api/generate-stories-llama').then((r) => r.json()),
        fetch('/api/generate-stories-groq').then((r) => r.json()),
        fetch('/api/generate-stories-qwen').then((r) => r.json()),
      ]);

      if (llamaRes.status === 'fulfilled') {
        setLlama(llamaRes.value.available || false);
        if (llamaRes.value.model) setLlamaModel(llamaRes.value.model);
      }
      if (groqRes.status === 'fulfilled') {
        setGroq(groqRes.value.available || false);
        if (groqRes.value.model) setGroqModel(groqRes.value.model);
      }
      if (qwenRes.status === 'fulfilled') {
        setQwen(qwenRes.value.available || false);
        if (qwenRes.value.model) setQwenModel(qwenRes.value.model);
      }

      setIsChecking(false);
    };

    checkAvailability();
  }, []);

  return { gemini: true, groq, groqModel, llama, llamaModel, qwen, qwenModel, isChecking };
}
