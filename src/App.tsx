import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AcademicDataProvider } from './contexts/AcademicDataContext.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { AnimateImagePage } from './pages/AnimateImagePage.tsx';
import { ChatbotPage } from './pages/ChatbotPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NotesSummariesPage } from './pages/NotesSummariesPage.tsx';
import { PreCapsPage } from './pages/PreCapsPage.tsx';
import { ResourcesPage } from './pages/ResourcesPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { SubjectsTopicsPage } from './pages/SubjectsTopicsPage.tsx';
import { SyllabusPage } from './pages/SyllabusPage.tsx';
import { TimetablePage } from './pages/TimetablePage.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8ff] dark:bg-[#0b0f19] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#7c3aed] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AcademicDataProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="timetable" element={<TimetablePage />} />
                <Route path="precaps" element={<PreCapsPage />} />
                <Route path="syllabus" element={<SyllabusPage />} />
                <Route path="subjects" element={<SubjectsTopicsPage />} />
                <Route path="notes" element={<NotesSummariesPage />} />
                <Route path="resources" element={<ResourcesPage />} />
                <Route path="chat" element={<ChatbotPage />} />
                <Route path="animate" element={<AnimateImagePage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AcademicDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
