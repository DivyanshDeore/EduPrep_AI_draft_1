import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Check,
  Clock,
  LogOut,
  Menu,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useAcademicData } from '../contexts/AcademicDataContext.tsx';
import { deleteNotification, markNotificationRead } from '../services/firestoreService.ts';
import { Modal } from './Modal.tsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/timetable', label: 'Academic Timetable' },
  { to: '/precaps', label: 'AI Pre-caps' },
  { to: '/syllabus', label: 'Syllabus Ingestion' },
  { to: '/subjects', label: 'Subjects & Topics' },
  { to: '/notes', label: 'AI Study Notes' },
  { to: '/resources', label: 'Resources Hub' },
  { to: '/chat', label: 'AI Chatbot' },
  { to: '/animate', label: 'Video Studio' },
];

export function AppShell() {
  const { profile, aiStatus, signOut, setThemeMode } = useAuth();
  const {
    subjects,
    topics,
    notes,
    precaps,
    notifications,
    unreadNotificationsCount,
  } = useAcademicData();

  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const items: { id: string; category: string; title: string; subtitle: string; to: string }[] = [];

    for (const s of subjects) {
      if (s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) {
        items.push({
          id: `sub_${s.id}`,
          category: 'Subject',
          title: `${s.code} · ${s.title}`,
          subtitle: s.instructor || 'Course',
          to: '/subjects',
        });
      }
    }
    for (const t of topics) {
      if (t.title.toLowerCase().includes(q)) {
        items.push({
          id: `top_${t.id}`,
          category: 'Topic',
          title: t.title,
          subtitle: `Topic #${t.orderIndex} · ${t.status}`,
          to: '/subjects',
        });
      }
    }
    for (const n of notes) {
      if (n.title.toLowerCase().includes(q) || n.topicTitle.toLowerCase().includes(q)) {
        items.push({
          id: `note_${n.id}`,
          category: 'Note',
          title: n.title,
          subtitle: n.subjectTitle,
          to: '/notes',
        });
      }
    }
    for (const p of precaps) {
      if (p.topicTitle.toLowerCase().includes(q) || p.subjectTitle.toLowerCase().includes(q)) {
        items.push({
          id: `pre_${p.id}`,
          category: 'Pre-Cap',
          title: p.topicTitle,
          subtitle: p.subjectTitle,
          to: '/precaps',
        });
      }
    }
    return items.slice(0, 12);
  }, [searchQuery, subjects, topics, notes, precaps]);

  const isDark =
    profile?.themeMode === 'dark' ||
    (profile?.themeMode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const initials = (profile?.fullName || 'S')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(unread.map((n) => markNotificationRead(n.id)));
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-[#0b0f19] text-[#131b2e] dark:text-slate-100 flex">
      {/* Desktop Sidebar (288px / w-72 matching Stitch layout) */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-[0_1px_8px_rgba(0,0,0,0.04)] dark:border-r dark:border-slate-800 flex-col justify-between z-40">
        <div className="flex flex-col">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#7c3aed] flex items-center justify-center text-white shadow-sm shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-base font-bold tracking-tight text-[#131b2e] dark:text-white whitespace-nowrap leading-tight">
                  EduPrep AI
                </span>
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#630ed4] dark:text-violet-400 leading-tight">
                  Academic Workspace
                </span>
              </div>
            </div>

            <div className="mt-4 px-3 py-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800/80 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#4a4455] dark:text-slate-300 truncate">
                {profile?.academicTerm || 'Current Academic Term'}
              </span>
              <Clock className="w-4 h-4 text-[#7b7487] dark:text-slate-400 shrink-0" />
            </div>
          </div>

          <nav className="px-4 py-1 flex flex-col gap-1" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center px-4 py-2.5 rounded-lg text-[14px] transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#7c3aed] text-white font-semibold shadow-sm'
                      : 'text-[#4a4455] dark:text-slate-300 font-medium hover:bg-[#eaedff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white'
                  }`
                }
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="px-3.5 py-2.5 rounded-lg bg-[#f2f3ff] dark:bg-slate-800/80 flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-[#4a4455] dark:text-slate-300">
              AI Synthesis Engine
            </span>
            <span
              className={`text-[11px] font-bold ${
                aiStatus?.configured
                  ? 'text-[#005b3d] dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {aiStatus?.configured ? 'Ready' : 'Setup Needed'}
            </span>
          </div>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center px-4 py-2 rounded-lg text-[13px] transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#7c3aed] text-white font-semibold shadow-sm'
                  : 'text-[#4a4455] dark:text-slate-300 font-medium hover:bg-[#eaedff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white'
              }`
            }
          >
            <span>Settings &amp; Student Profile</span>
          </NavLink>

          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-[#4a4455] dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 transition-colors whitespace-nowrap text-left"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col justify-between shadow-xl z-10">
            <div>
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#7c3aed] flex items-center justify-center text-white">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-display text-sm font-bold text-[#131b2e] dark:text-white">
                      EduPrep AI
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
                      Academic Workspace
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation"
                  className="p-2 rounded-lg text-slate-500 hover:bg-[#f2f3ff] dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="p-3 flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                        isActive
                          ? 'bg-[#7c3aed] text-white font-semibold'
                          : 'text-[#4a4455] dark:text-slate-300 hover:bg-[#eaedff] dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <span>{item.label}</span>
                  </NavLink>
                ))}
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    `flex items-center px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-[#7c3aed] text-white font-semibold'
                        : 'text-[#4a4455] dark:text-slate-300 hover:bg-[#eaedff] dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <span>Settings &amp; Student Profile</span>
                </NavLink>
              </nav>
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => signOut()}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Top Glass Header */}
        <header className="sticky top-0 z-30 h-16 bg-[#faf8ff]/85 dark:bg-[#0b0f19]/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] dark:border-b dark:border-slate-800/80 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden w-10 h-10 rounded-xl bg-white dark:bg-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex items-center justify-center text-[#131b2e] dark:text-slate-200 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex-1 max-w-xl h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:border dark:border-slate-800 flex items-center justify-between gap-3 text-[13px] text-[#7b7487] dark:text-slate-400 hover:ring-2 hover:ring-[#7c3aed]/25 transition-all"
            >
              <span className="flex items-center gap-2.5 truncate">
                <Search className="w-4 h-4 shrink-0 text-[#7b7487]" />
                <span className="truncate">Search lectures, syllabi, notes, concepts...</span>
              </span>
              <kbd className="hidden sm:inline-block font-mono text-[11px] font-semibold bg-[#e2e7ff] dark:bg-slate-800 text-[#4a4455] dark:text-slate-300 px-1.5 py-0.5 rounded shadow-xs">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:border dark:border-slate-800 flex items-center justify-center text-[#4a4455] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Circular Notification Bell + Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                aria-label="Notifications"
                className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:border dark:border-slate-800 flex items-center justify-center text-[#4a4455] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#630ed4] text-white text-[10px] font-bold flex items-center justify-center tabular-nums ring-2 ring-[#faf8ff] dark:ring-[#0b0f19]">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-[#131b2e] dark:text-slate-100">
                      Class Notifications
                    </span>
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 hover:underline whitespace-nowrap"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[#4a4455] dark:text-slate-400">
                        No class reminders yet. Upcoming lectures will trigger reminders based on your lead-time preference.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 flex items-start justify-between gap-3 ${
                            n.isRead
                              ? 'bg-white dark:bg-slate-900'
                              : 'bg-[#f2f3ff]/70 dark:bg-violet-950/20'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#131b2e] dark:text-slate-100 truncate">
                              {n.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                              {n.message}
                            </p>
                            <p className="mt-1 text-[11px] text-[#7b7487] dark:text-slate-500">
                              {n.classTime} {n.room ? `· ${n.room}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!n.isRead && (
                              <button
                                type="button"
                                onClick={() => markNotificationRead(n.id)}
                                title="Mark as read"
                                className="p-1.5 rounded-md text-[#005b3d] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteNotification(n.id)}
                              title="Delete notification"
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Cluster */}
            <NavLink
              to="/settings"
              className="flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-colors group"
            >
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.fullName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#630ed4] text-white text-xs font-bold flex items-center justify-center shadow-xs">
                  {initials}
                </div>
              )}
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-[13px] font-semibold text-[#131b2e] dark:text-slate-100 max-w-[140px] truncate group-hover:text-[#630ed4] dark:group-hover:text-violet-400 transition-colors">
                  {profile?.fullName || 'Student'}
                </span>
                <span className="text-[11px] text-[#4a4455] dark:text-slate-400 max-w-[140px] truncate">
                  {profile?.institution || profile?.program || 'Academic Profile'}
                </span>
              </div>
              <SlidersHorizontal className="hidden md:block w-4 h-4 text-[#7b7487] group-hover:text-[#131b2e] dark:group-hover:text-white transition-colors" />
            </NavLink>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Command Search Modal */}
      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Search Workspace"
        subtitle="Jump directly to subjects, topics, study notes, or lecture pre-caps."
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a course code, topic name, or note title..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 border border-[#ccc3d8]/50 dark:border-slate-700 text-sm text-[#131b2e] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
            />
          </div>

          {searchQuery.trim() === '' ? (
            <p className="text-xs text-[#4a4455] dark:text-slate-400">
              Start typing to search across {subjects.length} subjects, {topics.length} topics, {notes.length} notes, and {precaps.length} pre-caps.
            </p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-[#4a4455] dark:text-slate-400 py-4 text-center">
              No matching academic items found for &ldquo;{searchQuery}&rdquo;.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                    navigate(item.to);
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#f2f3ff] dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-semibold text-[#131b2e] dark:text-slate-100 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-[#4a4455] dark:text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 whitespace-nowrap shrink-0">
                    {item.category}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
