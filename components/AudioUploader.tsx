'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileAudio, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { transcribeAudio } from '@/lib/gemini';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface TranscriptionResult {
  id?: string;
  fileName: string;
  transcription: string;
  timestamp: any;
  status: 'processing' | 'completed' | 'error';
}

export default function AudioUploader() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setTranscriptionResult({
      fileName: file.name,
      transcription: '',
      timestamp: new Date(),
      status: 'processing'
    });

    try {
      const transcription = await transcribeAudio(file);
      
      const result: TranscriptionResult = {
        fileName: file.name,
        transcription,
        timestamp: serverTimestamp(),
        status: 'completed'
      };

      // Save to Firebase
      const docRef = await addDoc(collection(db, 'transcriptions'), result);
      
      setTranscriptionResult({
        ...result,
        id: docRef.id,
        timestamp: new Date()
      });
      
    } catch (err) {
      setError('Failed to transcribe audio. Please try again.');
      setTranscriptionResult(prev => prev ? { ...prev, status: 'error' } : null);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  const downloadTranscription = () => {
    if (!transcriptionResult?.transcription) return;
    
    const blob = new Blob([transcriptionResult.transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${transcriptionResult.fileName.replace(/\.[^/.]+$/, '')}_transcription.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <FileAudio className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900">Audio to Text Converter</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Upload your audio file and we'll convert it to text using AI-powered transcription
        </p>
      </div>

      {/* Upload Area */}
      <Card className="p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
            ${isDragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {isProcessing ? (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Processing Audio...</h3>
                <p className="text-gray-600">Please wait while we transcribe your audio file</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="w-12 h-12 text-gray-400 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isDragActive ? 'Drop your audio file here' : 'Upload Audio File'}
                </h3>
                <p className="text-gray-600">
                  Drag and drop your audio file here, or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Supports MP3, WAV, M4A, OGG, WebM (Max 25MB)
                </p>
              </div>
              <Button variant="outline" className="mt-4">
                Choose File
              </Button>
            </div>
          )}
        </div>
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

      {/* Transcription Result */}
      {transcriptionResult && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {transcriptionResult.status === 'completed' && (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              {transcriptionResult.status === 'processing' && (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              )}
              {transcriptionResult.status === 'error' && (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {transcriptionResult.fileName}
                </h3>
                <p className="text-sm text-gray-500">
                  {transcriptionResult.timestamp?.toLocaleString?.() || 'Processing...'}
                </p>
              </div>
            </div>
            
            {transcriptionResult.status === 'completed' && transcriptionResult.transcription && (
              <Button onClick={downloadTranscription} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>

          {transcriptionResult.status === 'completed' && transcriptionResult.transcription && (
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Transcription:</h4>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {transcriptionResult.transcription}
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
                <h4 className="font-medium text-blue-900">Upload</h4>
                <p className="text-blue-700 text-sm">Select or drag your audio file</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
              <div>
                <h4 className="font-medium text-blue-900">Process</h4>
                <p className="text-blue-700 text-sm">AI transcribes your audio to text</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
              <div>
                <h4 className="font-medium text-blue-900">Download</h4>
                <p className="text-blue-700 text-sm">Get your transcribed text file</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}