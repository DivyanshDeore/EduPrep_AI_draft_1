import { GoogleGenAI, Type } from '@google/genai';

export const CHAT_MODELS = [
    {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    subtitle: 'Fast Tasks - Balanced Performance',
    description: 'Fast and capable model for academic Q&A, study notes, summaries, and tutoring.',
    tier: 'standard' as const,
  },
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    subtitle: 'General Tasks · Fast & Balanced',
    description: 'Recommended default for general academic Q&A, study notes, summaries, and lecture pre-caps.',
    tier: 'standard' as const,
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    subtitle: 'Fast Tasks · Ultra Low Latency',
    description: 'High-speed assistant for quick definitions, flashcards, rapid syllabus parsing, and fast chat replies.',
    tier: 'standard' as const,
  },
  {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon',
    subtitle: 'Complex Interactive Tasks',
    description: 'Built for multi-step problem walkthroughs, interactive tutoring dialogues, and rich synthesis.',
    tier: 'paid' as const,
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon',
    subtitle: 'Deep Reasoning Tasks',
    description: 'Flagship reasoning engine for rigorous mathematical proofs, algorithms, and deep theoretical analysis.',
    tier: 'paid' as const,
  },
] as const;

export const ALLOWED_MODELS = new Set<string>(CHAT_MODELS.map((m) => m.id));

export class GeminiServiceError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'GeminiServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function getDefaultModel(): string {
  const configured = (process.env.GEMINI_MODEL || '').trim();
  if (configured && ALLOWED_MODELS.has(configured)) {
    return configured;
  }
  return 'gemini-4-hydrogen';
}

export function resolveModel(requested?: string): string {
  const trimmed = (requested || '').trim();
  if (trimmed && ALLOWED_MODELS.has(trimmed)) {
    return trimmed;
  }
  return getDefaultModel();
}

export function isGeminiConfigured(): boolean {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return Boolean(
    key &&
      key !== 'MY_GEMINI_API_KEY' &&
      key !== 'your_gemini_api_key_here' &&
      !key.startsWith('MY_')
  );
}

function getClient(): GoogleGenAI {
  if (!isGeminiConfigured()) {
    throw new GeminiServiceError(
      'Gemini API key is not configured on the server. Set GEMINI_API_KEY in the Settings > Secrets panel.',
      'AI_KEY_MISSING',
      503
    );
  }

  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapGeminiError(err: unknown): GeminiServiceError {
  if (err instanceof GeminiServiceError) {
    return err;
  }

  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('401')) {
    return new GeminiServiceError(
      'The configured Gemini API key was rejected. Please verify GEMINI_API_KEY in Settings > Secrets.',
      'AI_KEY_INVALID',
      401
    );
  }

  if (lower.includes('permission_denied') || lower.includes('403') || lower.includes('billing') || lower.includes('paid')) {
    return new GeminiServiceError(
      'Permission denied by Gemini API. Advanced or video models (such as gemini-4-carbon, gemini-4-neon, or gemini-omni-1.2-flash) may require a billing-enabled API key in Settings > Secrets.',
      'AI_PERMISSION_DENIED',
      403
    );
  }

  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return new GeminiServiceError(
      'Gemini API quota or rate limit exceeded. Paid models (gemini-4-carbon, gemini-4-neon, gemini-omni-1.2-flash) require a billing-enabled key or higher quota in Settings > Secrets.',
      'AI_QUOTA_EXCEEDED',
      429
    );
  }

  if (lower.includes('not_found') || lower.includes('404')) {
    return new GeminiServiceError(
      'The selected Gemini model could not be found or is unavailable for your API key.',
      'AI_MODEL_NOT_FOUND',
      404
    );
  }

  if (lower.includes('fetch') || lower.includes('network') || lower.includes('econn') || lower.includes('timeout')) {
    return new GeminiServiceError(
      'Network error or timeout while reaching the Gemini API. Please try again.',
      'AI_NETWORK_ERROR',
      503
    );
  }

  return new GeminiServiceError(
    raw && raw.length < 240 ? raw : 'Failed to complete AI generation. Please try again.',
    'AI_GENERATION_FAILED',
    502
  );
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const mapped = mapGeminiError(err);
      if (
        mapped.code === 'AI_KEY_MISSING' ||
        mapped.code === 'AI_KEY_INVALID' ||
        mapped.code === 'AI_PERMISSION_DENIED' ||
        mapped.code === 'AI_MODEL_NOT_FOUND'
      ) {
        throw mapped;
      }
      if (attempt < maxRetries) {
        const delayMs = 450 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw mapGeminiError(lastError);
}

