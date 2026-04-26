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
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [urlStatus, setUrlStatus] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'upload' | 'url' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources');
      if (!response.ok) {
        throw new Error('Failed to load sources');
      }

      const data = await response.json();
      const sources = Array.isArray(data.sources)
        ? data.sources.filter((source: unknown) => typeof source === 'string' && source.trim()) as string[]
        : [];

      setAvailableSources(sources);
      if (sources.length > 0) {
        setHasUploadedDocuments(true);
      }
    } catch (error) {
      console.error('Source fetch error:', error);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const selectSource = (source: string) => {
    setSelectedSource(source);
    setHasUploadedDocuments(true);
    setMessages([]);
    setUploadStatus('');
    setUrlStatus('');
  };

  const resetSourceSelection = () => {
    setSelectedSource(null);
    setMessages([]);
    setUploadStatus('');
    setUrlStatus('');
  };

  const uploadFile = async (file: File) => {
    const sourceValue = sourceName.trim() || file.name;
    setIsUploading(true);
    setUploadStatus('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', sourceValue);

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
      setSelectedSource(sourceValue);
      setSourceName('');
      closeModal();
      fetchSources();

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

    const sourceValue = sourceName.trim() || trimmedUrl;
    setIsIngesting(true);
    setUrlStatus('');

    try {
      const response = await fetch('/api/ingest-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trimmedUrl, source: sourceValue }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'URL ingestion failed');
      }

      const result = await response.json();
      setUrlStatus(`✅ ${result.message}`);
      setHasUploadedDocuments(true);
      setSelectedSource(sourceValue);
      setUrlInput('');
      setSourceName('');
      closeModal();
      fetchSources();
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
      const payload: Record<string, unknown> = { message: userMessage.content };
      if (selectedSource) {
        payload.source = selectedSource;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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

  const openModal = (type: 'upload' | 'url') => {
  setModalType(type);
  setIsModalOpen(true);
};

const closeModal = () => {
  setIsModalOpen(false);
  setModalType(null);
  setUploadStatus('');
  setUrlStatus('');
  setUrlInput('');
  setSourceName('');
  if (fileInputRef.current) {
    fileInputRef.current.value = '';
  }
};

 return (
  <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
    {/* Header */}
    <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4 shadow-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              AI Document Assistant
            </h1>
            <p className="text-sm text-gray-600">
              Chat with your documents and websites
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <div className="flex space-x-2">
            <button
              onClick={() => openModal('upload')}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Upload Document</span>
                </div>
              </button>
              <button
                onClick={() => openModal('url')}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Ingest URL</span>
                </div>
              </button>
            </div>
            {selectedSource ? (
              <div className="flex items-center space-x-3">
                <div className="text-sm text-indigo-600 font-medium">
                  Selected source: {selectedSource}
                </div>
                {availableSources.length > 1 && (
                  <button
                    onClick={resetSourceSelection}
                    className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full hover:bg-indigo-200 transition"
                  >
                    Change source
                  </button>
                )}
              </div>
            ) : hasUploadedDocuments ? (
              <div className="text-sm text-green-600 font-medium">
                ✓ Sources available
              </div>
            ) : null}
          </div>
      </div>
    </div>

    {/* Modal */}
    {isModalOpen && (
      <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {modalType === 'upload' ? 'Upload Document' : 'Ingest Website'}
              </h2>
              <button
                onClick={closeModal}
                disabled={isIngesting}
                className={`text-gray-400 ${isIngesting ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modalType === 'upload' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Source name (optional)</label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. Customer Contracts"
                    disabled={isUploading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  />
                </div>
                <label className="cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.pdf,.doc,.docx"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <div className={`w-full px-4 py-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-center transition-all duration-200 ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    {isUploading ? (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                        <span className="text-green-700 font-medium">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-2">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-gray-700 font-medium">Click to select a file</span>
                        <span className="text-sm text-gray-500">PDF, DOC, TXT, MD up to 10MB</span>
                      </div>
                    )}
                  </div>
                </label>
                {uploadStatus && (
                  <p className={`text-sm px-3 py-2 rounded-lg ${
                    uploadStatus.startsWith('✅') 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {uploadStatus}
                  </p>
                )}
              </div>
            )}

            {modalType === 'url' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Source name (optional)</label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. Example Website"
                    disabled={isIngesting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={handleUrlKeyDown}
                      placeholder="https://example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      disabled={isIngesting}
                    />
                    <svg className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <button
                    onClick={ingestUrl}
                    disabled={!urlInput.trim() || isIngesting}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {isIngesting ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Analyzing...</span>
                      </div>
                    ) : (
                      <span>Analyze</span>
                    )}
                  </button>
                </div>
                {urlStatus && (
                  <p className={`text-sm px-3 py-2 rounded-lg ${
                    urlStatus.startsWith('✅') 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {urlStatus}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Messages */}
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      {selectedSource && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          Chatting using source: <span className="font-semibold">{selectedSource}</span>. You can still upload or ingest a new source from the header.
        </div>
      )}
      {messages.length === 0 && (
        <div className="text-center text-gray-500 mt-16">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-gray-700 mb-2">Welcome to AI Document Assistant!</p>
          <p className="text-lg text-gray-600 mb-4">
            {hasUploadedDocuments
              ? "I'm ready to answer questions about your documents and websites."
              : "Choose how you'd like to add content to get started."
            }
          </p>
          {!hasUploadedDocuments && (
            <div className="flex justify-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Upload PDFs, Docs, TXT</span>
              </div>
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>Analyze Websites</span>
              </div>
            </div>
          )}

          {availableSources.length > 0 && !selectedSource && (
            <div className="mt-8 text-left">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Choose a source to chat</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {availableSources.map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => selectSource(source)}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                  >
                    <div className="text-sm font-semibold text-gray-900 truncate">{source}</div>
                    <div className="mt-2 text-xs text-gray-500">Tap to start chatting with this source</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start space-x-3 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {message.role === 'assistant' && (
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <div
            className={`max-w-xs lg:max-w-2xl px-4 py-3 rounded-2xl shadow-lg ${
              message.role === 'user'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-md'
                : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
            }`}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center space-x-1 mb-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs font-medium text-gray-600">Sources</p>
                </div>
                <div className="space-y-1">
                  {message.sources.map((source, index) => (
                    <div key={index} className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                      <span className="truncate flex-1">{source.source}</span>
                      <span className="ml-2 text-blue-600 font-medium">
                        {(source.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {message.role === 'user' && (
            <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div className="flex items-start space-x-3 justify-start">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-gray-600 text-sm">Thinking...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>

    {/* Input */}
    <div className="bg-white/80 backdrop-blur-sm border-t border-gray-200/50 px-6 py-4 shadow-lg">
      {selectedSource ? (
        <form onSubmit={sendMessage} className="flex space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask me anything about ${selectedSource}...`}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm pr-12"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-2 p-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center text-gray-500">
          <p className="text-sm">
            {availableSources.length > 0
              ? 'Select a source above to start chatting.'
              : 'Upload a document or ingest a website URL to start chatting.'}
          </p>
        </div>
      )}
    </div>
  </div>
);
}