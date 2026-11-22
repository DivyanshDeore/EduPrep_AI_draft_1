export type ThemeMode = 'light' | 'dark' | 'system';
export type TopicStatus = 'pending' | 'in_progress' | 'completed';
export type ResourceType = 'youtube' | 'documentation' | 'tutorial' | 'article' | 'open_course';

export interface StudentProfile {
  uid: string;
  email: string;
  fullName: string;
  institution?: string;
  program?: string;
  academicTerm?: string;
  dailyGoal?: number;
  preferredModel?: string;
  themeMode: ThemeMode;
  photoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationPreference {
  studentId: string;
  leadMinutes: number;
  inAppEnabled: boolean;
  browserEnabled: boolean;
  focusStart?: string;
  focusEnd?: string;
  updatedAt?: unknown;
}

export interface Subject {
  id: string;
  studentId: string;
  code: string;
  title: string;
  instructor?: string;
  credits?: number;
  description?: string;
  syllabusId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Topic {
  id: string;
  studentId: string;
  subjectId: string;
  syllabusId?: string;
  orderIndex: number;
  weekNumber?: number;
  title: string;
  description?: string;
  status: TopicStatus;
  keyConcepts?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SyllabusRecord {
  id: string;
  studentId: string;
  subjectId: string;
  fileName: string;
  fileType: 'pdf' | 'txt' | 'docx' | 'pasted';
  fileSize: number;
  extractedText: string;
  parsedTopicCount: number;
  createdAt?: unknown;
}

export interface TimetableEntry {
  id: string;
  studentId: string;
  subjectId: string;
  subjectCode?: string;
  subjectTitle: string;
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  room: string;
  instructor?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotification {
  id: string;
  studentId: string;
  timetableEntryId: string;
  subjectId: string;
  subjectTitle: string;
  classTime: string;
  room?: string;
  title: string;
  message: string;
  occurrenceKey: string;
  isRead: boolean;
  createdAt?: unknown;
}

export interface KeyDefinition {
  term: string;
  definition: string;
}

export interface SuggestedResourceLink {
  title: string;
  source: string;
  resourceType: string;
  url: string;
}

export interface PreCap {
  id: string;
  studentId: string;
  subjectId: string;
  topicId: string;
  timetableEntryId?: string;
  subjectTitle: string;
  topicTitle: string;
  lectureDetails?: string;
  introduction: string;
  concepts: string[];
  definitions: KeyDefinition[];
  prerequisites: string[];
  questions: string[];
  suggestedResources?: SuggestedResourceLink[];
  aiAssisted: boolean;
  modelUsed?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudyNote {
  id: string;
  studentId: string;
  subjectId: string;
  topicId?: string;
  subjectTitle: string;
  topicTitle: string;
  title: string;
  introduction: string;
  importantConcepts: string[];
  detailedExplanations: string;
  keyDefinitions: KeyDefinition[];
  examples: string[];
  importantPoints: string[];
  conclusion: string;
  aiAssisted: boolean;
  modelUsed?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudySummary {
  id: string;
  studentId: string;
  noteId?: string;
  subjectId?: string;
  title: string;
  sourceLabel?: string;
  summaryText: string;
  keyTakeaways: string[];
  aiAssisted: boolean;
  modelUsed?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LearningResource {
  id: string;
  studentId: string;
  subjectId?: string;
  topicId?: string;
  title: string;
  source: string;
  resourceType: ResourceType;
  url: string;
  description?: string;
  isGrounded: boolean;
  createdAt?: unknown;
}

export type ChatModelId =
  | 'gemini-4-carbon'
  | 'gemini-4-neon'
  | 'gemini-4-hydrogen'
  | 'gemini-3.1-flash-lite';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  createdAtIso: string;
}

export interface ChatSession {
  id: string;
  studentId: string;
  title: string;
  model: ChatModelId;
  systemInstruction?: string;
  messages: ChatMessage[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiModelInfo {
  id: string;
  label: string;
  subtitle?: string;
  description?: string;
  tier?: 'standard' | 'paid';
}

export interface AiStatusResponse {
  configured: boolean;
  defaultModel: string;
  availableModels: AiModelInfo[];
  videoModels?: AiModelInfo[];
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
