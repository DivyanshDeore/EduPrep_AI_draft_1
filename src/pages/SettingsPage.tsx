import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  FileText,
  GraduationCap,
  History,
  Lock,
  Monitor,
  Moon,
  Play,
  Save,
  Shield,
  Sliders,
  Sun,
  Terminal,
  Timer,
} from 'lucide-react';
import { useAcademicData } from '../contexts/AcademicDataContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { ThemeMode } from '../types/academic.ts';

interface ApiEndpointInfo {
  method: 'GET' | 'POST';
  path: string;
  label: string;
  description: string;
  sampleResponse: Record<string, unknown>;
}

const API_ENDPOINTS: ApiEndpointInfo[] = [
  {
    method: 'GET',
    path: '/api/health',
    label: 'Server & AI Health Check',
    description: 'Service liveness and default Gemini model',
    sampleResponse: {
      status: 'ok',
      service: 'EduPrep AI',
      aiConfigured: true,
      defaultModel: 'gemini-4-hydrogen',
    },
  },
  {
    method: 'GET',
    path: '/api/ai/status',
    label: 'AI Configuration Status',
    description: 'Available Gemini 4, Flash Lite, and Omni Video models',
    sampleResponse: {
      configured: true,
      defaultModel: 'gemini-4-hydrogen',
      availableModels: [
        'gemini-4-hydrogen',
        'gemini-3.1-flash-lite',
        'gemini-4-neon',
        'gemini-4-carbon',
      ],
      videoModels: ['gemini-omni-1.2-flash'],
    },
  },
  {
    method: 'POST',
    path: '/api/syllabus/parse',
    label: 'Syllabus Ingestion & Extraction',
    description: 'PDF, DOCX, TXT extraction & topic structuring',
    sampleResponse: {
      fileType: 'pdf',
      structured: { subjectCode: 'CS 314', topicCount: 12 },
    },
  },
  {
    method: 'POST',
    path: '/api/ai/precap',
    label: 'Lecture Pre-Cap Synthesis',
    description: 'Concepts, definitions, prerequisites & guiding questions',
    sampleResponse: {
      aiAssisted: true,
      modelUsed: 'gemini-4-hydrogen',
      sections: ['introduction', 'concepts', 'definitions', 'prerequisites', 'questions'],
    },
  },
  {
    method: 'POST',
    path: '/api/ai/notes',
    label: 'Structured Study Notes',
    description: '7-section academic study notes generator',
    sampleResponse: {
      aiAssisted: true,
      sections: 7,
      keyDefinitions: 5,
    },
  },
  {
    method: 'POST',
    path: '/api/ai/resources',
    label: 'Grounded Learning Resources',
    description: 'Google Search grounding for verified web links',
    sampleResponse: {
      grounded: true,
      sources: ['youtube.com', 'ocw.mit.edu'],
    },
  },
  {
    method: 'POST',
    path: '/api/ai/chat',
    label: 'Multi-Turn Academic Chatbot',
    description: 'System instructions & stateful multi-turn reasoning',
    sampleResponse: {
      modelUsed: 'gemini-4-carbon',
      reply: 'Here is a step-by-step derivation...',
    },
  },
  {
    method: 'POST',
    path: '/api/ai/animate-video',
    label: 'Image-to-Video Animation',
    description: 'Gemini Omni 1.2 Flash 16:9 / 9:16 video synthesis',
    sampleResponse: {
      modelUsed: 'gemini-omni-1.2-flash',
      aspectRatio: '16:9',
      mimeType: 'video/mp4',
    },
  },
];

