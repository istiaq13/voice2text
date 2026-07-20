'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { FileText, FileAudio, Loader2, AlertCircle, X, Plus, Sparkles, Cpu, Tag, Moon, Sun, BarChart2 } from 'lucide-react';
import { Button } from '@/components/core/button';
import { Card } from '@/components/core/layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Textarea } from '@/components/core/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/core/layout';
import { Badge } from '@/components/ui/badge';
import { FileUploadSkeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/contexts/ThemeContext';
import { safeValidateRequirements } from '@/lib/validators';
import { KEYWORD_CATEGORIES, autoSuggestKeywords, filterKeywords } from '@/lib/keywords';
import { buildPrompt } from '@/lib/prompt-builder';
import { useModelAvailability } from '@/hooks/useModelAvailability';
import { StoryResult } from '@/components/story-generator/StoryResult';
import { JiraResults, type JiraExportResult } from '@/components/story-generator/JiraResults';
import type { UserStoryResult, AIModel, OutputFormat } from '@/types';
import ModelComparison from '@/components/ModelComparison';

export default function AudioUploader() {
  const { theme, toggleTheme } = useTheme();
  const models = useModelAvailability();
  const [isProcessing, setIsProcessing] = useState(false);
  const [userStoryResult, setUserStoryResult] = useState<UserStoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [numStories, setNumStories] = useState<number>(5);
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('standard');
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null);
  const [isDetectingDomain, setIsDetectingDomain] = useState(false);
  const [isExportingJira, setIsExportingJira] = useState(false);
  const [jiraResults, setJiraResults] = useState<JiraExportResult | null>(null);
  const [comparisonPrompt, setComparisonPrompt] = useState<string | null>(null);

  const MAX_KEYWORDS = 10;

  // Auto-suggest keywords based on requirements text
  useEffect(() => {
    if (requirements.length > 50) {
      setSuggestedKeywords(autoSuggestKeywords(requirements, selectedKeywords));
    } else {
      setSuggestedKeywords([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirements]);

  // Add keyword with validation
  function addKeyword(keyword: string) {
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) return;

    if (selectedKeywords.length >= MAX_KEYWORDS) {
      setError(`Maximum ${MAX_KEYWORDS} keywords allowed`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (selectedKeywords.includes(trimmedKeyword)) {
      setError('Keyword already added');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (trimmedKeyword.length > 50) {
      setError('Keyword too long (max 50 characters)');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setSelectedKeywords((prev) => [...prev, trimmedKeyword]);
    setCustomKeyword('');
  }

  function removeKeyword(keyword: string) {
    setSelectedKeywords((prev) => prev.filter((k) => k !== keyword));
  }

  function toggleKeyword(keyword: string) {
    if (selectedKeywords.includes(keyword)) {
      removeKeyword(keyword);
    } else {
      addKeyword(keyword);
    }
  }

  function clearAllKeywords() {
    setSelectedKeywords([]);
  }

  // Auto-detect domain from requirements using Gemini
  async function detectDomain() {
    if (!requirements.trim() || requirements.length < 50) return;
    setIsDetectingDomain(true);
    try {
      const response = await fetch('/api/detect-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements }),
      });
      if (!response.ok) throw new Error(`Domain detection failed: ${response.status}`);
      const data = await response.json();
      if (data.domain) {
        setDetectedDomain(data.domain);
        setSelectedCategory(data.domain);
        const categoryKeywords = KEYWORD_CATEGORIES[data.domain as keyof typeof KEYWORD_CATEGORIES] || [];
        const slots = MAX_KEYWORDS - selectedKeywords.length;
        const newKeywords = categoryKeywords
          .filter((k) => !selectedKeywords.includes(k))
          .slice(0, Math.max(0, slots));
        if (newKeywords.length > 0) {
          setSelectedKeywords((prev) => [...prev, ...newKeywords]);
        }
      } else {
        setError('Could not detect domain — try selecting keywords manually.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (e) {
      console.error('Domain detection failed:', e);
      setError('Domain detection failed. Please select keywords manually.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsDetectingDomain(false);
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0]?.code === 'too-many-files') {
        setError('Please upload only one file at a time.');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Invalid file type. Please upload a supported file: PDF, Word, Text, Markdown, Audio, or Video.');
      } else if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File is too large. Maximum size is 100MB.');
      } else {
        setError('File upload failed. Please try again.');
      }
      return;
    }

    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setError(null);
    setIsExtracting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'gemini'); // Default to Gemini for audio/video

      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract text from file');
      }

      const data = await response.json();

      if (!data.text || !data.text.trim()) {
        setError('No text was extracted from the file. The file might be empty or corrupted.');
        return;
      }

      setRequirements(data.text);

      if (data.text.length > 50) {
        setSuggestedKeywords(autoSuggestKeywords(data.text, selectedKeywords));
      }

      console.log(`✅ Extracted ${data.characterCount} characters using ${data.method}`);
    } catch (err) {
      console.error('File extraction error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsExtracting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: isProcessing || isExtracting,
  });

  const generateUserStories = async (model: AIModel = 'gemini') => {
    const validation = safeValidateRequirements({ requirements, selectedKeywords, numStories });

    if (!validation.success) {
      setError(validation.error || 'Validation failed');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setUserStoryResult({
      requirements,
      keywords: selectedKeywords,
      userStories: '',
      numStories,
      timestamp: new Date(),
      status: 'processing',
      model,
    });

    try {
      const prompt = buildPrompt({ outputFormat, numStories, requirements, keywords: selectedKeywords, detectedDomain });
      const apiEndpoint =
        model === 'llama' ? '/api/generate-stories-llama' :
        model === 'groq' ? '/api/generate-stories-groq' :
        model === 'qwen' ? '/api/generate-stories-qwen' :
        '/api/generate-stories';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.stories || data.stories.trim().length === 0) {
        throw new Error('No user stories were generated. Please try again with different requirements.');
      }

      setUserStoryResult({
        requirements,
        keywords: selectedKeywords,
        userStories: data.stories,
        numStories,
        timestamp: new Date(),
        status: 'completed',
        model,
        outputFormat,
      });
    } catch (err) {
      console.error('Story generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to generate user stories: ${errorMessage}`);
      setUserStoryResult((prev) => (prev ? { ...prev, status: 'error' } : null));
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadUserStories = () => {
    if (!userStoryResult?.userStories) return;

    const content = `Software Requirements:\n${userStoryResult.requirements}\n\nKeywords: ${userStoryResult.keywords.join(', ')}\n\nGenerated User Stories:\n${userStoryResult.userStories}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_stories.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJira = async () => {
    if (!userStoryResult?.userStories) return;
    setIsExportingJira(true);
    setJiraResults(null);
    try {
      const response = await fetch('/api/export-jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stories: userStoryResult.userStories }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to export to Jira');
        return;
      }
      setJiraResults(data);
    } catch (e) {
      setError('Failed to connect to Jira export endpoint');
    } finally {
      setIsExportingJira(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4 relative">
        <button
          onClick={toggleTheme}
          className="absolute top-0 right-0 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-700"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-yellow-500" />
          ) : (
            <Moon className="w-5 h-5 text-gray-700" />
          )}
        </button>

        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
          <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">User Story Generator</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Generate user stories from your software requirements using AI-powered analysis
        </p>
      </div>

      {/* Input Method Selection */}
      <Card className="p-6">
        <Tabs value={inputMethod} onValueChange={(value: string) => setInputMethod(value as 'text' | 'file')} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Manual Input</TabsTrigger>
            <TabsTrigger value="file">File Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enter Software Requirements</h3>
            <Textarea
              placeholder="Enter your software requirements here... (e.g., I need a web application for managing customer orders with user authentication, payment processing, and real-time notifications)"
              value={requirements}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRequirements(e.target.value)}
              className="min-h-32"
              disabled={isProcessing}
            />
          </TabsContent>

          <TabsContent value="file" className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Requirements File</h3>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${isDragActive
                  ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-gray-800'
                }
                ${isProcessing || isExtracting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getInputProps()} />

              {isExtracting ? (
                <div className="space-y-4">
                  <FileUploadSkeleton />
                  <div className="text-center space-y-2">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white">Extracting Text...</h4>
                    <p className="text-gray-600 dark:text-gray-300">Please wait while we process your file</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center space-x-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                    <FileAudio className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white">
                      {isDragActive ? 'Drop your file here' : 'Upload Requirements File'}
                    </h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      Documents: PDF, Word (.docx), Text (.txt), Markdown (.md)
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      Audio: MP3, WAV, M4A, OGG, WebM
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      Video: MP4, MOV, AVI, WebM
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Documents → Text extraction • Audio/Video → AI transcription
                    </p>
                  </div>
                  <Button variant="outline" className="mt-4">
                    Choose File
                  </Button>
                </div>
              )}
            </div>

            {uploadedFile && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <FileText className="w-4 h-4" />
                <span>Uploaded: {uploadedFile.name}</span>
              </div>
            )}

            {requirements && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white">Extracted Requirements:</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {requirements.length.toLocaleString()} characters
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 max-h-96 overflow-y-auto">
                  <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
                    {requirements}
                  </p>
                </div>
                {requirements.length > 1000 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    Scroll to view full content
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Configuration */}
      <Card className="p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configuration</h3>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Number of Stories */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Number of Stories</label>
            <Select value={numStories.toString()} onValueChange={(value: string) => setNumStories(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? 'story' : 'stories'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Output Format */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Output Format</label>
            <Select value={outputFormat} onValueChange={(value: string) => setOutputFormat(value as OutputFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard + AC</SelectItem>
                <SelectItem value="gherkin">Gherkin BDD</SelectItem>
                <SelectItem value="invest">INVEST</SelectItem>
                <SelectItem value="jira">Jira-ready</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Keywords */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Keywords ({selectedKeywords.length}/{MAX_KEYWORDS})
              </label>
              {selectedKeywords.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={clearAllKeywords} className="text-xs">
                  Clear All
                </Button>
              )}
            </div>

            {/* Selected Keywords */}
            {selectedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                {selectedKeywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="default"
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 cursor-pointer"
                    onClick={() => removeKeyword(keyword)}
                  >
                    {keyword}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}

            {/* AI Suggestions */}
            {suggestedKeywords.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Suggested Keywords (from your requirements)
                </label>
                <div className="flex flex-wrap gap-2">
                  {suggestedKeywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="outline"
                      className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-950 border-purple-300 dark:border-purple-700"
                      onClick={() => addKeyword(keyword)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Category Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Browse by Category:</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={detectDomain}
                  disabled={isDetectingDomain || requirements.length < 50}
                  className="text-xs h-6 px-2 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950"
                >
                  {isDetectingDomain ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Detecting...</>
                  ) : (
                    <><Sparkles className="w-3 h-3 mr-1" />Auto-detect Domain</>
                  )}
                </Button>
              </div>
              {detectedDomain && (
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Detected: <span className="font-semibold">{detectedDomain}</span> — keywords auto-applied
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={selectedCategory === 'All' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory('All')}
                >
                  All Keywords
                </Badge>
                {Object.keys(KEYWORD_CATEGORIES).map((category) => (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Search Keywords */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search keywords..."
                value={keywordSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeywordSearch(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Predefined Keywords Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              {filterKeywords(selectedCategory, keywordSearch).map((keyword) => {
                const isSelected = selectedKeywords.includes(keyword);
                return (
                  <Badge
                    key={keyword}
                    variant={isSelected ? 'default' : 'outline'}
                    className={`cursor-pointer justify-center text-center ${
                      isSelected
                        ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => toggleKeyword(keyword)}
                  >
                    {keyword}
                  </Badge>
                );
              })}
            </div>

            {/* Custom Keyword Input */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Add custom keyword..."
                value={customKeyword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomKeyword(e.target.value)}
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword(customKeyword);
                  }
                }}
                className="flex-1 text-sm"
                maxLength={50}
              />
              <Button
                type="button"
                onClick={() => addKeyword(customKeyword)}
                disabled={!customKeyword.trim() || selectedKeywords.length >= MAX_KEYWORDS}
                size="sm"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select up to {MAX_KEYWORDS} keywords to focus the AI on specific aspects of your requirements
            </p>
          </div>
        </div>

        {/* Model Selection + Generate */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Model</label>
          <div className="flex gap-3">
            <Select value={selectedModel} onValueChange={(value: string) => setSelectedModel(value as AIModel)}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span>Gemini 2.5 Flash</span>
                    <span className="text-xs text-gray-400 ml-1">Google</span>
                  </div>
                </SelectItem>
                <SelectItem value="groq" disabled={!models.groq}>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-orange-500" />
                    <span>Llama 3.3 70B</span>
                    <span className="text-xs text-gray-400 ml-1">Groq {!models.groq && '· not configured'}</span>
                  </div>
                </SelectItem>
                <SelectItem value="llama" disabled={!models.llama}>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-green-500" />
                    <span>Llama 3.1 8B</span>
                    <span className="text-xs text-gray-400 ml-1">{models.llama ? models.llamaModel : 'Ollama offline'}</span>
                  </div>
                </SelectItem>
                <SelectItem value="qwen" disabled={!models.qwen}>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    <span>Qwen 2.5 7B</span>
                    <span className="text-xs text-gray-400 ml-1">{models.qwen ? models.qwenModel : 'not pulled'}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => generateUserStories(selectedModel)}
              disabled={isProcessing || !requirements.trim() || isExtracting || models.isChecking}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium"
            >
              {isProcessing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Generate Stories</>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                const validation = safeValidateRequirements({ requirements, selectedKeywords, numStories });
                if (!validation.success) {
                  setError(validation.error || 'Validation failed');
                  return;
                }
                setComparisonPrompt(buildPrompt({ outputFormat, numStories, requirements, keywords: selectedKeywords, detectedDomain }));
              }}
              disabled={!requirements.trim() || isProcessing || isExtracting}
              className="border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950"
              title="Run the same prompt on all available models and compare results"
            >
              <BarChart2 className="w-4 h-4 mr-2" />
              Compare
            </Button>
          </div>

          {/* Model status indicators */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              ✓ Gemini ready
            </span>
            {models.groq && (
              <span className="text-xs px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                ✓ Groq ready · {models.groqModel}
              </span>
            )}
            {models.llama && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                ✓ Llama ready · {models.llamaModel}
              </span>
            )}
            {models.qwen && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                ✓ Qwen ready · {models.qwenModel}
              </span>
            )}
            {!models.llama && !models.isChecking && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700">
                Ollama offline
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </Card>
      )}

      {/* User Stories Result */}
      {userStoryResult && (
        <StoryResult
          result={userStoryResult}
          isExportingJira={isExportingJira}
          onDownload={downloadUserStories}
          onExportJira={exportToJira}
        />
      )}

      {/* Jira Export Results */}
      {jiraResults && <JiraResults results={jiraResults} />}

      {/* Model Comparison */}
      {comparisonPrompt && (
        <ModelComparison
          prompt={comparisonPrompt}
          availableModels={{ gemini: true, groq: models.groq, llama: models.llama, qwen: models.qwen }}
          onClose={() => setComparisonPrompt(null)}
        />
      )}

      {/* Instructions */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">How it works:</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3">
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">1</div>
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-200">Input Requirements</h4>
                <p className="text-blue-700 dark:text-blue-300 text-sm">Enter text manually or upload a text/media file with your software requirements</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">2</div>
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-200">Configure & Generate</h4>
                <p className="text-blue-700 dark:text-blue-300 text-sm">Select keywords, choose number of stories, and let AI generate user stories</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">3</div>
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-200">Download Results</h4>
                <p className="text-blue-700 dark:text-blue-300 text-sm">Review and download your generated user stories as a text file</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
