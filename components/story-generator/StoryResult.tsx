'use client';

import React from 'react';
import { CheckCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/core/button';
import { Card } from '@/components/core/layout';
import { UserStoryLoadingSkeleton } from '@/components/ui/skeleton';
import { parseStoryBlocks } from '@/lib/story-parser';
import type { UserStoryResult } from '@/types';

interface StoryResultProps {
  result: UserStoryResult;
  isExportingJira: boolean;
  onDownload: () => void;
  onExportJira: () => void;
}

export function StoryResult({ result, isExportingJira, onDownload, onExportJira }: StoryResultProps) {
  return (
    <Card className="p-6 space-y-6">
      {result.status === 'processing' ? (
        <UserStoryLoadingSkeleton />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {result.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {result.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Generated {result.numStories} User Stories
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {result.timestamp?.toLocaleString?.() || 'Processing...'}
                  {result.model && (
                    <span className="ml-2">
                      • Model: <span className="font-medium capitalize">{result.model}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            {result.status === 'completed' && result.userStories && (
              <div className="flex gap-2">
                <Button onClick={onDownload} variant="outline" size="sm" disabled={isExportingJira}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  onClick={onExportJira}
                  disabled={isExportingJira}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isExportingJira ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting...</>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.762a1.005 1.005 0 0 0-1.001-1.005zM23.013 0H11.459a5.215 5.215 0 0 0 5.214 5.215h2.129v2.057A5.215 5.215 0 0 0 24.017 12.49V1.005A1.005 1.005 0 0 0 23.013 0z" />
                      </svg>
                      Export to Jira
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {result.status === 'completed' && result.userStories && (
            <div className="space-y-4">
              {parseStoryBlocks(result.userStories).map((block, idx) => {
                const storyContent = block.storyLine.replace(/^(\d+[\.\)])\s/, '');
                const storyNum = block.storyLine.match(/^\d+/)?.[0] || String(idx + 1);
                const asMatch = storyContent.match(/^As a (.+?),?\s*I want (.+?),?\s*so that (.+?)\.?$/i);

                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-gray-800 rounded-lg p-5 border-l-4 border-blue-500 dark:border-blue-400 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-300 font-semibold text-sm">{storyNum}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        {asMatch ? (
                          <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">As a {asMatch[1]}</span>
                            <span className="text-gray-600 dark:text-gray-400">, </span>
                            <span className="font-medium">I want {asMatch[2]}</span>
                            <span className="text-gray-600 dark:text-gray-400"> so that </span>
                            <span className="text-gray-700 dark:text-gray-300">{asMatch[3]}</span>
                          </p>
                        ) : (
                          <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{storyContent}</p>
                        )}
                        {block.details.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
                            {block.details.map((detail, di) => {
                              const isHeader =
                                !detail.startsWith('-') &&
                                !detail.startsWith('Given') &&
                                !detail.startsWith('When') &&
                                !detail.startsWith('Then') &&
                                detail.endsWith(':');
                              return (
                                <p
                                  key={di}
                                  className={`text-sm ${isHeader ? 'font-semibold text-gray-700 dark:text-gray-300 mt-2' : 'text-gray-500 dark:text-gray-400 pl-2'}`}
                                >
                                  {detail}
                                </p>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
