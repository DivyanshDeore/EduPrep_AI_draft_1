import { auth } from '../lib/firebase.ts';
import { AiStatusResponse } from '../types/academic.ts';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      data.error || `Request failed (${response.status})`,
      data.code || 'API_ERROR',
      response.status
    );
  }
  return data as T;
}

export const apiClient = {
  getAiStatus: () => requestJson<AiStatusResponse>('/api/ai/status'),

  parseSyllabusFile: (file: File, model?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (model) formData.append('model', model);
    return requestJson<{
      fileName: string;
      fileType: 'pdf' | 'txt' | 'docx';
      fileSize: number;
      extractedText: string;
      structured: {
        subjectCode: string;
        subjectTitle: string;
        instructor: string;
        credits: number;
        description: string;
        topics: {
          orderIndex: number;
          weekNumber?: number;
          title: string;
          description: string;
          keyConcepts: string[];
        }[];
        modelUsed: string;
      } | null;
      aiWarning: string | null;
    }>('/api/syllabus/parse', {
      method: 'POST',
      body: formData,
    });
  },

  parseSyllabusText: (rawText: string, fileName?: string, model?: string) =>
    requestJson<{
      fileName: string;
      fileType: 'pasted';
      fileSize: number;
      extractedText: string;
      structured: {
        subjectCode: string;
        subjectTitle: string;
        instructor: string;
        credits: number;
        description: string;
        topics: {
          orderIndex: number;
          weekNumber?: number;
          title: string;
          description: string;
          keyConcepts: string[];
        }[];
        modelUsed: string;
      } | null;
      aiWarning: string | null;
    }>('/api/syllabus/parse', {
      method: 'POST',
      body: JSON.stringify({ rawText, fileName, model }),
    }),

  generateNotes: (payload: {
    subjectTitle: string;
    subjectCode?: string;
    topicTitle: string;
    topicDescription?: string;
    syllabusContext?: string;
    customInstructions?: string;
    model?: string;
  }) =>
    requestJson<{
      title: string;
      introduction: string;
      importantConcepts: string[];
      detailedExplanations: string;
      keyDefinitions: { term: string; definition: string }[];
      examples: string[];
      importantPoints: string[];
      conclusion: string;
      aiAssisted: boolean;
      modelUsed: string;
    }>('/api/ai/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateSummary: (payload: {
    title: string;
    sourceText: string;
    focusMode?: 'concise' | 'balanced' | 'exam';
    model?: string;
  }) =>
    requestJson<{
      title: string;
      summaryText: string;
      keyTakeaways: string[];
      aiAssisted: boolean;
      modelUsed: string;
    }>('/api/ai/summary', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generatePreCap: (payload: {
    subjectTitle: string;
    subjectCode?: string;
    topicTitle: string;
    topicDescription?: string;
    lectureDetails?: string;
    syllabusContext?: string;
    includeResources?: boolean;
    model?: string;
  }) =>
    requestJson<{
      introduction: string;
      concepts: string[];
      definitions: { term: string; definition: string }[];
      prerequisites: string[];
      questions: string[];
      suggestedResources: { title: string; source: string; resourceType: string; url: string }[];
      aiAssisted: boolean;
      modelUsed: string;
    }>('/api/ai/precap', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  searchResources: (payload: {
    subjectTitle: string;
    topicTitle?: string;
    query?: string;
  }) =>
    requestJson<{
      resources: {
        title: string;
        source: string;
        resourceType: 'youtube' | 'documentation' | 'tutorial' | 'article' | 'open_course';
        url: string;
        description: string;
        isGrounded: boolean;
      }[];
      fallbackSearchLinks: {
        title: string;
        source: string;
        resourceType: 'youtube' | 'documentation' | 'tutorial' | 'article' | 'open_course';
        url: string;
        description: string;
        isGrounded: boolean;
      }[];
      grounded: boolean;
      summaryNote: string;
      modelUsed?: string;
    }>('/api/ai/resources', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendChatMessage: (payload: {
    messages: { role: 'user' | 'model'; text: string }[];
    systemInstruction?: string;
    model?: string;
  }) =>
    requestJson<{
      reply: string;
      modelUsed: string;
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  animateImageToVideo: (formData: FormData) =>
    requestJson<{
      videoBase64: string;
      mimeType: string;
      aspectRatio: '16:9' | '9:16';
      modelUsed: string;
    }>('/api/ai/animate-video', {
      method: 'POST',
      body: formData,
    }),
};