export interface ExtractedTopic {
  orderIndex: number;
  weekNumber?: number;
  title: string;
  description: string;
  keyConcepts: string[];
}

export interface ExtractedSyllabusData {
  subjectCode: string;
  subjectTitle: string;
  instructor: string;
  credits: number;
  description: string;
  topics: ExtractedTopic[];
  modelUsed: string;
}

export async function extractSyllabusStructure(
  rawText: string,
  fileName: string,
  modelOverride?: string
): Promise<ExtractedSyllabusData> {
  const ai = getClient();
  const model = resolveModel(modelOverride);
  const clipped = rawText.slice(0, 35000);

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `Analyze the following university course syllabus (source file: ${fileName}) and extract the course metadata and an ordered list of lecture topics.\n\nSyllabus content:\n${clipped}`,
      config: {
        systemInstruction:
          'You are an academic curriculum parser. Extract accurate course metadata and a clean, sequentially ordered list of topics from the syllabus. Preserve the syllabus order. Keep descriptions concise and academic.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subjectCode: { type: Type.STRING, description: 'Course code e.g. CS 314 or MATH 285' },
            subjectTitle: { type: Type.STRING, description: 'Full course title' },
            instructor: { type: Type.STRING, description: 'Instructor name if present, else empty string' },
            credits: { type: Type.NUMBER, description: 'Credit hours (default 3 if unspecified)' },
            description: { type: Type.STRING, description: 'Brief 1-2 sentence course summary' },
            topics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  orderIndex: { type: Type.INTEGER, description: '1-based sequential order' },
                  weekNumber: { type: Type.INTEGER, description: 'Week number if applicable' },
                  title: { type: Type.STRING, description: 'Topic title' },
                  description: { type: Type.STRING, description: '1-2 sentence topic summary' },
                  keyConcepts: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Up to 5 key concepts in this topic',
                  },
                },
                required: ['orderIndex', 'title', 'description', 'keyConcepts'],
              },
            },
          },
          required: ['subjectCode', 'subjectTitle', 'instructor', 'credits', 'description', 'topics'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const topics: ExtractedTopic[] = Array.isArray(parsed.topics)
      ? parsed.topics.slice(0, 80).map((t: Record<string, unknown>, idx: number) => ({
          orderIndex: typeof t.orderIndex === 'number' ? Math.trunc(t.orderIndex) : idx + 1,
          weekNumber: typeof t.weekNumber === 'number' && t.weekNumber >= 1 ? Math.min(52, Math.trunc(t.weekNumber)) : undefined,
          title: String(t.title || `Topic ${idx + 1}`).slice(0, 190),
          description: String(t.description || '').slice(0, 1500),
          keyConcepts: Array.isArray(t.keyConcepts)
            ? t.keyConcepts.slice(0, 8).map((c) => String(c).slice(0, 120))
            : [],
        }))
      : [];

    return {
      subjectCode: String(parsed.subjectCode || 'COURSE').slice(0, 32),
      subjectTitle: String(parsed.subjectTitle || fileName.replace(/\.[^.]+$/, '')).slice(0, 150),
      instructor: String(parsed.instructor || '').slice(0, 110),
      credits: typeof parsed.credits === 'number' && parsed.credits >= 0 && parsed.credits <= 20 ? parsed.credits : 3,
      description: String(parsed.description || '').slice(0, 1800),
      topics,
      modelUsed: model,
    };
  });
}

export interface GeneratedNotesPayload {
  title: string;
  introduction: string;
  importantConcepts: string[];
  detailedExplanations: string;
  keyDefinitions: { term: string; definition: string }[];
  examples: string[];
  importantPoints: string[];
  conclusion: string;
  modelUsed: string;
}

