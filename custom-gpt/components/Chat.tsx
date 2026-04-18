"use client";

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    source: string;
    similarity: number;
  }>;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [hasUploadedDocuments, setHasUploadedDocuments] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [urlStatus, setUrlStatus] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadStatus('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadStatus(`✅ ${result.message}`);
      setHasUploadedDocuments(true);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setUploadStatus(`❌ File size exceeds 10MB limit`);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      uploadFile(file);
    }
  };

  const ingestUrl = async () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl || isIngesting) return;

    if (!isValidUrl(trimmedUrl)) {
      setUrlStatus('❌ Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setIsIngesting(true);
    setUrlStatus('');

    try {
      const response = await fetch('/api/ingest-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'URL ingestion failed');
      }

      const result = await response.json();
      setUrlStatus(`✅ ${result.message}`);
      setHasUploadedDocuments(true);
      setUrlInput('');
    } catch (error) {
      console.error('URL ingestion error:', error);
      setUrlStatus(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ingestUrl();
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        sources: data.sources,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Custom GPT - Document Chat
            </h1>
            <p className="text-sm text-gray-600">
              Upload documents or enter a website URL, then ask questions
            </p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <label className="cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,.doc,.docx"
                onChange={handleFileChange}
                disabled={isUploading}
                className="hidden"
              />
              <div className={`px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                {isUploading ? 'Uploading...' : 'Upload Document'}
              </div>
            </label>
            {uploadStatus && (
              <p className="text-xs text-gray-600 max-w-xs text-right">{uploadStatus}</p>
            )}
          </div>
        </div>

        {/* URL Input Section */}
        <div className="mt-3 flex items-center space-x-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            placeholder="Enter a website URL (e.g., https://example.com)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isIngesting}
          />
          <button
            onClick={ingestUrl}
            disabled={!urlInput.trim() || isIngesting}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
          >
            {isIngesting ? 'Ingesting...' : 'Ingest URL'}
          </button>
        </div>
        {urlStatus && (
          <p className="mt-1 text-xs text-gray-600">{urlStatus}</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg">Welcome to Custom GPT!</p>
            <p className="text-sm mt-2">
              {hasUploadedDocuments
                ? "Ask questions about your uploaded documents or ingested websites."
                : "Upload documents or enter a website URL above, then ask questions about them."
              }
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 text-xs text-gray-500 border-t pt-2">
                  <p className="font-medium">Sources:</p>
                  {message.sources.map((source, index) => (
                    <p key={index}>
                      {source.source} (similarity: {(source.similarity * 100).toFixed(1)}%)
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                <span className="text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        {!hasUploadedDocuments ? (
          <div className="text-center text-gray-500">
            <p className="text-sm">Please upload a document or ingest a website URL first to start chatting.</p>
          </div>
        ) : (
          <form onSubmit={sendMessage} className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your uploaded documents or websites..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}