import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Calendar,
  FileText,
  Film,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';

export function LoginPage() {
  const { user, loading, signInWithGoogle, authError } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // authError state is handled inside AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-[#0b0f19] text-[#131b2e] dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Left Narrative Panel */}
      <div className="flex-1 flex flex-col justify-between p-8 sm:p-12 lg:p-16 max-w-3xl mx-auto lg:mx-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7c3aed] flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight leading-tight">
                EduPrep AI
              </span>
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#630ed4] dark:text-violet-400 leading-tight">
                Academic Workspace
              </span>
            </div>
          </div>

          <h1 className="mt-10 font-display text-3xl sm:text-5xl font-bold tracking-tight text-balance leading-[1.1]">
            Walk into every lecture prepared, organized, and ahead.
          </h1>
          <p className="mt-4 text-base text-[#4a4455] dark:text-slate-400 leading-relaxed max-w-xl">
            EduPrep AI connects your weekly class timetable, uploaded course syllabi, structured study notes, multi-turn AI tutoring, and image-to-video visualization in one unified workspace.
          </p>

          <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800">
              <Calendar className="w-5 h-5 text-[#7c3aed] mb-2" />
              <h2 className="font-display text-sm font-bold">Timetable &amp; Alerts</h2>
              <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                Conflict-checked weekly schedules with lead-time class reminders.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800">
              <Sparkles className="w-5 h-5 text-[#7c3aed] mb-2" />
              <h2 className="font-display text-sm font-bold">Lecture Pre-Caps</h2>
              <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                Synthesizes concepts and prerequisites for your next upcoming lecture.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800">
              <BookOpen className="w-5 h-5 text-[#005b3d] dark:text-emerald-400 mb-2" />
              <h2 className="font-display text-sm font-bold">Syllabus Ingestion</h2>
              <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                Extracts ordered weekly topics from PDF, DOCX, and TXT syllabi.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800">
              <FileText className="w-5 h-5 text-[#005b3d] dark:text-emerald-400 mb-2" />
              <h2 className="font-display text-sm font-bold">Notes &amp; Summaries</h2>
              <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                7-section study guides, key definitions, and high-yield summaries.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800">
              <Bot className="w-5 h-5 text-[#630ed4] dark:text-violet-400 mb-2" />
              <h2 className="font-display text-sm font-bold">Multi-Turn Chatbot</h2>
              <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                Deep reasoning with Carbon, Neon, Hydrogen, and Flash Lite models.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800">
              <Film className="w-5 h-5 text-[#630ed4] dark:text-violet-400 mb-2" />
              <h2 className="font-display text-sm font-bold">Video Studio</h2>
              <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                Animate study diagrams and photos into 16:9 or 9:16 video clips.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-[#7b7487] dark:text-slate-500">
          Private academic workspace · Your courses, notes, chats, and schedules remain strictly scoped to your account.
        </p>
      </div>

      {/* Right Sign-In Card */}
      <div className="flex-1 bg-[#f2f3ff] dark:bg-slate-900/60 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-8 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-36 h-36 bg-gradient-to-br from-[#630ed4]/10 via-[#7c3aed]/5 to-transparent rounded-full pointer-events-none blur-xl" />

          <div className="relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
              Student Workspace Access
            </span>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#131b2e] dark:text-white">
              Sign in to your workspace
            </h2>
            <p className="mt-2 text-sm text-[#4a4455] dark:text-slate-400 leading-relaxed">
              Authenticate with your Google account to create or resume your personal EduPrep AI academic profile.
            </p>

            {authError && (
              <div className="mt-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {authError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              disabled={submitting || loading}
              className="mt-6 w-full h-11 px-5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] shadow-sm"
            >
              <span>{submitting ? 'Signing in...' : 'Continue with Google'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="mt-6 p-3.5 rounded-lg bg-[#f2f3ff] dark:bg-slate-800/70 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#005b3d] dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                First-time sign-in automatically provisions your student profile, academic term settings, and notification preferences.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

