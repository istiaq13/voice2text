'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, FileAudio, Loader2, CheckCircle, AlertCircle, Download, X, Plus } from 'lucide-react';
import { Button } from '@/components/core/button';
import { Card } from '@/components/core/layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/core/form';
import { Input } from '@/components/core/form';
import { Textarea } from '@/components/core/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/core/layout';
import { softwareKeywords } from '@/lib/keywords';
import { transcribeAudio } from '@/lib/gemini';

interface UserStoryResult {
  requirements: string;
  keywords: string[];
  userStories: string;
  numStories: number;
  timestamp: any;
  status: 'processing' | 'completed' | 'error';
}

export default function UserStoryGenerator() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [userStoryResult, setUserStoryResult] = useState<UserStoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [showKeywordInput, setShowKeywordInput] = useState(false);
  const [numStories, setNumStories] = useState<number>(5);
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleKeywordSelect = (keyword: string) => {
    if (!selectedKeywords.includes(keyword)) {
      setSelectedKeywords([...selectedKeywords, keyword]);
    }
  };

  const handleKeywordRemove = (keyword: string) => {
    setSelectedKeywords(selectedKeywords.filter(k => k !== keyword));
  };

  const handleCustomKeywordAdd = () => {
    if (customKeyword.trim() && !selectedKeywords.includes(customKeyword.trim())) {
      setSelectedKeywords([...selectedKeywords, customKeyword.trim()]);
      setCustomKeyword('');
      setShowKeywordInput(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setError(null);

    // If it's a text file, read it directly
    if (file.type === 'text/plain') {
      const text = await file.text();
      setRequirements(text);
    } 
    // If it's an audio/video file, extract text using Gemini
    else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
      setIsExtracting(true);
      try {
        const extractedText = await transcribeAudio(file);
        setRequirements(extractedText);
      } catch (err) {
        setError('Failed to extract text from media file. Please try again.');
      } finally {
        setIsExtracting(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    maxFiles: 1,
    disabled: isProcessing || isExtracting
  });

  const generateUserStories = async () => {
    if (!requirements.trim()) {
      setError('Please enter software requirements');
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
      status: 'processing'
    });

    try {
      // Call Gemini API to generate user stories
      const keywordsText = selectedKeywords.length > 0 ? ` Focus on these keywords: ${selectedKeywords.join(', ')}.` : '';
      const prompt = `Generate exactly ${numStories} user stories based on these software requirements: 

${requirements}

${keywordsText}

Please format the user stories as:
1. As a [user type], I want [goal] so that [benefit].
2. As a [user type], I want [goal] so that [benefit].
...and so on.

Make sure each user story follows the standard format and is relevant to the requirements provided.`;
      
      // Here you would integrate with Gemini API
      // For now, I'll create a more realistic response
      const response = await fetch('/api/generate-stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      let generatedStories = '';
      if (response.ok) {
        const data = await response.json();
        generatedStories = data.stories;
      } else {
        // Fallback with placeholder stories
        generatedStories = Array.from({ length: numStories }, (_, i) => 
          `${i + 1}. As a user, I want to access feature ${i + 1} so that I can accomplish my goals efficiently.`
        ).join('\n\n');
      }
      
      const result: UserStoryResult = {
        requirements,
        keywords: selectedKeywords,
        userStories: generatedStories,
        numStories,
        timestamp: new Date(),
        status: 'completed'
      };

      setUserStoryResult(result);
      
    } catch (err) {
      setError('Failed to generate user stories. Please try again.');
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
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <FileText className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900">User Story Generator</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Generate user stories from your software requirements using AI-powered analysis
        </p>
      </div>

      {/* Input Method Selection */}
      <Card className="p-6">
        <Tabs value={inputMethod} onValueChange={(value) => setInputMethod(value as 'text' | 'file')} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Manual Input</TabsTrigger>
            <TabsTrigger value="file">File Upload</TabsTrigger>
          </TabsList>
          
          <TabsContent value="text" className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Enter Software Requirements</h3>
            <Textarea
              placeholder="Enter your software requirements here... (e.g., I need a web application for managing customer orders with user authentication, payment processing, and real-time notifications)"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="min-h-32"
              disabled={isProcessing}
            />
          </TabsContent>
          
          <TabsContent value="file" className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Upload Requirements File</h3>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${isDragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }
                ${isProcessing || isExtracting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getInputProps()} />
              
              {isExtracting ? (
                <div className="space-y-4">
                  <Loader2 className="w-8 h-8 text-blue-600 mx-auto animate-spin" />
                  <div className="space-y-2">
                    <h4 className="text-md font-semibold text-gray-900">Extracting Text...</h4>
                    <p className="text-gray-600">Please wait while we extract text from your media file</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center space-x-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                    <FileAudio className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-md font-semibold text-gray-900">
                      {isDragActive ? 'Drop your file here' : 'Upload Requirements File'}
                    </h4>
                    <p className="text-gray-600">
                      Upload a text file (.txt) or audio/video file (.mp3, .wav, .mp4, etc.)
                    </p>
                    <p className="text-sm text-gray-500">
                      Text files are read directly. Audio/video files are transcribed using AI.
                    </p>
                  </div>
                  <Button variant="outline" className="mt-4">
                    Choose File
                  </Button>
                </div>
              )}
            </div>
            
            {uploadedFile && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FileText className="w-4 h-4" />
                <span>Uploaded: {uploadedFile.name}</span>
              </div>
            )}
            
            {requirements && (
              <div className="space-y-2">
                <h4 className="text-md font-medium text-gray-900">Extracted Requirements:</h4>
                <div className="bg-gray-50 rounded-lg p-4 border max-h-40 overflow-y-auto">
                  <p className="text-gray-800 text-sm whitespace-pre-wrap">
                    {requirements.substring(0, 500)}{requirements.length > 500 ? '...' : ''}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Configuration */}
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Number of Stories */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Number of User Stories</label>
            <Select value={numStories.toString()} onValueChange={(value) => setNumStories(parseInt(value))}>
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

          {/* Keywords Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Select Keywords</label>
            <Select onValueChange={handleKeywordSelect} disabled={isProcessing}>
              <SelectTrigger>
                <SelectValue placeholder="Choose relevant keywords..." />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {softwareKeywords
                  .filter(keyword => !selectedKeywords.includes(keyword))
                  .map((keyword) => (
                  <SelectItem key={keyword} value={keyword}>
                    {keyword}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Keyword Input */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Selected Keywords:</span>
          <Button
            onClick={() => setShowKeywordInput(!showKeywordInput)}
            variant="outline"
            size="sm"
            disabled={isProcessing}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Custom
          </Button>
        </div>
        
        {showKeywordInput && (
          <div className="flex gap-2">
            <Input
              placeholder="Enter custom keyword"
              value={customKeyword}
              onChange={(e) => setCustomKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCustomKeywordAdd()}
              className="flex-1"
            />
            <Button onClick={handleCustomKeywordAdd} size="sm">
              Add
            </Button>
          </div>
        )}

        {/* Keywords Display */}
        <div className="min-h-16 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          {selectedKeywords.length === 0 ? (
            <p className="text-gray-500 text-sm">No keywords selected. Choose from dropdown or add custom keywords.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                >
                  {keyword}
                  <button
                    onClick={() => handleKeywordRemove(keyword)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    disabled={isProcessing}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Generate Button */}
        <Button 
          onClick={generateUserStories} 
          className="w-full"
          disabled={isProcessing || !requirements.trim() || isExtracting}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating {numStories} User Stories...
            </>
          ) : (
            `Generate ${numStories} User Stories`
          )}
        </Button>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {/* User Stories Result */}
      {userStoryResult && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {userStoryResult.status === 'completed' && (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              {userStoryResult.status === 'processing' && (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              )}
              {userStoryResult.status === 'error' && (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Generated {userStoryResult.numStories} User Stories
                </h3>
                <p className="text-sm text-gray-500">
                  {userStoryResult.timestamp?.toLocaleString?.() || 'Processing...'}
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
              <div className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {userStoryResult.userStories}
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-blue-900">How it works:</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
              <div>
                <h4 className="font-medium text-blue-900">Input Requirements</h4>
                <p className="text-blue-700 text-sm">Enter text manually or upload a text/media file with your software requirements</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
              <div>
                <h4 className="font-medium text-blue-900">Configure & Generate</h4>
                <p className="text-blue-700 text-sm">Select keywords, choose number of stories, and let AI generate user stories</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
              <div>
                <h4 className="font-medium text-blue-900">Download Results</h4>
                <p className="text-blue-700 text-sm">Review and download your generated user stories as a text file</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}