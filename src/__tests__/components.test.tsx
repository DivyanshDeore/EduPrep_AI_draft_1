import { fireEvent, render, screen } from '@testing-library/react';
import { Calendar } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../components/EmptyState.tsx';
import { AnimateImagePage } from '../pages/AnimateImagePage.tsx';
import { ChatbotPage } from '../pages/ChatbotPage.tsx';
import { LoginPage } from '../pages/LoginPage.tsx';
import { SettingsPage } from '../pages/SettingsPage.tsx';
import { TimetablePage } from '../pages/TimetablePage.tsx';

const mockUseAuth = vi.fn();
const mockUseAcademicData = vi.fn();

vi.mock('../contexts/AuthContext.tsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../contexts/AcademicDataContext.tsx', () => ({
  useAcademicData: () => mockUseAcademicData(),
}));

vi.mock('../services/firestoreService.ts', () => ({
  createSubject: vi.fn(),
  createTimetableEntry: vi.fn(),
  deleteTimetableEntry: vi.fn(),
  updateTimetableEntry: vi.fn(),
  createChatSession: vi.fn(),
  updateChatSession: vi.fn(),
  deleteChatSession: vi.fn(),
}));

describe('Frontend components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders EmptyState and handles action click', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        icon={Calendar}
        title="No classes yet"
        description="Schedule your weekly lectures."
        actionLabel="Add Class"
        onAction={onAction}
      />
    );

    expect(screen.getByText('No classes yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Class' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders LoginPage with sign-in action and surfaces auth errors', () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle,
      authError: 'Popup blocked by browser.',
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('EduPrep AI')).toBeInTheDocument();
    expect(screen.getByText('Popup blocked by browser.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('renders TimetablePage and blocks overlapping class creation in the UI', () => {
    const today = new Date().getDay();
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', email: 'alex@stanford.edu' },
    });
    mockUseAcademicData.mockReturnValue({
      subjects: [
        {
          id: 'sub-1',
          studentId: 'u1',
          code: 'CS 314',
          title: 'Distributed Systems',
          instructor: 'Prof. M. Rosenblum',
        },
      ],
      timetableEntries: [
        {
          id: 'tt-1',
          studentId: 'u1',
          subjectId: 'sub-1',
          subjectCode: 'CS 314',
          subjectTitle: 'Distributed Systems',
          dayOfWeek: today,
          startTime: '09:00',
          endTime: '10:30',
          room: 'Gates B12',
          instructor: 'Prof. M. Rosenblum',
        },
      ],
      nextUpcomingLecture: null,
    });

    render(
      <MemoryRouter>
        <TimetablePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Academic Timetable' })).toBeInTheDocument();
    expect(screen.getByText(/CS 314 · Distributed Systems/)).toBeInTheDocument();

    // Open Add Class modal (defaults to 09:00 - 10:30 on today, which overlaps tt-1)
    fireEvent.click(screen.getByRole('button', { name: 'Add Class' }));
    fireEvent.change(screen.getByPlaceholderText('Gates Hall B12'), {
      target: { value: 'Sloan 104' },
    });
    const submitButtons = screen.getAllByRole('button', { name: 'Add Class' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    expect(screen.getByText(/Overlaps with Distributed Systems/i)).toBeInTheDocument();
  });

  it('renders SettingsPage with Stitch profile card, all 4 Gemini model cards, and endpoint diagnostics', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', email: 'student@university.edu' },
      profile: {
        uid: 'u1',
        email: 'student@university.edu',
        fullName: 'Divyansh Deore',
        institution: 'Stanford University',
        program: 'B.S. Computer Science',
        academicTerm: 'Fall Semester 2026',
        dailyGoal: 30,
        preferredModel: 'gemini-4-hydrogen',
        themeMode: 'light',
      },
      preferences: {
        studentId: 'u1',
        leadMinutes: 15,
        inAppEnabled: true,
        browserEnabled: false,
        focusStart: '08:00',
        focusEnd: '21:00',
      },
      aiStatus: {
        configured: true,
        defaultModel: 'gemini-4-hydrogen',
        availableModels: [
          { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
          { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
          { id: 'gemini-4-neon', label: 'Gemini 4 Neon' },
          { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon' },
        ],
      },
      saveProfile: vi.fn().mockResolvedValue(undefined),
      savePreferences: vi.fn().mockResolvedValue(undefined),
      setThemeMode: vi.fn(),
    });
    mockUseAcademicData.mockReturnValue({
      subjects: [
        {
          id: 'sub-1',
          studentId: 'u1',
          code: 'CS 314',
          title: 'Distributed Systems',
          instructor: 'Prof. Rosenblum',
          credits: 4,
        },
      ],
      topics: [{ id: 't1', status: 'completed' }],
      timetableEntries: [],
      notes: [],
      summaries: [],
      precaps: [],
      resources: [],
    });

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Student Profile & Settings/i })).toBeInTheDocument();
    expect(screen.getByText('Divyansh Deore')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Academic Identity & Term Settings/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /AI Model & Synthesis Engine/i })).toBeInTheDocument();
    expect(screen.getAllByText(/gemini-4-hydrogen/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/gemini-3\.1-flash-lite/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini-4-neon/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini-4-carbon/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Backend Gateway & Endpoint Diagnostics/i })).toBeInTheDocument();
    expect(screen.getByText(/CS 314 · Distributed Systems/i)).toBeInTheDocument();
  });

  it('renders ChatbotPage with all 4 Gemini models and System Instructions editor', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', email: 'student@university.edu' },
      profile: {
        uid: 'u1',
        preferredModel: 'gemini-4-hydrogen',
      },
      aiStatus: {
        configured: true,
        defaultModel: 'gemini-4-hydrogen',
        availableModels: [],
      },
    });
    mockUseAcademicData.mockReturnValue({
      subjects: [
        {
          id: 'sub-1',
          studentId: 'u1',
          code: 'CS 314',
          title: 'Distributed Systems',
          instructor: 'Prof. Rosenblum',
        },
      ],
      topics: [],
      chatSessions: [],
    });

    render(
      <MemoryRouter>
        <ChatbotPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /AI Academic Chatbot/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /System Instructions/i })).toBeInTheDocument();
    expect(screen.getByText('gemini-4-hydrogen')).toBeInTheDocument();
    expect(screen.getByText('gemini-3.1-flash-lite')).toBeInTheDocument();
    expect(screen.getByText('gemini-4-neon')).toBeInTheDocument();
    expect(screen.getByText('gemini-4-carbon')).toBeInTheDocument();
  });

  it('renders AnimateImagePage with upload control, 16:9 / 9:16 options, and motion prompt input', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', email: 'student@university.edu' },
      aiStatus: {
        configured: true,
        defaultModel: 'gemini-4-hydrogen',
        availableModels: [],
      },
    });

    render(
      <MemoryRouter>
        <AnimateImagePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Animate Image into Video/i })).toBeInTheDocument();
    expect(screen.getByText(/Click to choose a PNG, JPEG, or WebP photo/i)).toBeInTheDocument();
    expect(screen.getByText('16:9 Landscape')).toBeInTheDocument();
    expect(screen.getByText('9:16 Portrait')).toBeInTheDocument();
    expect(screen.getByLabelText(/Motion & Camera Prompt/i)).toBeInTheDocument();
  });
});

