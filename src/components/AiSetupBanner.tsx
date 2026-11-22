import { KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';

export function AiSetupBanner({ contextLabel }: { contextLabel?: string }) {
  const { aiStatus } = useAuth();

  if (!aiStatus || aiStatus.configured) {
    return null;
  }

  return (
    <div className="bg-amber-50/85 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
        <KeyRound className="w-4 h-4" />
      </div>
      <div>
        <h3 className="font-display text-sm font-semibold text-amber-950 dark:text-amber-200">
          Gemini API Key Not Configured on Server
        </h3>
        <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
          {contextLabel ? `${contextLabel} requires ` : 'AI generation features require '}
          <code className="font-mono font-semibold">GEMINI_API_KEY</code> to be configured server-side in{' '}
          <strong>Settings &gt; Secrets</strong>. All timetable, subject, and manual academic workflows remain active.
        </p>
      </div>
    </div>
  );
}

