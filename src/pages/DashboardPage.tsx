import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  ExternalLink,
  FolderUp,
  Layers,
  MapPin,
  Plus,
  Sparkles,
} from 'lucide-react';
import { AiSetupBanner } from '../components/AiSetupBanner.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { useAcademicData } from '../contexts/AcademicDataContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { apiClient } from '../services/apiClient.ts';
import { createPreCap, seedStarterSemester } from '../services/firestoreService.ts';
import { DAY_NAMES, SHORT_DAY_NAMES } from '../types/academic.ts';
import { formatMinutesUntil, formatTime12h } from '../utils/timetable.ts';

export function DashboardPage() {
  const { user, profile } = useAuth();
  const {
    subjects,
    topics,
    syllabi,
    timetableEntries,
    precaps,
    notes,
    summaries,
    resources,
    todaysClasses,
    nextUpcomingLecture,
    dataLoading,
  } = useAcademicData();

  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);
  const [generatingPreCap, setGeneratingPreCap] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = (profile?.fullName || 'Student').split(' ')[0];

  const nextTopicForUpcoming = useMemo(() => {
    if (!nextUpcomingLecture) return null;
    const subjectTopics = topics
      .filter((t) => t.subjectId === nextUpcomingLecture.entry.subjectId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return (
      subjectTopics.find((t) => t.status !== 'completed') ||
      subjectTopics[0] ||
      null
    );
  }, [nextUpcomingLecture, topics]);

  const matchingUpcomingPreCap = useMemo(() => {
    if (!nextUpcomingLecture) return null;
    if (nextTopicForUpcoming) {
      const exact = precaps.find(
        (p) =>
          p.subjectId === nextUpcomingLecture.entry.subjectId &&
          p.topicId === nextTopicForUpcoming.id
      );
      if (exact) return exact;
    }
    return (
      precaps.find((p) => p.subjectId === nextUpcomingLecture.entry.subjectId) ||
      null
    );
  }, [nextUpcomingLecture, nextTopicForUpcoming, precaps]);

  const weeklyCounts = useMemo(() => {
    return SHORT_DAY_NAMES.map((label, dayIdx) => {
      const classes = timetableEntries.filter((e) => e.dayOfWeek === dayIdx);
      return { label, dayIdx, count: classes.length, classes };
    });
  }, [timetableEntries]);

  const completedTopicsCount = useMemo(
    () => topics.filter((t) => t.status === 'completed').length,
    [topics]
  );

  const handleLoadSample = async () => {
    if (!user) return;
    setSeeding(true);
    setActionError(null);
    try {
      await seedStarterSemester(user.uid);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load sample semester.');
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickGeneratePreCap = async () => {
    if (!user || !nextUpcomingLecture || !nextTopicForUpcoming) return;
    setGeneratingPreCap(true);
    setActionError(null);
    try {
      const subject = subjects.find((s) => s.id === nextUpcomingLecture.entry.subjectId);
      const syllabus = syllabi.find((s) => s.subjectId === nextUpcomingLecture.entry.subjectId);
      const lectureDetails = `${DAY_NAMES[nextUpcomingLecture.entry.dayOfWeek]} · ${formatTime12h(
        nextUpcomingLecture.entry.startTime
      )} – ${formatTime12h(nextUpcomingLecture.entry.endTime)} · ${nextUpcomingLecture.entry.room}`;

      const generated = await apiClient.generatePreCap({
        subjectTitle: subject?.title || nextUpcomingLecture.entry.subjectTitle,
        subjectCode: subject?.code || nextUpcomingLecture.entry.subjectCode,
        topicTitle: nextTopicForUpcoming.title,
        topicDescription: nextTopicForUpcoming.description,
        lectureDetails,
        syllabusContext: syllabus?.extractedText,
        includeResources: true,
        model: profile?.preferredModel,
      });

      await createPreCap(user.uid, {
        subjectId: nextUpcomingLecture.entry.subjectId,
        topicId: nextTopicForUpcoming.id,
        timetableEntryId: nextUpcomingLecture.entry.id,
        subjectTitle: subject?.title || nextUpcomingLecture.entry.subjectTitle,
        topicTitle: nextTopicForUpcoming.title,
        lectureDetails,
        introduction: generated.introduction,
        concepts: generated.concepts,
        definitions: generated.definitions,
        prerequisites: generated.prerequisites,
        questions: generated.questions,
        suggestedResources: generated.suggestedResources,
        aiAssisted: true,
        modelUsed: generated.modelUsed,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not generate pre-cap.');
    } finally {
      setGeneratingPreCap(false);
    }
  };

  const isEmptyWorkspace =
    !dataLoading &&
    subjects.length === 0 &&
    timetableEntries.length === 0 &&
    notes.length === 0;

  return (
    <div className="space-y-6">
      {/* Stitch Context Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl workspace-card px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#630ed4] dark:text-violet-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
            {profile?.institution ? ` · ${profile.institution}` : ''}
          </p>
          <h1 className="mt-0.5 font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
            {greeting}, {firstName}
          </h1>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/syllabus"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-xs font-semibold text-[#131b2e] dark:text-slate-100 hover:bg-[#eaedff] dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <FolderUp className="w-3.5 h-3.5 text-[#7c3aed]" />
            <span>Upload Syllabus</span>
          </Link>
          <Link
            to="/timetable"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-xs font-semibold text-[#131b2e] dark:text-slate-100 hover:bg-[#eaedff] dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#7c3aed]" />
            <span>Add Class</span>
          </Link>
          <Link
            to="/chat"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-xs font-semibold text-[#630ed4] dark:text-violet-300 hover:bg-[#eaedff] dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <span>AI Chatbot</span>
          </Link>
          <Link
            to="/notes"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Notes</span>
          </Link>
        </div>
      </div>

      <AiSetupBanner contextLabel="AI Pre-Caps, syllabus topic extraction, and notes generation" />

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          {actionError}
        </div>
      )}

      {isEmptyWorkspace ? (
        <EmptyState
          icon={Layers}
          title="Your academic workspace is ready"
          description="Upload a course syllabus or add classes to your weekly timetable to unlock automated Lecture Pre-Caps, structured AI notes, and smart class reminders. You can also populate a sample CS & Math semester to explore right away."
          actionLabel={seeding ? 'Setting up sample semester...' : 'Load Sample Semester'}
          onAction={handleLoadSample}
        />
      ) : (
        <>
          {/* Academic Activity Overview Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                Active Subjects
              </p>
              <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
                {subjects.length}
              </p>
              <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 tabular-nums">
                {timetableEntries.length} weekly classes
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                Topics Mastered
              </p>
              <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
                {completedTopicsCount} / {topics.length}
              </p>
              <p className="mt-1 text-xs text-[#005b3d] dark:text-emerald-400 tabular-nums font-medium">
                {topics.length > 0
                  ? `${Math.round((completedTopicsCount / topics.length) * 100)}% syllabus completion`
                  : 'No syllabus topics yet'}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                Study Notes &amp; Summaries
              </p>
              <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
                {notes.length} · {summaries.length}
              </p>
              <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400">
                Saved in your library
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7b7487] dark:text-slate-400">
                Pre-Caps &amp; Resources
              </p>
              <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
                {precaps.length} · {resources.length}
              </p>
              <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400">
                Lecture guides &amp; links
              </p>
            </div>
          </div>

          {/* Primary 12-Col Grid: Next Class + Pre-Cap (8 cols) | Today's Schedule & Week (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 Columns */}
            <div className="lg:col-span-8 space-y-6">
              {/* Next Upcoming Lecture & Pre-Cap Spotlight */}
              <section className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-[#630ed4] dark:text-violet-400">
                      Next Upcoming Lecture
                    </p>
                    {nextUpcomingLecture ? (
                      <>
                        <h2 className="mt-1 font-display text-xl font-bold text-[#131b2e] dark:text-white">
                          {nextUpcomingLecture.entry.subjectCode
                            ? `${nextUpcomingLecture.entry.subjectCode} · `
                            : ''}
                          {nextUpcomingLecture.entry.subjectTitle}
                        </h2>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#4a4455] dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="w-3.5 h-3.5" />
                            {DAY_NAMES[nextUpcomingLecture.entry.dayOfWeek]} ·{' '}
                            {formatTime12h(nextUpcomingLecture.entry.startTime)} –{' '}
                            {formatTime12h(nextUpcomingLecture.entry.endTime)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {nextUpcomingLecture.entry.room}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#005b3d] dark:text-emerald-400 tabular-nums">
                            Starts {formatMinutesUntil(nextUpcomingLecture.minutesUntilStart)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-[#4a4455] dark:text-slate-400">
                        No classes scheduled yet. Add entries to your timetable to see your next lecture here.
                      </p>
                    )}
                  </div>

                  {nextUpcomingLecture && (
                    <div className="shrink-0">
                      {matchingUpcomingPreCap ? (
                        <Link
                          to="/precaps"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-[#630ed4] dark:text-violet-300 text-xs font-semibold hover:bg-[#eaedff] dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        >
                          <span>Open Pre-Cap</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : nextTopicForUpcoming ? (
                        <button
                          type="button"
                          onClick={handleQuickGeneratePreCap}
                          disabled={generatingPreCap}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] disabled:opacity-60 transition-colors whitespace-nowrap"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {generatingPreCap ? 'Generating Pre-Cap...' : 'Generate Pre-Cap'}
                          </span>
                        </button>
                      ) : (
                        <Link
                          to="/syllabus"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-xs font-semibold text-[#131b2e] dark:text-slate-100 whitespace-nowrap"
                        >
                          Add Syllabus Topics
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Pre-Cap Preview Body */}
                {nextUpcomingLecture && (
                  <div className="pt-5">
                    {matchingUpcomingPreCap ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2 text-xs text-[#4a4455] dark:text-slate-400">
                          <span>
                            Topic: <strong className="text-[#131b2e] dark:text-slate-100">{matchingUpcomingPreCap.topicTitle}</strong>
                          </span>
                          <span>AI-Assisted Preparation Guide</span>
                        </div>
                        <p className="text-sm text-[#4a4455] dark:text-slate-300 leading-relaxed">
                          {matchingUpcomingPreCap.introduction}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          <div>
                            <h3 className="text-xs font-semibold text-[#131b2e] dark:text-slate-200 mb-2">
                              Concepts to Preview
                            </h3>
                            <ul className="space-y-1.5 text-xs text-[#4a4455] dark:text-slate-400">
                              {matchingUpcomingPreCap.concepts.slice(0, 4).map((c, idx) => (
                                <li key={idx}>· {c}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h3 className="text-xs font-semibold text-[#131b2e] dark:text-slate-200 mb-2">
                              Questions to Consider
                            </h3>
                            <ul className="space-y-1.5 text-xs text-[#4a4455] dark:text-slate-400">
                              {matchingUpcomingPreCap.questions.slice(0, 3).map((q, idx) => (
                                <li key={idx}>· {q}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : nextTopicForUpcoming ? (
                      <div className="text-sm text-[#4a4455] dark:text-slate-400">
                        Upcoming syllabus topic:{' '}
                        <strong className="text-[#131b2e] dark:text-slate-100">
                          #{nextTopicForUpcoming.orderIndex} · {nextTopicForUpcoming.title}
                        </strong>
                        . Generate a short AI-assisted lecture pre-cap to review prerequisites and key concepts before class.
                      </div>
                    ) : (
                      <div className="text-sm text-[#4a4455] dark:text-slate-400">
                        No syllabus topics are linked to {nextUpcomingLecture.entry.subjectTitle} yet. Upload a syllabus or add topics to unlock automated pre-caps.
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Recent Notes & Recent Summaries */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-base font-bold">Recent Study Notes</h2>
                    <Link
                      to="/notes"
                      className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 hover:underline whitespace-nowrap"
                    >
                      View all
                    </Link>
                  </div>
                  {notes.length === 0 ? (
                    <p className="text-sm text-[#4a4455] dark:text-slate-400">
                      No study notes saved yet. Generate structured notes from any subject topic.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {notes.slice(0, 4).map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() => navigate('/notes')}
                          className="w-full py-3 text-left hover:bg-[#f2f3ff]/50 dark:hover:bg-slate-800/40 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          <p className="text-sm font-semibold text-[#131b2e] dark:text-slate-100 truncate">
                            {note.title}
                          </p>
                          <p className="mt-0.5 text-xs text-[#4a4455] dark:text-slate-400 truncate">
                            {note.subjectTitle} · {note.topicTitle}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-base font-bold">Recent Summaries</h2>
                    <Link
                      to="/notes?tab=summaries"
                      className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 hover:underline whitespace-nowrap"
                    >
                      View all
                    </Link>
                  </div>
                  {summaries.length === 0 ? (
                    <p className="text-sm text-[#4a4455] dark:text-slate-400">
                      No summaries yet. Summarize saved study notes or custom material in one click.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaries.slice(0, 4).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => navigate('/notes?tab=summaries')}
                          className="w-full py-3 text-left hover:bg-[#f2f3ff]/50 dark:hover:bg-slate-800/40 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          <p className="text-sm font-semibold text-[#131b2e] dark:text-slate-100 truncate">
                            {s.title}
                          </p>
                          <p className="mt-0.5 text-xs text-[#4a4455] dark:text-slate-400 truncate">
                            {s.keyTakeaways.length} takeaways · {s.sourceLabel || 'Study Summary'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* Right 4 Columns */}
            <div className="lg:col-span-4 space-y-6">
              {/* Today's Classes */}
              <section className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-base font-bold">Today&apos;s Classes</h2>
                  <Link
                    to="/timetable"
                    className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 hover:underline whitespace-nowrap"
                  >
                    Timetable
                  </Link>
                </div>
                {todaysClasses.length === 0 ? (
                  <p className="text-sm text-[#4a4455] dark:text-slate-400">
                    No lectures scheduled for {DAY_NAMES[new Date().getDay()]}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {todaysClasses.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl bg-[#f2f3ff]/70 dark:bg-slate-800/70"
                      >
                        <p className="text-sm font-semibold text-[#131b2e] dark:text-slate-100">
                          {c.subjectCode ? `${c.subjectCode} · ` : ''}
                          {c.subjectTitle}
                        </p>
                        <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400 tabular-nums">
                          {formatTime12h(c.startTime)} – {formatTime12h(c.endTime)} · {c.room}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Weekly Timetable Overview */}
              <section className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6">
                <h2 className="font-display text-base font-bold mb-4">Weekly Overview</h2>
                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {weeklyCounts.map((d) => {
                    const isToday = new Date().getDay() === d.dayIdx;
                    return (
                      <Link
                        key={d.label}
                        to="/timetable"
                        className={`py-2.5 rounded-lg border transition-colors ${
                          isToday
                            ? 'border-[#7c3aed] bg-[#f2f3ff] dark:bg-violet-950/30'
                            : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="block text-[11px] font-semibold text-[#4a4455] dark:text-slate-400">
                          {d.label}
                        </span>
                        <span className="mt-1 block font-display text-sm font-bold tabular-nums text-[#131b2e] dark:text-slate-100">
                          {d.count}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>

              {/* Recommended / Saved Learning Resources */}
              <section className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-base font-bold">Learning Resources</h2>
                  <Link
                    to="/resources"
                    className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 hover:underline whitespace-nowrap"
                  >
                    Explore
                  </Link>
                </div>
                {resources.length === 0 ? (
                  <p className="text-sm text-[#4a4455] dark:text-slate-400">
                    Search grounded YouTube lectures, documentation, and open courses in the Resources Hub.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {resources.slice(0, 4).map((r) => (
                      <a
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 flex items-start justify-between gap-2 group"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#131b2e] dark:text-slate-100 group-hover:text-[#7c3aed] truncate">
                            {r.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#7b7487] dark:text-slate-400">
                            {r.source} · {r.resourceType.replace('_', ' ')}
                          </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