export async function generateStudyNotes(input: {
  subjectTitle: string;
  subjectCode?: string;
  topicTitle: string;
  topicDescription?: string;
  syllabusContext?: string;
  customInstructions?: string;
  modelOverride?: string;
}): Promise<GeneratedNotesPayload> {
  const ai = getClient();
  const model = resolveModel(input.modelOverride);

  const prompt = [
    `Subject: ${input.subjectCode ? `${input.subjectCode} - ` : ''}${input.subjectTitle}`,
    `Topic: ${input.topicTitle}`,
    input.topicDescription ? `Topic Overview: ${input.topicDescription}` : '',
    input.syllabusContext ? `Syllabus Context:\n${input.syllabusContext.slice(0, 4000)}` : '',
    input.customInstructions ? `Student Focus Instructions: ${input.customInstructions.slice(0, 500)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `Generate comprehensive, university-level structured study notes for the following topic.\n\n${prompt}`,
      config: {
        systemInstruction:
          'You are an expert university teaching fellow. Produce clear, accurate, well-structured study notes containing: topic introduction, important concepts, detailed explanations, key definitions, worked examples, important exam/review points, and a concise conclusion.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            introduction: { type: Type.STRING },
            importantConcepts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            detailedExplanations: { type: Type.STRING },
            keyDefinitions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                },
                required: ['term', 'definition'],
              },
            },
            examples: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            importantPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            conclusion: { type: Type.STRING },
          },
          required: [
            'title',
            'introduction',
            'importantConcepts',
            'detailedExplanations',
            'keyDefinitions',
            'examples',
            'importantPoints',
            'conclusion',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    return {
      title: String(parsed.title || `${input.topicTitle} — Study Notes`).slice(0, 190),
      introduction: String(parsed.introduction || '').slice(0, 4800),
      importantConcepts: Array.isArray(parsed.importantConcepts)
        ? parsed.importantConcepts.slice(0, 15).map((x: unknown) => String(x).slice(0, 300))
        : [],
      detailedExplanations: String(parsed.detailedExplanations || '').slice(0, 22000),
      keyDefinitions: Array.isArray(parsed.keyDefinitions)
        ? parsed.keyDefinitions.slice(0, 15).map((d: Record<string, unknown>) => ({
            term: String(d.term || '').slice(0, 150),
            definition: String(d.definition || '').slice(0, 600),
          }))
        : [],
      examples: Array.isArray(parsed.examples)
        ? parsed.examples.slice(0, 10).map((x: unknown) => String(x).slice(0, 1000))
        : [],
      importantPoints: Array.isArray(parsed.importantPoints)
        ? parsed.importantPoints.slice(0, 15).map((x: unknown) => String(x).slice(0, 400))
        : [],
      conclusion: String(parsed.conclusion || '').slice(0, 4800),
      modelUsed: model,
    };
  });
}

export interface GeneratedSummaryPayload {
  title: string;
  summaryText: string;
  keyTakeaways: string[];
  modelUsed: string;
}

export async function generateStudySummary(input: {
  title: string;
  sourceText: string;
  focusMode?: 'concise' | 'balanced' | 'exam';
  modelOverride?: string;
}): Promise<GeneratedSummaryPayload> {
  const ai = getClient();
  const model = resolveModel(input.modelOverride);
  const modeHint =
    input.focusMode === 'concise'
      ? 'Keep the summary crisp and scannable (under 250 words) while retaining core meaning.'
      : input.focusMode === 'exam'
      ? 'Highlight testable concepts, edge cases, and formulas without losing original meaning.'
      : 'Provide a balanced synthesis preserving all essential concepts and relationships.';

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `Summarize the following academic study material.\n\nTitle: ${input.title}\nGuidance: ${modeHint}\n\nMaterial:\n${input.sourceText.slice(0, 25000)}`,
      config: {
        systemInstruction:
          'You are an academic synthesis specialist. Condense study material accurately without distorting or inventing facts. Return structured summary text and key takeaways.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summaryText: { type: Type.STRING },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['title', 'summaryText', 'keyTakeaways'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    return {
      title: String(parsed.title || `${input.title} — Summary`).slice(0, 190),
      summaryText: String(parsed.summaryText || '').slice(0, 14000),
      keyTakeaways: Array.isArray(parsed.keyTakeaways)
        ? parsed.keyTakeaways.slice(0, 15).map((x: unknown) => String(x).slice(0, 400))
        : [],
      modelUsed: model,
    };
  });
}

export interface GeneratedPreCapPayload {
  introduction: string;
  concepts: string[];
  definitions: { term: string; definition: string }[];
  prerequisites: string[];
  questions: string[];
  modelUsed: string;
}

export async function generateLecturePreCap(input: {
  subjectTitle: string;
  subjectCode?: string;
  topicTitle: string;
  topicDescription?: string;
  lectureDetails?: string;
  syllabusContext?: string;
  modelOverride?: string;
}): Promise<GeneratedPreCapPayload> {
  const ai = getClient();
  const model = resolveModel(input.modelOverride);

  const prompt = [
    `Subject: ${input.subjectCode ? `${input.subjectCode} - ` : ''}${input.subjectTitle}`,
    `Upcoming Topic: ${input.topicTitle}`,
    input.lectureDetails ? `Scheduled Class: ${input.lectureDetails}` : '',
    input.topicDescription ? `Topic Description: ${input.topicDescription}` : '',
    input.syllabusContext ? `Syllabus Context:\n${input.syllabusContext.slice(0, 4000)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `Prepare a short, high-impact Lecture Pre-Cap (pre-class preparation guide) for a student about to attend this lecture.\n\n${prompt}`,
      config: {
        systemInstruction:
          'You are an academic preparation coach. Create a concise Lecture Pre-Cap so the student walks into class primed to understand the lecture. Include an introduction, key concepts to preview before class, core definitions, prerequisite knowledge to review, and thoughtful questions to consider during the lecture.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            introduction: { type: Type.STRING },
            concepts: { type: Type.ARRAY, items: { type: Type.STRING } },
            definitions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                },
                required: ['term', 'definition'],
              },
            },
            prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
            questions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['introduction', 'concepts', 'definitions', 'prerequisites', 'questions'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    return {
      introduction: String(parsed.introduction || '').slice(0, 4800),
      concepts: Array.isArray(parsed.concepts)
        ? parsed.concepts.slice(0, 12).map((x: unknown) => String(x).slice(0, 300))
        : [],
      definitions: Array.isArray(parsed.definitions)
        ? parsed.definitions.slice(0, 12).map((d: Record<string, unknown>) => ({
            term: String(d.term || '').slice(0, 140),
            definition: String(d.definition || '').slice(0, 500),
          }))
        : [],
      prerequisites: Array.isArray(parsed.prerequisites)
        ? parsed.prerequisites.slice(0, 10).map((x: unknown) => String(x).slice(0, 300))
        : [],
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.slice(0, 10).map((x: unknown) => String(x).slice(0, 300))
        : [],
      modelUsed: model,
    };
  });
}

