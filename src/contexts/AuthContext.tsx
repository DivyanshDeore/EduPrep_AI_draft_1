import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  getOrCreateNotificationPreferences,
  getOrCreateStudentProfile,
  updateNotificationPreferences,
  updateStudentProfile,
} from '../services/firestoreService.ts';
import { apiClient } from '../services/apiClient.ts';
import {
  AiStatusResponse,
  NotificationPreference,
  StudentProfile,
  ThemeMode,
} from '../types/academic.ts';

interface AuthContextValue {
  user: User | null;
  profile: StudentProfile | null;
  preferences: NotificationPreference | null;
  aiStatus: AiStatusResponse | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (
    updates: Partial<
      Pick<
        StudentProfile,
        'fullName' | 'email' | 'institution' | 'program' | 'academicTerm' | 'dailyGoal' | 'preferredModel' | 'themeMode'
      >
    >
  ) => Promise<void>;
  savePreferences: (
    updates: Partial<Omit<NotificationPreference, 'studentId' | 'updatedAt'>>
  ) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  refreshAiStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyThemeToDocument(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshAiStatus = async () => {
    try {
      const status = await apiClient.getAiStatus();
      setAiStatus(status);
    } catch {
      setAiStatus({
        configured: false,
        defaultModel: 'gemini-4-hydrogen',
        availableModels: [{ id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' }],
      });
    }
  };

  useEffect(() => {
    refreshAiStatus();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthError(null);

      if (!firebaseUser) {
        setProfile(null);
        setPreferences(null);
        setLoading(false);
        return;
      }

      try {
        const [studentProfile, notifPrefs] = await Promise.all([
          getOrCreateStudentProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            fullName: firebaseUser.displayName || 'Student',
            photoUrl: firebaseUser.photoURL || '',
          }),
          getOrCreateNotificationPreferences(firebaseUser.uid),
        ]);
        setProfile(studentProfile);
        setPreferences(notifPrefs);
        applyThemeToDocument(studentProfile.themeMode || 'light');
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Failed to load student profile.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const mode = profile?.themeMode || 'light';
    applyThemeToDocument(mode);

    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeToDocument('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [profile?.themeMode]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in was cancelled or failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const saveProfile: AuthContextValue['saveProfile'] = async (updates) => {
    if (!user) return;
    await updateStudentProfile(user.uid, updates);
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    if (updates.themeMode) {
      applyThemeToDocument(updates.themeMode);
    }
  };

  const savePreferences: AuthContextValue['savePreferences'] = async (updates) => {
    if (!user) return;
    await updateNotificationPreferences(user.uid, updates);
    setPreferences((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const setThemeMode = async (mode: ThemeMode) => {
    applyThemeToDocument(mode);
    if (user) {
      await saveProfile({ themeMode: mode });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        preferences,
        aiStatus,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        saveProfile,
        savePreferences,
        setThemeMode,
        refreshAiStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
