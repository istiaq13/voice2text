'use client';

import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/core/layout';

export interface JiraExportResult {
  results: { key: string; url: string; summary: string }[];
  errors: { summary: string; error: string }[];
}

export function JiraResults({ results }: { results: JiraExportResult }) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.762a1.005 1.005 0 0 0-1.001-1.005zM23.013 0H11.459a5.215 5.215 0 0 0 5.214 5.215h2.129v2.057A5.215 5.215 0 0 0 24.017 12.49V1.005A1.005 1.005 0 0 0 23.013 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Jira Export — {results.results.length} of {results.results.length + results.errors.length} stories created
        </h3>
      </div>

      {results.results.length > 0 && (
        <div className="space-y-2">
          {results.results.map((issue) => (
            <div key={issue.key} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
              >
                {issue.key}
              </a>
              <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{issue.summary}</span>
            </div>
          ))}
        </div>
      )}

      {results.errors.length > 0 && (
        <div className="space-y-2">
          {results.errors.map((err, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{err.summary}</p>
                <p className="text-xs text-red-600 dark:text-red-400">{err.error}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
