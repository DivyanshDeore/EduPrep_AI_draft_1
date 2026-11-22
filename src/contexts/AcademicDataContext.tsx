import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { createNotification } from '../services/firestoreService.ts';
import {
  AppNotification,
  ChatSession,
  LearningResource,
  PreCap,
  StudyNote,
  StudySummary,
  Subject,
  SyllabusRecord,
  TimetableEntry,
  Topic,
} from '../types/academic.ts';
import {
  formatTime12h,
  getNextUpcomingLecture,
  getTodaysClasses,
  UpcomingLecture,
} from '../utils/timetable.ts';
import { useAuth } from './AuthContext.tsx';

interface AcademicDataContextValue {
  subjects: Subject[];
  topics: Topic[];
  syllabi: SyllabusRecord[];
  timetableEntries: TimetableEntry[];
  notifications: AppNotification[];
  precaps: PreCap[];
  notes: StudyNote[];
  summaries: StudySummary[];
  resources: LearningResource[];
  chatSessions: ChatSession[];
  todaysClasses: TimetableEntry[];
  nextUpcomingLecture: UpcomingLecture | null;
  unreadNotificationsCount: number;
  dataLoading: boolean;
}

const AcademicDataContext = createContext<AcademicDataContextValue | null>(null);

function toMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function AcademicDataProvider({ children }: { children: React.ReactNode }) {
  const { user, preferences } = useAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [syllabi, setSyllabi] = useState<SyllabusRecord[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [precaps, setPrecaps] = useState<PreCap[]>([]);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [summaries, setSummaries] = useState<StudySummary[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [clockTick, setClockTick] = useState(() => Date.now());

  const notifiedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      setSubjects([]);
      setTopics([]);
      setSyllabi([]);
      setTimetableEntries([]);
      setNotifications([]);
      setPrecaps([]);
      setNotes([]);
      setSummaries([]);
      setResources([]);
      setChatSessions([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    const uid = user.uid;
    let pendingInitial = 10;
    const markLoaded = () => {
      pendingInitial = Math.max(0, pendingInitial - 1);
      if (pendingInitial === 0) setDataLoading(false);
    };

    const subscribeCol = <T extends { id: string }>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      sortFn?: (a: T, b: T) => number
    ) => {
      const q = query(collection(db, colName), where('studentId', '==', uid));
      return onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
          if (sortFn) items.sort(sortFn);
          setter(items);
          markLoaded();
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, colName);
        }
      );
    };

    const unsubs = [
      subscribeCol<Subject>('subjects', setSubjects, (a, b) => a.code.localeCompare(b.code)),
      subscribeCol<Topic>('topics', setTopics, (a, b) => a.orderIndex - b.orderIndex),
      subscribeCol<SyllabusRecord>('syllabi', setSyllabi, (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
      subscribeCol<TimetableEntry>('timetableEntries', setTimetableEntries),
      subscribeCol<AppNotification>('notifications', setNotifications, (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
      subscribeCol<PreCap>('precaps', setPrecaps, (a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)),
      subscribeCol<StudyNote>('notes', setNotes, (a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)),
      subscribeCol<StudySummary>('summaries', setSummaries, (a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)),
      subscribeCol<LearningResource>('resources', setResources, (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
      subscribeCol<ChatSession>('chatSessions', setChatSessions, (a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user]);

  useEffect(() => {
    notifiedKeysRef.current = new Set(notifications.map((n) => n.occurrenceKey));
  }, [notifications]);

  const now = useMemo(() => new Date(clockTick), [clockTick]);

  const todaysClasses = useMemo(
    () => getTodaysClasses(timetableEntries, now),
    [timetableEntries, now]
  );

  const nextUpcomingLecture = useMemo(
    () => getNextUpcomingLecture(timetableEntries, now),
    [timetableEntries, now]
  );

  // Smart class reminder scheduler (active while workspace is open)
  useEffect(() => {
    if (!user || !preferences || !preferences.inAppEnabled || !nextUpcomingLecture) {
      return;
    }

    const { entry, minutesUntilStart, startsAtDate } = nextUpcomingLecture;
    if (minutesUntilStart > preferences.leadMinutes || minutesUntilStart < 0) {
      return;
    }

    const dateStr = startsAtDate.toISOString().slice(0, 10);
    const occurrenceKey = `${entry.id}_${dateStr}_${entry.startTime}`;

    if (notifiedKeysRef.current.has(occurrenceKey)) {
      return;
    }

    notifiedKeysRef.current.add(occurrenceKey);
    const formattedTime = `${formatTime12h(entry.startTime)} – ${formatTime12h(entry.endTime)}`;
    const title = `Upcoming Lecture: ${entry.subjectTitle}`;
    const message = `Starts in ${minutesUntilStart} minute${minutesUntilStart === 1 ? '' : 's'} (${formattedTime}) in ${entry.room}.`;

    createNotification(user.uid, {
      timetableEntryId: entry.id,
      subjectId: entry.subjectId,
      subjectTitle: entry.subjectTitle,
      classTime: formattedTime,
      room: entry.room,
      title,
      message,
      occurrenceKey,
      isRead: false,
    }).catch(() => {
      notifiedKeysRef.current.delete(occurrenceKey);
    });

    if (
      preferences.browserEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(title, { body: message });
      } catch {
        // Ignore browser notification restrictions inside sandboxed iframes
      }
    }
  }, [user, preferences, nextUpcomingLecture]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  return (
    <AcademicDataContext.Provider
      value={{
        subjects,
        topics,
        syllabi,
        timetableEntries,
        notifications,
        precaps,
        notes,
        summaries,
        resources,
        chatSessions,
        todaysClasses,
        nextUpcomingLecture,
        unreadNotificationsCount,
        dataLoading,
      }}
    >
      {children}
    </AcademicDataContext.Provider>
  );
}

export function useAcademicData() {
  const ctx = useContext(AcademicDataContext);
  if (!ctx) throw new Error('useAcademicData must be used inside AcademicDataProvider');
  return ctx;
}
