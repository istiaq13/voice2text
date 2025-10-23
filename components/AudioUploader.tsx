'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, FileText, FileAudio, Loader2, CheckCircle, AlertCircle, Download, X, Plus, Sparkles, Cpu, Tag, Mic, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/core/button';
import { Card } from '@/components/core/layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Textarea } from '@/components/core/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/core/layout';
import { Badge } from '@/components/ui/badge';
import { FileUploadSkeleton, UserStoryLoadingSkeleton } from '@/components/ui/skeleton';
import { transcribeAudio } from '@/lib/gemini';
import { useTheme } from '@/contexts/ThemeContext';
import { safeValidateRequirements } from '@/lib/validators';
import type { UserStoryResult, AIModel } from '@/types';

// Enhanced keyword configuration with categories
const KEYWORD_CATEGORIES = {
  'E-commerce': ['Shopping Cart', 'Payment', 'Checkout', 'Product Catalog', 'Inventory', 'Order Management', 'Shipping'],
  'Authentication': ['Login', 'Registration', 'Password Reset', 'OAuth', 'Two-Factor Auth', 'Session Management', 'User Roles'],
  'Social Media': ['Posts', 'Comments', 'Likes', 'Shares', 'Follow', 'Messaging', 'Notifications', 'Profile'],
  'Analytics': ['Dashboard', 'Reports', 'Charts', 'Metrics', 'KPIs', 'Data Export', 'Real-time Updates'],
  'Project Management': ['Tasks', 'Projects', 'Teams', 'Deadlines', 'Milestones', 'Kanban Board', 'Time Tracking'],
  'Healthcare': ['Appointments', 'Patients', 'Medical Records', 'Prescriptions', 'Diagnosis', 'Billing', 'Insurance'],
  'Education': ['Courses', 'Students', 'Assignments', 'Grades', 'Exams', 'Enrollment', 'Certifications'],
  'Communication': ['Chat', 'Video Call', 'Email', 'SMS', 'Push Notifications', 'File Sharing', 'Screen Sharing'],
  'AI/ML': ['Machine Learning', 'Natural Language', 'Computer Vision', 'Predictions', 'Training', 'Model Deployment'],
  'Mobile': ['iOS', 'Android', 'Push Notifications', 'Offline Mode', 'Camera', 'GPS', 'Biometrics']
};

// Flatten all keywords for search
const ALL_KEYWORDS = Object.values(KEYWORD_CATEGORIES).flat();