export interface GroundedResourceItem {
  title: string;
  source: string;
  resourceType: 'youtube' | 'documentation' | 'tutorial' | 'article' | 'open_course';
  url: string;
  description: string;
  isGrounded: boolean;
}

function classifyUrl(url: string, title: string): {
  source: string;
  resourceType: GroundedResourceItem['resourceType'];
} {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const lowerTitle = title.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return { source: 'YouTube', resourceType: 'youtube' };
    }
    if (
      host.includes('ocw.mit.edu') ||
      host.includes('coursera.org') ||
      host.includes('edx.org') ||
      host.includes('stanford.edu') ||
      host.includes('khanacademy.org') ||
      host.includes('openstax.org')
    ) {
      return { source: host, resourceType: 'open_course' };
    }
    if (
      host.includes('docs.') ||
      host.includes('developer.mozilla.org') ||
      host.includes('python.org') ||
      host.includes('react.dev') ||
      host.includes('postgresql.org') ||
      lowerTitle.includes('documentation') ||
      lowerTitle.includes('reference')
    ) {
      return { source: host, resourceType: 'documentation' };
    }
    if (
      host.includes('geeksforgeeks') ||
      host.includes('tutorialspoint') ||
      host.includes('freecodecamp') ||
      host.includes('w3schools') ||
      lowerTitle.includes('tutorial') ||
      lowerTitle.includes('guide')
    ) {
      return { source: host, resourceType: 'tutorial' };
    }
    return { source: host, resourceType: 'article' };
  } catch {
    return { source: 'Web', resourceType: 'article' };
  }
}

