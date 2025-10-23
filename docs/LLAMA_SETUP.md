# Using Local Llama Models

This application supports using local Llama models via [Ollama](https://ollama.ai) for user story generation. This provides a privacy-focused alternative to cloud-based AI services.

## Why Use Local Llama?

- **Privacy**: Your data never leaves your machine
- **No API Costs**: Free to use once set up
- **Offline Capable**: Works without internet connection
- **Customizable**: Choose different model sizes based on your hardware

## Setup Instructions

### 1. Install Ollama

**Windows:**
```bash
# Download and install from https://ollama.ai/download
```

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl https://ollama.ai/install.sh | sh
```

### 2. Download a Model

```bash
# Recommended: Llama 2 7B (faster, requires ~4GB RAM)
ollama pull llama2

# Or for better quality: Llama 2 13B (requires ~8GB RAM)
ollama pull llama2:13b

# Or the latest: Llama 3
ollama pull llama3
```

### 3. Start Ollama

Ollama usually starts automatically after installation. If not:

```bash
ollama serve
```

### 4. Configure Environment Variables

Update your `.env.local` file:

```env
# Local Llama Configuration
LLAMA_API_URL=http://localhost:11434/api/generate
LLAMA_MODEL=llama2
```

You can change `LLAMA_MODEL` to match whichever model you downloaded (e.g., `llama2:13b`, `llama3`).

### 5. Test the Connection

The application will automatically detect if Ollama is running when you load the page. You'll see:

- ✅ **Llama button enabled** - Ollama is running and ready
- ❌ **Llama (Offline)** - Ollama is not detected

## Troubleshooting

### Llama button is disabled

1. **Check if Ollama is running:**
   ```bash
   curl http://localhost:11434/api/tags
   ```
   Should return a JSON response with available models.

2. **Restart Ollama:**
   ```bash
   # Stop Ollama
   pkill ollama
   
   # Start again
   ollama serve
   ```

3. **Verify the model is downloaded:**
   ```bash
   ollama list
   ```

4. **Check the port:**
   Make sure Ollama is running on port `11434` (default). If you changed it, update `LLAMA_API_URL` in `.env.local`.

### Generation is slow

- **Use a smaller model:** `llama2` (7B) is faster than `llama2:13b`
- **Check system resources:** Ensure you have enough RAM
- **Consider GPU acceleration:** Some Ollama versions support GPU acceleration

### Error: "Cannot connect to Llama"

1. Ensure Ollama service is running
2. Check firewall settings aren't blocking localhost:11434
3. Try restarting the Next.js dev server after starting Ollama

## Model Comparison

| Model | Size | RAM Required | Speed | Quality |
|-------|------|--------------|-------|---------|
| llama2 | 7B | ~4GB | Fast | Good |
| llama2:13b | 13B | ~8GB | Medium | Better |
| llama3 | 8B | ~5GB | Fast | Excellent |
| llama3:70b | 70B | ~40GB | Slow | Best |

## Tips

- **First run**: The first generation will be slower as the model loads into memory
- **Keep Ollama running**: For best performance, keep Ollama running in the background
- **Compare results**: Try both Gemini and Llama to see which produces better user stories for your use case

## Resources

- [Ollama Documentation](https://github.com/ollama/ollama/blob/main/docs/README.md)
- [Ollama Models Library](https://ollama.ai/library)
- [Llama Model Information](https://ai.meta.com/llama/)