export default function AudioUploader() {
  const { theme, toggleTheme } = useTheme();
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
  const [isLlamaAvailable, setIsLlamaAvailable] = useState(false);
  const [isCheckingLlama, setIsCheckingLlama] = useState(true);
  const [llamaModel, setLlamaModel] = useState<string>('');

  // Maximum keywords limit
  const MAX_KEYWORDS = 10;

  // Auto-suggest keywords based on requirements text
  useEffect(() => {
    if (requirements.length > 50) {
      const suggested = autoSuggestKeywords(requirements);
      setSuggestedKeywords(suggested);
    } else {
      setSuggestedKeywords([]);
    }
  }, [requirements]);

  // Check Llama availability on component mount
  useEffect(() => {
    const checkLlamaAvailability = async () => {
      try {
        const response = await fetch('/api/generate-stories-llama');
        const data = await response.json();
        setIsLlamaAvailable(data.available || false);
        if (data.model) {
          setLlamaModel(data.model);
        }
      } catch (error) {
        console.error('Failed to check Llama availability:', error);
        setIsLlamaAvailable(false);
      } finally {
        setIsCheckingLlama(false);
      }
    };

    checkLlamaAvailability();
  }, []);

  // Auto-suggest keywords based on text analysis
  function autoSuggestKeywords(text: string): string[] {
    const textLower = text.toLowerCase();
    const suggestions: string[] = [];

    ALL_KEYWORDS.forEach(keyword => {
      if (textLower.includes(keyword.toLowerCase()) && 
          !selectedKeywords.includes(keyword)) {
        suggestions.push(keyword);
      }
    });

    // Return top 5 suggestions
    return suggestions.slice(0, 5);
  }

  // Add keyword with validation
  function addKeyword(keyword: string) {
    const trimmedKeyword = keyword.trim();
    
    // Validation
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

    setSelectedKeywords(prev => [...prev, trimmedKeyword]);
    setCustomKeyword('');
  }

  // Remove keyword
  function removeKeyword(keyword: string) {
    setSelectedKeywords(prev => prev.filter(k => k !== keyword));
  }

  // Toggle keyword
  function toggleKeyword(keyword: string) {
    if (selectedKeywords.includes(keyword)) {
      removeKeyword(keyword);
    } else {
      addKeyword(keyword);
    }
  }

  // Clear all keywords
  function clearAllKeywords() {
    setSelectedKeywords([]);
  }

  // Get filtered keywords based on search and category
  function getFilteredKeywords(): string[] {
    let keywords: string[] = [];

    if (selectedCategory === 'All') {
      keywords = ALL_KEYWORDS;
    } else {
      keywords = KEYWORD_CATEGORIES[selectedCategory as keyof typeof KEYWORD_CATEGORIES] || [];
    }

    if (keywordSearch.trim()) {
      keywords = keywords.filter(k => 
        k.toLowerCase().includes(keywordSearch.toLowerCase())
      );
    }

    return keywords;
  }

  // Legacy functions for compatibility (now use the new functions above)
  const handleKeywordSelect = (keyword: string) => addKeyword(keyword);
  const handleKeywordRemove = (keyword: string) => removeKeyword(keyword);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
    // Handle file rejections
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
      // Use the unified extract-text API for all file types
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'gemini'); // Default to Gemini for audio/video

      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract text from file');
      }

      const data = await response.json();
      
      if (!data.text || !data.text.trim()) {
        setError('No text was extracted from the file. The file might be empty or corrupted.');
        return;
      }

      setRequirements(data.text);
      console.log(`✅ Extracted ${data.characterCount} characters using ${data.method}`);
      
    } catch (err) {
      console.error('File extraction error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      // Documents
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      // Audio
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm'],
      // Video
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: isProcessing || isExtracting
  });

  const generateUserStories = async (model: AIModel = 'gemini') => {
    // Validate using Zod schema
    const validation = safeValidateRequirements({
      requirements,
      selectedKeywords,
      numStories,
    });

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
      // Call appropriate API based on selected model
      const keywordsText = selectedKeywords.length > 0 ? ` Focus on these keywords: ${selectedKeywords.join(', ')}.` : '';
      const prompt = `Generate exactly ${numStories} user stories based on these software requirements: 

${requirements}

${keywordsText}

Please format the user stories as:
1. As a [user type], I want [goal] so that [benefit].
2. As a [user type], I want [goal] so that [benefit].
...and so on.

Make sure each user story follows the standard format and is relevant to the requirements provided.`;
      
      const apiEndpoint = model === 'llama' ? '/api/generate-stories-llama' : '/api/generate-stories';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      const result: UserStoryResult = {
        requirements,
        keywords: selectedKeywords,
        userStories: data.stories,
        numStories,
        timestamp: new Date(),
        status: 'completed',
        model,
      };

      setUserStoryResult(result);
      
    } catch (err) {
      console.error('Story generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to generate user stories: ${errorMessage}`);
      setUserStoryResult(prev => prev ? { ...prev, status: 'error' } : null);
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4 relative">
        {/* Theme Toggle Button - Absolute positioned in top-right */}
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
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
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
                <h4 className="text-md font-medium text-gray-900 dark:text-white">Extracted Requirements:</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 max-h-40 overflow-y-auto">
                  <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap">
                    {requirements.substring(0, 500)}{requirements.length > 500 ? '...' : ''}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Configuration */}
      <Card className="p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configuration</h3>
        
        <div className="grid md:grid-cols-4 gap-6">
          {/* Number of Stories - Takes 1 column */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Number of User Stories</label>
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

          {/* Enhanced Keywords Section - Takes 3 columns */}
          <div className="md:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Keywords ({selectedKeywords.length}/{MAX_KEYWORDS})
              </label>
              {selectedKeywords.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAllKeywords}
                  className="text-xs"
                >
                  Clear All
                </Button>
              )}
            </div>

            {/* Selected Keywords Display */}
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
              <label className="text-xs font-medium">Browse by Category:</label>
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
              {getFilteredKeywords().map((keyword) => {
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

        {/* Generate Buttons */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Choose AI Model:
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Gemini Button */}
            <Button 
              onClick={() => generateUserStories('gemini')} 
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 dark:from-blue-400 dark:to-purple-500 dark:hover:from-blue-500 dark:hover:to-purple-600 text-white font-medium"
              disabled={isProcessing || !requirements.trim() || isExtracting}
            >
              {isProcessing && userStoryResult?.model === 'gemini' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gemini AI
                </>
              )}
            </Button>

            {/* Llama Button */}
            <Button 
              onClick={() => generateUserStories('llama')} 
              className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 dark:from-green-400 dark:to-teal-500 dark:hover:from-green-500 dark:hover:to-teal-600 text-white font-medium"
              disabled={!isLlamaAvailable || isProcessing || !requirements.trim() || isExtracting}
              title={!isLlamaAvailable ? 'Llama model not available. Please ensure Ollama is running.' : `Generate with local Llama model (${llamaModel})`}
            >
              {isCheckingLlama ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : isProcessing && userStoryResult?.model === 'llama' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4 mr-2" />
                  {isLlamaAvailable && llamaModel ? (
                    <span className="flex flex-col items-start">
                      <span>Llama Local</span>
                      <span className="text-xs opacity-80">({llamaModel})</span>
                    </span>
                  ) : (
                    `Llama (Offline)`
                  )}
                </>
              )}
            </Button>
          </div>
          
          {isLlamaAvailable && llamaModel && (
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-2 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" />
              <span>Llama model <strong>{llamaModel}</strong> is ready on your local machine</span>
            </div>
          )}
          
          {!isLlamaAvailable && !isCheckingLlama && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 p-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded">
              Tip: To use the local Llama model, install and run <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Ollama</a> on your machine.
            </div>
          )}
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
        <Card className="p-6 space-y-6">
          {userStoryResult.status === 'processing' ? (
            <UserStoryLoadingSkeleton />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {userStoryResult.status === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {userStoryResult.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Generated {userStoryResult.numStories} User Stories
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {userStoryResult.timestamp?.toLocaleString?.() || 'Processing...'}
                      {userStoryResult.model && (
                        <span className="ml-2">
                          • Model: <span className="font-medium capitalize">{userStoryResult.model}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                {userStoryResult.status === 'completed' && userStoryResult.userStories && (
                  <Button onClick={downloadUserStories} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>

              {userStoryResult.status === 'completed' && userStoryResult.userStories && (
                <div className="space-y-4">
                  {/* Parse and display user stories in a structured format */}
                  {userStoryResult.userStories.split('\n').map((line, index) => {
                    const trimmedLine = line.trim();
                    
                    // Skip empty lines
                    if (!trimmedLine) return null;
                    
                    // Remove any markdown bold markers (**text**)
                    const cleanedLine = trimmedLine.replace(/\*\*/g, '');
                    
                    // Check if line is a numbered user story (starts with number and period/parenthesis)
                    const isUserStory = /^(\d+[\.\)]|\*|\-)\s/.test(cleanedLine);
                    
                    if (isUserStory) {
                      // Extract the story number and content
                      const storyContent = cleanedLine.replace(/^(\d+[\.\)]|\*|\-)\s/, '');
                      
                      // Parse "As a... I want... so that..." format
                      const asMatch = storyContent.match(/^As a (.+?),?\s*I want (.+?),?\s*so that (.+)\.?$/i);
                      
                      return (
                        <div 
                          key={index}
                          className="bg-white dark:bg-gray-800 rounded-lg p-5 border-l-4 border-blue-500 dark:border-blue-400 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-300 font-semibold text-sm">
                                {cleanedLine.match(/^\d+/)?.[0] || '•'}
                              </span>
                            </div>
                            <div className="flex-1 space-y-2">
                              {asMatch ? (
                                <>
                                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">As a {asMatch[1]}</span>
                                    <span className="text-gray-600 dark:text-gray-400">, </span>
                                    <span className="font-medium">I want {asMatch[2]}</span>
                                    <span className="text-gray-600 dark:text-gray-400"> so that </span>
                                    <span className="text-gray-700 dark:text-gray-300">{asMatch[3]}</span>
                                  </p>
                                </>
                              ) : (
                                <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                                  {storyContent}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // For section headers or other text (also remove asterisks)
                    if (cleanedLine.length > 0) {
                      return (
                        <div key={index} className="text-gray-700 dark:text-gray-300 text-sm font-medium px-2">
                          {cleanedLine}
                        </div>
                      );
                    }
                    
                    return null;
                  })}
                </div>
              )}
            </>
          )}
        </Card>
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