export function buildDirectSearchLinks(query: string): GroundedResourceItem[] {
  const encoded = encodeURIComponent(query);
  return [
    {
      title: `Search YouTube lectures for "${query}"`,
      source: 'YouTube Search',
      resourceType: 'youtube',
      url: `https://www.youtube.com/results?search_query=${encoded}`,
      description: 'Direct search for educational lectures and visual explanations on YouTube.',
      isGrounded: false,
    },
    {
      title: `Search MIT OpenCourseWare for "${query}"`,
      source: 'MIT OpenCourseWare',
      resourceType: 'open_course',
      url: `https://ocw.mit.edu/search/?q=${encoded}`,
      description: 'Direct search across open university lecture notes, assignments, and exams.',
      isGrounded: false,
    },
    {
      title: `Search Google Scholar for "${query}"`,
      source: 'Google Scholar',
      resourceType: 'article',
      url: `https://scholar.google.com/scholar?q=${encoded}`,
      description: 'Direct search for peer-reviewed papers, textbooks, and academic articles.',
      isGrounded: false,
    },
  ];
}

export async function searchGroundedResources(input: {
  subjectTitle: string;
  topicTitle?: string;
  query?: string;
}): Promise<{
  resources: GroundedResourceItem[];
  fallbackSearchLinks: GroundedResourceItem[];
  grounded: boolean;
  summaryNote: string;
  modelUsed?: string;
}> {
  const searchQuery = [input.subjectTitle, input.topicTitle, input.query]
    .filter((v) => v && v.trim().length > 0)
    .join(' ')
    .trim();

  const fallbackSearchLinks = buildDirectSearchLinks(searchQuery);

  if (!isGeminiConfigured()) {
    return {
      resources: [],
      fallbackSearchLinks,
      grounded: false,
      summaryNote:
        'Live grounded resource search requires GEMINI_API_KEY to be configured on the backend. Use the verified direct search links below in the meantime.',
    };
  }

  const ai = getClient();
  const model = getDefaultModel();

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `Find reputable free educational resources (YouTube educational lectures, official documentation, free tutorials, open courses, or academic articles) for studying: ${searchQuery}.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const seen = new Set<string>();
    const resources: GroundedResourceItem[] = [];

    for (const chunk of chunks) {
      const web = chunk.web;
      if (!web?.uri) continue;
      if (!/^https?:\/\//i.test(web.uri)) continue;
      if (seen.has(web.uri)) continue;
      seen.add(web.uri);

      const title = (web.title || web.uri).slice(0, 220);
      const { source, resourceType } = classifyUrl(web.uri, title);

      resources.push({
        title,
        source,
        resourceType,
        url: web.uri.slice(0, 990),
        description: `Grounded search result for ${searchQuery}.`,
        isGrounded: true,
      });

      if (resources.length >= 10) break;
    }

    return {
      resources,
      fallbackSearchLinks,
      grounded: resources.length > 0,
      summaryNote:
        resources.length > 0
          ? `Retrieved ${resources.length} verified grounded web resources via Google Search.`
          : 'No grounded web chunks were returned for this query. Use the direct search links below.',
      modelUsed: model,
    };
  });
}

export interface ChatTurnInput {
  role: 'user' | 'model';
  text: string;
}

export interface ChatReplyPayload {
  reply: string;
  modelUsed: string;
}

export async function generateChatReply(input: {
  messages: ChatTurnInput[];
  systemInstruction?: string;
  modelOverride?: string;
}): Promise<ChatReplyPayload> {
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new GeminiServiceError('At least one user message is required.', 'VALIDATION_ERROR', 400);
  }
  const latest = input.messages[input.messages.length - 1];
  if (latest.role !== 'user' || !latest.text.trim()) {
    throw new GeminiServiceError('The latest chat turn must be a non-empty user message.', 'VALIDATION_ERROR', 400);
  }

  const ai = getClient();
  const model = resolveModel(input.modelOverride);

  const priorHistory = input.messages.slice(0, -1).map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  const trimmedInstruction = (input.systemInstruction || '').trim().slice(0, 2500);

  return withRetry(async () => {
    const chat = ai.chats.create({
      model,
      history: priorHistory,
      config: trimmedInstruction ? { systemInstruction: trimmedInstruction } : undefined,
    });

    const response = await chat.sendMessage({
      message: latest.text,
    });

    const replyText = (response.text || '').trim();
    if (!replyText) {
      throw new GeminiServiceError('The model returned an empty response. Please try again.', 'AI_EMPTY_RESPONSE', 502);
    }

    return {
      reply: replyText,
      modelUsed: model,
    };
  });
}

export type VideoAspectRatio = '16:9' | '9:16';

export interface AnimatedVideoPayload {
  videoBase64: string;
  mimeType: string;
  aspectRatio: VideoAspectRatio;
  modelUsed: string;
}

export async function animateImageToVideo(input: {
  imageBuffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  prompt: string;
  aspectRatio: VideoAspectRatio;
}): Promise<AnimatedVideoPayload> {
  if (input.aspectRatio !== '16:9' && input.aspectRatio !== '9:16') {
    throw new GeminiServiceError('Aspect ratio must be 16:9 or 9:16.', 'VALIDATION_ERROR', 400);
  }
  if (!input.prompt.trim()) {
    throw new GeminiServiceError('Please enter a motion or animation prompt.', 'VALIDATION_ERROR', 400);
  }

  const ai = getClient();
  const base64Image = input.imageBuffer.toString('base64');

  try {
    const interaction = await (
      ai.interactions as unknown as {
        create: (
          params: Record<string, unknown>,
          options?: { timeout?: number }
        ) => Promise<Record<string, unknown>>;
      }
    ).create(
      {
        model: 'gemini-omni-1.2-flash',
        input: [
          {
            type: 'image',
            mime_type: input.mimeType,
            data: base64Image,
          },
          {
            type: 'text',
            text: input.prompt.trim().slice(0, 1000),
          },
        ],
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: input.aspectRatio,
        },
      },
      { timeout: 300000 }
    );

    let videoPart = interaction.output_video as
      | { data?: string; uri?: string; mime_type?: string }
      | undefined;

    // Fallback: inspect steps -> model_output content array if output_video is nested
    if (!videoPart && Array.isArray(interaction.steps)) {
      for (const step of interaction.steps as Array<Record<string, unknown>>) {
        const modelOut = step.model_output as { content?: Array<Record<string, unknown>> } | undefined;
        const found = modelOut?.content?.find((c) => c.type === 'video');
        if (found) {
          videoPart = found as { data?: string; uri?: string; mime_type?: string };
          break;
        }
      }
    }

    if (!videoPart) {
      throw new GeminiServiceError(
        'No video output was returned by Gemini Omni 1.2 Flash.',
        'AI_VIDEO_MISSING',
        502
      );
    }

    const resolvedMime = videoPart.mime_type || 'video/mp4';
    if (videoPart.data) {
      return {
        videoBase64: videoPart.data,
        mimeType: resolvedMime,
        aspectRatio: input.aspectRatio,
        modelUsed: 'gemini-omni-1.2-flash',
      };
    }

    if (videoPart.uri) {
      const videoResp = await fetch(videoPart.uri, {
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY!.trim(),
        },
      });
      if (!videoResp.ok) {
        throw new GeminiServiceError(
          `Failed to download generated video artifact (HTTP ${videoResp.status}).`,
          'AI_VIDEO_FETCH_FAILED',
          502
        );
      }
      const arrBuf = await videoResp.arrayBuffer();
      return {
        videoBase64: Buffer.from(arrBuf).toString('base64'),
        mimeType: resolvedMime,
        aspectRatio: input.aspectRatio,
        modelUsed: 'gemini-omni-1.2-flash',
      };
    }

    throw new GeminiServiceError(
      'Generated video response contained neither inline bytes nor a downloadable URI.',
      'AI_VIDEO_MISSING',
      502
    );
  } catch (err) {
    throw mapGeminiError(err);
  }
}