export function SettingsPage() {
  const { profile, preferences, aiStatus, saveProfile, savePreferences, setThemeMode } =
    useAuth();
  const {
    subjects,
    topics,
    timetableEntries,
    notes,
    summaries,
    precaps,
    resources,
  } = useAcademicData();

  const nameInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [institution, setInstitution] = useState(profile?.institution || '');
  const [program, setProgram] = useState(profile?.program || '');
  const [academicTerm, setAcademicTerm] = useState(profile?.academicTerm || '');
  const [dailyGoal, setDailyGoal] = useState(profile?.dailyGoal || 25);
  const [preferredModel, setPreferredModel] = useState(
    profile?.preferredModel || aiStatus?.defaultModel || 'gemini-4-hydrogen'
  );

  const [leadMinutes, setLeadMinutes] = useState(preferences?.leadMinutes || 15);
  const [inAppEnabled, setInAppEnabled] = useState(preferences?.inAppEnabled ?? true);
  const [browserEnabled, setBrowserEnabled] = useState(preferences?.browserEnabled ?? false);
  const [focusStart, setFocusStart] = useState(preferences?.focusStart || '08:00');
  const [focusEnd, setFocusEnd] = useState(preferences?.focusEnd || '21:00');

  const [activeNav, setActiveNav] = useState<string>('academic-identity');
  const [selectedEndpointIdx, setSelectedEndpointIdx] = useState<number>(0);
  const [liveProbeResult, setLiveProbeResult] = useState<{
    status: number;
    latencyMs: number;
    payload: unknown;
  } | null>(null);
  const [probing, setProbing] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const [browserPerm, setBrowserPerm] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setEmail(profile.email || '');
      setInstitution(profile.institution || '');
      setProgram(profile.program || '');
      setAcademicTerm(profile.academicTerm || '');
      setDailyGoal(profile.dailyGoal || 25);
      setPreferredModel(profile.preferredModel || 'gemini-4-hydrogen');
    }
  }, [profile]);

  useEffect(() => {
    if (preferences) {
      setLeadMinutes(preferences.leadMinutes);
      setInAppEnabled(preferences.inAppEnabled);
      setBrowserEnabled(preferences.browserEnabled);
      setFocusStart(preferences.focusStart || '08:00');
      setFocusEnd(preferences.focusEnd || '21:00');
    }
  }, [preferences]);

  const completedTopics = useMemo(
    () => topics.filter((t) => t.status === 'completed').length,
    [topics]
  );

  const masteryPct = useMemo(() => {
    if (topics.length === 0) return 0;
    return Math.round((completedTopics / topics.length) * 100);
  }, [completedTopics, topics.length]);

  const handleRevertChanges = () => {
    if (profile) {
      setFullName(profile.fullName || '');
      setEmail(profile.email || '');
      setInstitution(profile.institution || '');
      setProgram(profile.program || '');
      setAcademicTerm(profile.academicTerm || '');
      setDailyGoal(profile.dailyGoal || 25);
      setPreferredModel(profile.preferredModel || 'gemini-4-hydrogen');
    }
    if (preferences) {
      setLeadMinutes(preferences.leadMinutes);
      setInAppEnabled(preferences.inAppEnabled);
      setBrowserEnabled(preferences.browserEnabled);
      setFocusStart(preferences.focusStart || '08:00');
      setFocusEnd(preferences.focusEnd || '21:00');
    }
    setErrorMsg(null);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setErrorMsg('Full name and email are required.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSavedBanner(false);
    try {
      await Promise.all([
        saveProfile({
          fullName: fullName.trim(),
          email: email.trim(),
          institution: institution.trim(),
          program: program.trim(),
          academicTerm: academicTerm.trim(),
          dailyGoal: Number(dailyGoal) || 25,
          preferredModel,
        }),
        savePreferences({
          leadMinutes: Number(leadMinutes) || 15,
          inAppEnabled,
          browserEnabled,
          focusStart,
          focusEnd,
        }),
      ]);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleProbeHealth = async (endpointPath = '/api/health') => {
    setProbing(true);
    const start = performance.now();
    try {
      const target = endpointPath === '/api/ai/status' ? '/api/ai/status' : '/api/health';
      const resp = await fetch(target);
      const payload = await resp.json().catch(() => ({}));
      const latencyMs = Math.round(performance.now() - start);
      setLiveProbeResult({
        status: resp.status,
        latencyMs,
        payload,
      });
    } catch (err) {
      setLiveProbeResult({
        status: 503,
        latencyMs: Math.round(performance.now() - start),
        payload: { error: err instanceof Error ? err.message : 'Network error' },
      });
    } finally {
      setProbing(false);
    }
  };

  const handleCopyPayload = () => {
    const active = API_ENDPOINTS[selectedEndpointIdx];
    const dataToCopy =
      selectedEndpointIdx <= 1 && liveProbeResult
        ? liveProbeResult.payload
        : active.sampleResponse;
    navigator.clipboard?.writeText(JSON.stringify(dataToCopy, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 1800);
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPerm('unsupported');
      return;
    }
    const perm = await Notification.requestPermission();
    setBrowserPerm(perm);
    if (perm === 'granted') {
      setBrowserEnabled(true);
    }
  };

  const handleExportNotesMarkdown = () => {
    const md = notes
      .map(
        (n) =>
          `# ${n.title}\n_${n.subjectTitle} · ${n.topicTitle}_\n\n## Introduction\n${n.introduction}\n\n## Important Concepts\n${n.importantConcepts
            .map((c) => `- ${c}`)
            .join('\n')}\n\n## Detailed Explanations\n${n.detailedExplanations}\n\n## Conclusion\n${n.conclusion}\n\n---\n`
      )
      .join('\n');
    const blob = new Blob([md || '# EduPrep AI Notes\n\nNo study notes saved yet.\n'], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eduprep-study-notes-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      preferences,
      subjects,
      topics,
      timetableEntries,
      precaps,
      notes,
      summaries,
      resources,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eduprep-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const initials = (fullName || 'S')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const activeEndpoint = API_ENDPOINTS[selectedEndpointIdx];
  const inspectedJson =
    selectedEndpointIdx <= 1 && liveProbeResult
      ? liveProbeResult.payload
      : activeEndpoint.sampleResponse;

  return (
    <form onSubmit={handleSaveAll} className="space-y-6">
      {/* Top Context Header & Sticky Action Bar (Stitch layout) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl workspace-card px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7b7487] dark:text-slate-400">
            <span>Academic Intelligence</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>System &amp; Account</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#630ed4] dark:text-violet-400">
              Student Profile &amp; Settings
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-0.5">
            <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
              Student Profile &amp; Settings
            </h1>
            <span className="text-xs font-medium text-[#005b3d] dark:text-emerald-400">
              · {profile?.academicTerm || 'Active Workspace'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRevertChanges}
            className="px-4 py-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-[#131b2e] dark:text-slate-200 text-[13px] font-medium hover:bg-[#eaedff] dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <History className="w-4 h-4" />
            <span>Revert Changes</span>
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-[#7c3aed] text-white text-[13px] font-semibold hover:bg-[#6d28d9] active:scale-[0.98] disabled:opacity-60 transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#ffdad6] dark:bg-rose-950/40 text-[#93000a] dark:text-rose-200 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {savedBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm text-[#005b3d] dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Profile and notification preferences saved.</span>
        </div>
      )}

      {/* Main 2-Column Desktop Grid matching Stitch code_14087c4f.html */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (~33%): Profile Identity Card + Vertical Menu + Progress Micro-Widget */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-20">
          {/* Student Profile Identity Card */}
          <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-6 workspace-card relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-36 h-36 bg-gradient-to-br from-[#630ed4]/10 via-[#7c3aed]/5 to-transparent rounded-full pointer-events-none blur-xl" />

            <div className="flex items-start gap-4 relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-[#e2e7ff] dark:bg-slate-800 overflow-hidden shadow-sm flex items-center justify-center shrink-0">
                {profile?.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={fullName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-2xl font-bold text-[#630ed4] dark:text-violet-400">
                    {initials}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display text-base font-bold text-[#131b2e] dark:text-white truncate">
                    {fullName || 'Student'}
                  </h2>
                  <CheckCircle2
                    className="w-4 h-4 text-[#630ed4] dark:text-violet-400 shrink-0"
                    aria-label="Verified Google account"
                  />
                </div>
                <p className="text-[13px] font-medium text-[#4a4455] dark:text-slate-300 truncate">
                  {institution || 'Add your university'}
                </p>
                <p className="text-[12px] text-[#7b7487] dark:text-slate-400 truncate">
                  {program || email}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                  <span className="text-[#630ed4] dark:text-violet-400 tabular-nums">
                    {subjects.length} Subjects
                  </span>
                  <span className="text-[#7b7487]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-[#005b3d] dark:text-emerald-400 tabular-nums">
                    {notes.length} Notes
                  </span>
                </div>
              </div>
            </div>

            {/* Academic Pulse Bar */}
            <div className="mt-5 bg-[#f2f3ff]/80 dark:bg-slate-800/70 -mx-6 -mb-6 px-6 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold text-[#4a4455] dark:text-slate-400">
                  Active Academic Term
                </span>
                <span className="block text-[13px] font-semibold text-[#131b2e] dark:text-slate-100 truncate">
                  {academicTerm || 'Current Term'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveNav('academic-identity');
                  nameInputRef.current?.focus();
                  nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-[11px] font-semibold text-[#630ed4] dark:text-violet-400 hover:bg-[#eaedff] dark:hover:bg-slate-800 transition-colors shadow-xs shrink-0"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Vertical Settings Nav Menu */}
          <nav
            className="w-full bg-white dark:bg-slate-900 rounded-xl p-2 workspace-card flex flex-col gap-1"
            aria-label="Settings sections"
          >
            {[
              {
                id: 'academic-identity',
                label: 'Academic Identity & Courses',
                icon: GraduationCap,
                trailing: 'arrow',
              },
              {
                id: 'ai-engine',
                label: 'AI Model & Synthesis Engine',
                icon: Cpu,
                meta:
                  preferredModel === 'gemini-3.1-flash-lite'
                    ? 'Flash Lite'
                    : preferredModel === 'gemini-4-carbon'
                    ? 'Carbon'
                    : preferredModel === 'gemini-4-neon'
                    ? 'Neon'
                    : 'Hydrogen',
              },
              {
                id: 'notifications',
                label: 'Notifications & Pre-cap Alerts',
                icon: Bell,
                meta: inAppEnabled ? 'Enabled' : 'Muted',
              },
              {
                id: 'api-endpoints',
                label: 'Backend Gateway & Endpoints',
                icon: Terminal,
                meta: aiStatus?.configured ? 'AI Ready' : 'Setup',
              },
              {
                id: 'spaced-repetition',
                label: 'Study Habits & Appearance',
                icon: Sliders,
                meta: `${dailyGoal}m/day`,
              },
              {
                id: 'data-export',
                label: 'Security & Data Export',
                icon: Shield,
                trailing: 'lock',
              },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = activeNav === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveNav(item.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[13px] transition-all group ${
                    isSelected
                      ? 'bg-[#7c3aed] text-white font-semibold shadow-sm'
                      : 'text-[#4a4455] dark:text-slate-300 font-medium hover:bg-[#eaedff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-white' : 'text-[#7b7487] dark:text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.trailing === 'arrow' ? (
                    <ArrowRight className="w-4 h-4 shrink-0 opacity-85 group-hover:translate-x-0.5 transition-transform" />
                  ) : item.trailing === 'lock' ? (
                    <Lock
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-white' : 'text-[#7b7487]'
                      }`}
                    />
                  ) : (
                    <span
                      className={`text-[11px] font-semibold shrink-0 ml-2 ${
                        isSelected
                          ? 'text-white/90'
                          : 'text-[#630ed4] dark:text-violet-400'
                      }`}
                    >
                      {item.meta}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>

          {/* Academic Progress Micro-Widget (Real Firestore Data) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 workspace-card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                Syllabus Progress
              </span>
              <span className="text-[11px] font-bold text-[#005b3d] dark:text-emerald-400 tabular-nums">
                {masteryPct}% MASTERED
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#4a4455] dark:text-slate-400">Completed Topics</span>
              <span className="font-semibold text-[#131b2e] dark:text-slate-100 tabular-nums">
                {completedTopics} / {topics.length} topics
              </span>
            </div>
            <div className="w-full bg-[#eaedff] dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#7c3aed] h-full rounded-full transition-all"
                style={{ width: `${masteryPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#7b7487] dark:text-slate-400 pt-1 tabular-nums">
              <span>{timetableEntries.length} scheduled classes</span>
              <span>{precaps.length} pre-caps</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (~67%): Modules 01 - 05 */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          {/* SECTION 1: Academic Identity & Term Settings */}
          <section
            id="academic-identity"
            className="w-full bg-white dark:bg-slate-900 rounded-xl p-6 workspace-card flex flex-col gap-5"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
                  Profile Module 01
                </span>
                <h2 className="font-display text-xl font-bold text-[#131b2e] dark:text-white">
                  Academic Identity &amp; Term Settings
                </h2>
                <p className="text-[13px] text-[#4a4455] dark:text-slate-400">
                  Personal profile, university enrollment details, and active tracked semester courses.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#005b3d] dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Google Account Verified
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#f2f3ff] dark:bg-slate-800/70 p-4 rounded-lg flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                  Full Name
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-900 border border-[#ccc3d8]/50 dark:border-slate-700 text-sm font-medium text-[#131b2e] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                />
              </div>
              <div className="bg-[#f2f3ff] dark:bg-slate-800/70 p-4 rounded-lg flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-900 border border-[#ccc3d8]/50 dark:border-slate-700 text-sm font-medium text-[#131b2e] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                />
              </div>
              <div className="bg-[#f2f3ff] dark:bg-slate-800/70 p-4 rounded-lg flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                  Enrolled Institution
                </label>
                <input
                  type="text"
                  placeholder="e.g., Stanford University"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-900 border border-[#ccc3d8]/50 dark:border-slate-700 text-sm font-medium text-[#131b2e] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                />
              </div>
              <div className="bg-[#f2f3ff] dark:bg-slate-800/70 p-4 rounded-lg flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                  Program &amp; Academic Term
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="B.S. Computer Science"
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-900 border border-[#ccc3d8]/50 dark:border-slate-700 text-sm font-medium text-[#131b2e] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                  />
                  <input
                    type="text"
                    placeholder="Fall Semester 2026"
                    value={academicTerm}
                    onChange={(e) => setAcademicTerm(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-900 border border-[#ccc3d8]/50 dark:border-slate-700 text-sm font-medium text-[#131b2e] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                  />
                </div>
              </div>
            </div>

            {/* Active Tracked Courses Matrix (Real Subjects from Firestore) */}
            <div className="flex flex-col gap-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#4a4455] dark:text-slate-300">
                  Active Tracked Courses ({subjects.length})
                </span>
                <Link
                  to="/subjects"
                  className="text-[11px] font-semibold text-[#630ed4] dark:text-violet-400 hover:underline"
                >
                  Manage Subjects &amp; Topics
                </Link>
              </div>

              {subjects.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#f2f3ff] dark:bg-slate-800/60 text-xs text-[#4a4455] dark:text-slate-400 flex items-center justify-between gap-3">
                  <span>No courses added yet. Upload a syllabus or add subjects to track them here.</span>
                  <Link
                    to="/syllabus"
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-[#630ed4] dark:text-violet-400 font-semibold shadow-xs whitespace-nowrap"
                  >
                    Upload Syllabus
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {subjects.map((sub) => {
                    const codeDigits = sub.code.replace(/[^0-9]/g, '') || sub.code.slice(0, 4);
                    const subTopicCount = topics.filter((t) => t.subjectId === sub.id).length;
                    return (
                      <Link
                        key={sub.id}
                        to="/subjects"
                        className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-[#f2f3ff] dark:hover:bg-slate-800/70 rounded-lg transition-colors shadow-xs"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#e2e7ff] dark:bg-slate-800 flex items-center justify-center font-display text-sm font-bold text-[#630ed4] dark:text-violet-400 shrink-0 tabular-nums">
                            {codeDigits}
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-sm font-semibold text-[#131b2e] dark:text-slate-100 truncate">
                              {sub.code} · {sub.title}
                            </p>
                            <p className="text-xs text-[#7b7487] dark:text-slate-400 truncate">
                              {sub.instructor || 'Instructor unset'} · {subTopicCount} syllabus topics
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 tabular-nums shrink-0 ml-3">
                          {sub.credits ?? 3} Credits
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 2: AI Model & Cognitive Synthesis Engine */}
          <section
            id="ai-engine"
            className="w-full bg-white dark:bg-slate-900 rounded-xl p-6 workspace-card flex flex-col gap-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
                  Synthesis Control 02
                </span>
                <h2 className="font-display text-xl font-bold text-[#131b2e] dark:text-white">
                  AI Model &amp; Synthesis Engine
                </h2>
                <p className="text-[13px] text-[#4a4455] dark:text-slate-400">
                  Select the Gemini model used for structured study notes, summaries, syllabus parsing, and lecture pre-caps.
                </p>
              </div>
              <Cpu className="w-6 h-6 text-[#630ed4] dark:text-violet-400 shrink-0" />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                Primary Academic Synthesis Model
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(
                  aiStatus?.availableModels && aiStatus.availableModels.length >= 4
                    ? aiStatus.availableModels
                    : [
                        {
                          id: 'gemini-4-hydrogen',
                          label: 'Gemini 4 Hydrogen',
                          subtitle: 'General Tasks · Fast & Balanced',
                          description:
                            'Recommended default for detailed study notes, summaries, and lecture pre-caps.',
                          tier: 'standard' as const,
                        },
                        {
                          id: 'gemini-3.1-flash-lite',
                          label: 'Gemini 3.1 Flash Lite',
                          subtitle: 'Fast Tasks · Ultra Low Latency',
                          description:
                            'High-speed model for rapid syllabus parsing, quick Q&A, and concise recaps.',
                          tier: 'standard' as const,
                        },
                        {
                          id: 'gemini-4-neon',
                          label: 'Gemini 4 Neon',
                          subtitle: 'Complex Interactive Tasks',
                          description:
                            'Multi-step interactive tutoring, coding walkthroughs, and complex synthesis.',
                          tier: 'paid' as const,
                        },
                        {
                          id: 'gemini-4-carbon',
                          label: 'Gemini 4 Carbon',
                          subtitle: 'Deep Reasoning Tasks',
                          description:
                            'Flagship reasoning engine for rigorous proofs, algorithms, and deep analysis.',
                          tier: 'paid' as const,
                        },
                      ]
                ).map((m) => {
                  const selected = preferredModel === m.id;
                  const isRecommended = m.id === 'gemini-4-hydrogen';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPreferredModel(m.id)}
                      className={`flex flex-col p-4 rounded-xl text-left transition-all ${
                        selected
                          ? 'bg-[#e2e7ff]/60 dark:bg-violet-950/35 ring-1 ring-[#7c3aed]/40 shadow-xs'
                          : 'bg-[#f2f3ff] dark:bg-slate-800/70 hover:bg-[#eaedff] dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="font-display text-sm font-bold text-[#131b2e] dark:text-white">
                          {m.label}
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            selected
                              ? 'bg-[#7c3aed] text-white'
                              : 'bg-[#dae2fd] dark:bg-slate-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold uppercase text-[#630ed4] dark:text-violet-400 mb-1">
                        {m.subtitle || 'Gemini Academic Engine'}
                      </span>
                      <p className="text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                        {m.description || 'Optimized for structured academic study workflows.'}
                      </p>
                      <div className="mt-3 pt-2 w-full flex items-center justify-between text-[11px] font-mono text-[#7b7487] dark:text-slate-400">
                        <span>{m.id}</span>
                        {isRecommended ? (
                          <span className="font-sans font-semibold text-[#630ed4] dark:text-violet-400">
                            Recommended
                          </span>
                        ) : m.tier === 'paid' ? (
                          <span className="font-sans font-semibold text-amber-700 dark:text-amber-400">
                            Paid Key
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 3: Backend Gateway & Live Endpoint Diagnostics */}
          <section
            id="api-endpoints"
            className="w-full bg-white dark:bg-slate-900 rounded-xl p-6 workspace-card flex flex-col gap-5"
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
                  Infrastructure 03
                </span>
                <h2 className="font-display text-xl font-bold text-[#131b2e] dark:text-white">
                  Backend Gateway &amp; Endpoint Diagnostics
                </h2>
                <p className="text-[13px] text-[#4a4455] dark:text-slate-400">
                  Verify Express API routes, Gemini configuration readiness, and inspect expected JSON schemas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleProbeHealth('/api/health')}
                disabled={probing}
                className="px-3.5 py-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-[#630ed4] dark:text-violet-400 text-xs font-semibold hover:bg-[#eaedff] dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{probing ? 'Checking...' : 'Check Live Health'}</span>
              </button>
            </div>

            {/* Live Environment Summary Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-[#f2f3ff] dark:bg-slate-800/70 rounded-lg flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-[#7b7487] dark:text-slate-400">
                  Server Origin
                </span>
                <span className="font-mono text-xs font-bold text-[#131b2e] dark:text-slate-100 truncate">
                  {typeof window !== 'undefined' ? window.location.origin : 'localhost:3000'}
                </span>
                <span className="text-[11px] font-medium text-[#005b3d] dark:text-emerald-400">
                  {liveProbeResult
                    ? `HTTP ${liveProbeResult.status} · ${liveProbeResult.latencyMs}ms`
                    : 'Express + Vite API Gateway'}
                </span>
              </div>
              <div className="p-4 bg-[#f2f3ff] dark:bg-slate-800/70 rounded-lg flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-[#7b7487] dark:text-slate-400">
                  Gemini API Key
                </span>
                <span className="font-display text-sm font-bold text-[#131b2e] dark:text-slate-100">
                  {aiStatus?.configured ? 'Configured Server-Side' : 'Not Configured'}
                </span>
                <span className="text-[11px] text-[#7b7487] dark:text-slate-400">
                  Read from backend environment
                </span>
              </div>
              <div className="p-4 bg-[#f2f3ff] dark:bg-slate-800/70 rounded-lg flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-[#7b7487] dark:text-slate-400">
                  Active Collections
                </span>
                <span className="font-display text-sm font-bold text-[#131b2e] dark:text-slate-100 tabular-nums">
                  {subjects.length + topics.length + notes.length + timetableEntries.length} Records
                </span>
                <span className="text-[11px] text-[#7b7487] dark:text-slate-400">
                  Owner-scoped Firestore sync
                </span>
              </div>
            </div>

            {/* Route Registry */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#4a4455] dark:text-slate-300">
                  Server API Route Registry
                </span>
                <span className="text-[11px] text-[#7b7487] dark:text-slate-400">
                  Select a route to inspect schema
                </span>
              </div>

              {API_ENDPOINTS.map((ep, idx) => {
                const isSelected = idx === selectedEndpointIdx;
                return (
                  <div
                    key={ep.path}
                    onClick={() => setSelectedEndpointIdx(idx)}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#e2e7ff]/70 dark:bg-violet-950/35 ring-1 ring-[#7c3aed]/30'
                        : 'bg-[#faf8ff] dark:bg-slate-800/50 hover:bg-[#f2f3ff] dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                          ep.method === 'GET'
                            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-[#005b3d] dark:text-emerald-400'
                            : 'bg-[#eaddff] dark:bg-violet-950/60 text-[#630ed4] dark:text-violet-300'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#131b2e] dark:text-slate-100 truncate">
                        {ep.path}
                      </span>
                      <span className="hidden sm:inline text-[11px] text-[#7b7487] dark:text-slate-400 truncate">
                        · {ep.description}
                      </span>
                    </div>
                    {ep.method === 'GET' && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedEndpointIdx(idx);
                          handleProbeHealth(ep.path);
                        }}
                        className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 text-[#630ed4] dark:text-violet-400 text-[11px] font-semibold shadow-xs flex items-center gap-1 shrink-0"
                      >
                        <Play className="w-3 h-3" />
                        <span>Ping</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Payload Inspector */}
            <div className="flex flex-col gap-2 p-4 bg-[#f2f3ff] dark:bg-slate-800/70 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#131b2e] dark:text-slate-200 truncate">
                  {selectedEndpointIdx <= 1 && liveProbeResult
                    ? `Live Response · ${activeEndpoint.path} (${liveProbeResult.latencyMs}ms)`
                    : `Schema Preview · ${activeEndpoint.path}`}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 text-[#131b2e] dark:text-slate-200 text-[11px] font-semibold shadow-xs flex items-center gap-1 shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-3 bg-white dark:bg-slate-900 rounded-lg font-mono text-xs text-[#131b2e] dark:text-slate-200 leading-relaxed overflow-x-auto border border-[#ccc3d8]/40 dark:border-slate-700">
                <code>{JSON.stringify(inspectedJson, null, 2)}</code>
              </pre>
            </div>
          </section>

          {/* SECTION 4: Study Habits, Notifications & Workspace Appearance */}
          <section
            id="spaced-repetition"
            className="w-full bg-white dark:bg-slate-900 rounded-xl p-6 workspace-card flex flex-col gap-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
                  Habit Loop &amp; Alerts 04
                </span>
                <h2 className="font-display text-xl font-bold text-[#131b2e] dark:text-white">
                  Study Cadence, Notifications &amp; Appearance
                </h2>
                <p className="text-[13px] text-[#4a4455] dark:text-slate-400">
                  Configure daily study targets, class reminder lead times, focus hours, and workspace theme.
                </p>
              </div>
              <Timer className="w-6 h-6 text-[#7b7487] dark:text-slate-400 shrink-0" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily Study Goal Slider */}
              <div className="p-4 bg-[#f2f3ff] dark:bg-slate-800/70 rounded-lg flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase text-[#7b7487] dark:text-slate-400">
                    Daily Study Goal
                  </label>
                  <span className="px-2 py-0.5 rounded bg-[#7c3aed] text-white text-[11px] font-bold tabular-nums">
                    {dailyGoal} Min / Day
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={5}
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Number(e.target.value))}
                  className="w-full accent-[#7c3aed] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-[#7b7487] dark:text-slate-400 tabular-nums">
                  <span>10m (Light)</span>
                  <span>45m (Balanced)</span>
                  <span>120m (Intense)</span>
                </div>
              </div>

              {/* Lead Time & Focus Window */}
              <div
                id="notifications"
                className="p-4 bg-[#f2f3ff] dark:bg-slate-800/70 rounded-lg flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold uppercase text-[#7b7487] dark:text-slate-400">
                    Reminder Lead Time
                  </label>
                  <select
                    value={leadMinutes}
                    onChange={(e) => setLeadMinutes(Number(e.target.value))}
                    className="h-8 px-2.5 rounded-md bg-white dark:bg-slate-900 border border-[#ccc3d8]/50 dark:border-slate-700 text-xs font-semibold tabular-nums"
                  >
                    <option value={10}>10 min before</option>
                    <option value={15}>15 min before</option>
                    <option value={30}>30 min before</option>
                    <option value={60}>1 hour before</option>
                    <option value={120}>2 hours before</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-[#7b7487] dark:text-slate-400 mb-1">
                      Focus Start
                    </label>
                    <input
                      type="time"
                      value={focusStart}
                      onChange={(e) => setFocusStart(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-[#ccc3d8]/50 dark:border-slate-700 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-[#7b7487] dark:text-slate-400 mb-1">
                      Focus End
                    </label>
                    <input
                      type="time"
                      value={focusEnd}
                      onChange={(e) => setFocusEnd(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-[#ccc3d8]/50 dark:border-slate-700 text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Switches */}
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-4 rounded-lg bg-[#f2f3ff] dark:bg-slate-800/70 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-[#131b2e] dark:text-slate-100">
                    In-App Class Reminders
                  </p>
                  <p className="text-xs text-[#4a4455] dark:text-slate-400">
                    Logs upcoming lecture alerts in the header notification drawer while EduPrep AI is open.
                  </p>
                </div>
                <div className="relative inline-flex items-center ml-4">
                  <input
                    type="checkbox"
                    checked={inAppEnabled}
                    onChange={(e) => setInAppEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#dae2fd] dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7c3aed]" />
                </div>
              </label>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-[#f2f3ff] dark:bg-slate-800/70">
                <div>
                  <p className="text-sm font-semibold text-[#131b2e] dark:text-slate-100">
                    Browser Desktop Notifications ({browserPerm})
                  </p>
                  <p className="text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                    Browser alerts require permission and dispatch only while this web tab is active. Closed tabs without a push server cannot deliver desktop notifications.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {browserPerm !== 'granted' && browserPerm !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={handleRequestBrowserPermission}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-[#630ed4] dark:text-violet-400 text-xs font-semibold shadow-xs whitespace-nowrap"
                    >
                      Enable Permission
                    </button>
                  )}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={browserEnabled}
                      disabled={browserPerm !== 'granted'}
                      onChange={(e) => setBrowserEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#dae2fd] dark:bg-slate-700 rounded-full peer peer-disabled:opacity-40 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7c3aed]" />
                  </label>
                </div>
              </div>
            </div>

            {/* Workspace Appearance */}
            <div className="flex flex-col gap-2 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                Workspace Appearance
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    { id: 'light', label: 'Light Workspace', desc: 'Crisp academic paper', icon: Sun },
                    { id: 'dark', label: 'Dark Focus', desc: 'Low-glare study mode', icon: Moon },
                    { id: 'system', label: 'Match System', desc: 'Automatic OS sync', icon: Monitor },
                  ] as { id: ThemeMode; label: string; desc: string; icon: typeof Sun }[]
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = (profile?.themeMode || 'light') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setThemeMode(opt.id)}
                      className={`flex items-center gap-3 p-3.5 rounded-lg text-left transition-all ${
                        active
                          ? 'bg-[#e2e7ff]/70 dark:bg-violet-950/40 ring-1 ring-[#7c3aed]/40 shadow-xs'
                          : 'bg-[#f2f3ff] dark:bg-slate-800/70 hover:bg-[#eaedff] dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 ${
                          active ? 'text-[#630ed4] dark:text-violet-400' : 'text-[#7b7487]'
                        }`}
                      />
                      <div>
                        <p className="text-[13px] font-bold text-[#131b2e] dark:text-slate-100">
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-[#7b7487] dark:text-slate-400">
                          {active ? 'Active Session' : opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 5: Export Study & Academic Data */}
          <section
            id="data-export"
            className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-[#f2f3ff] dark:bg-slate-900 dark:border dark:border-slate-800 rounded-xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#dae2fd] dark:bg-slate-800 flex items-center justify-center text-[#4a4455] dark:text-slate-300 shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#131b2e] dark:text-white">
                  Export Study &amp; Academic Data
                </h2>
                <p className="text-xs text-[#4a4455] dark:text-slate-400">
                  Download your structured study notes in Markdown or export a complete JSON workspace backup.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={handleExportNotesMarkdown}
                className="flex-1 md:flex-initial px-4 py-2 rounded-lg bg-white dark:bg-slate-800 text-[#131b2e] dark:text-slate-100 text-xs font-semibold hover:bg-[#eaedff] dark:hover:bg-slate-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Notes (.md)</span>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex-1 md:flex-initial px-4 py-2 rounded-lg bg-white dark:bg-slate-800 text-[#131b2e] dark:text-slate-100 text-xs font-semibold hover:bg-[#eaedff] dark:hover:bg-slate-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Full JSON Backup</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
