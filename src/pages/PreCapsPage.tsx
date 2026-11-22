import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AiSetupBanner } from '../components/AiSetupBanner.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { useAcademicData } from '../contexts/AcademicDataContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { apiClient } from '../services/apiClient.ts';
import {
  createPreCap,
  deletePreCap,
  updatePreCap,
} from '../services/firestoreService.ts';
import { DAY_NAMES, PreCap } from '../types/academic.ts';
import { formatMinutesUntil, formatTime12h } from '../utils/timetable.ts';

export function PreCapsPage() {
  const { user, profile } = useAuth();
  const {
    subjects,
    topics,
    syllabi,
    precaps,
    nextUpcomingLecture,
  } = useAcademicData();

  const [selectedPreCapId, setSelectedPreCapId] = useState<string>('');
  const [manualSubjectId, setManualSubjectId] = useState<string>('');
  const [manualTopicId, setManualTopicId] = useState<string>('');
  const [includeResources, setIncludeResources] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Determine next upcoming topic from the next upcoming lecture
  const autoTarget = useMemo(() => {
    if (!nextUpcomingLecture) return null;
    const subject = subjects.find((s) => s.id === nextUpcomingLecture.entry.subjectId);
    const subjectTopics = topics
      .filter((t) => t.subjectId === nextUpcomingLecture.entry.subjectId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const nextTopic =
      subjectTopics.find((t) => t.status !== 'completed') ||
      subjectTopics[0] ||
      null;
    const syllabus = syllabi.find(
      (s) => s.subjectId === nextUpcomingLecture.entry.subjectId
    );
    const existingPreCap = nextTopic
      ? precaps.find(
          (p) =>
            p.subjectId === nextUpcomingLecture.entry.subjectId &&
            p.topicId === nextTopic.id
        ) || null
      : null;

    return {
      lecture: nextUpcomingLecture,
      subject,
      topic: nextTopic,
      syllabus,
      existingPreCap,
    };
  }, [nextUpcomingLecture, subjects, topics, syllabi, precaps]);

  const activePreCap: PreCap | null = useMemo(() => {
    if (selectedPreCapId) {
      const found = precaps.find((p) => p.id === selectedPreCapId);
      if (found) return found;
    }
    return autoTarget?.existingPreCap || precaps[0] || null;
  }, [selectedPreCapId, precaps, autoTarget]);

  const manualSubjectTopics = useMemo(() => {
    const sid = manualSubjectId || subjects[0]?.id || '';
    return topics
      .filter((t) => t.subjectId === sid)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [manualSubjectId, subjects, topics]);

  const handleGenerateUpcoming = async (forceRegenerate = false) => {
    if (!user || !autoTarget || !autoTarget.topic) {
      setErrorMsg('No upcoming lecture with syllabus topics found.');
      return;
    }

    // Prevent duplicate pre-caps unless user explicitly asks to regenerate
    if (autoTarget.existingPreCap && !forceRegenerate) {
      setSelectedPreCapId(autoTarget.existingPreCap.id);
      setInfoMsg('Loaded existing pre-cap for this upcoming lecture and topic.');
      return;
    }

    setGenerating(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const { lecture, subject, topic, syllabus, existingPreCap } = autoTarget;
      const lectureDetails = `${DAY_NAMES[lecture.entry.dayOfWeek]} · ${formatTime12h(
        lecture.entry.startTime
      )} – ${formatTime12h(lecture.entry.endTime)} · ${lecture.entry.room}`;

      const generated = await apiClient.generatePreCap({
        subjectTitle: subject?.title || lecture.entry.subjectTitle,
        subjectCode: subject?.code || lecture.entry.subjectCode,
        topicTitle: topic.title,
        topicDescription: topic.description,
        lectureDetails,
        syllabusContext: syllabus?.extractedText,
        includeResources,
        model: profile?.preferredModel,
      });

      if (existingPreCap) {
        await updatePreCap(existingPreCap.id, {
          topicId: topic.id,
          timetableEntryId: lecture.entry.id,
          subjectTitle: subject?.title || lecture.entry.subjectTitle,
          topicTitle: topic.title,
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
        setSelectedPreCapId(existingPreCap.id);
      } else {
        const newId = await createPreCap(user.uid, {
          subjectId: lecture.entry.subjectId,
          topicId: topic.id,
          timetableEntryId: lecture.entry.id,
          subjectTitle: subject?.title || lecture.entry.subjectTitle,
          topicTitle: topic.title,
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
        setSelectedPreCapId(newId);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate pre-cap.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateManual = async () => {
    if (!user) return;
    const sid = manualSubjectId || subjects[0]?.id || '';
    const tid = manualTopicId || manualSubjectTopics[0]?.id || '';
    const subject = subjects.find((s) => s.id === sid);
    const topic = topics.find((t) => t.id === tid);

    if (!subject || !topic) {
      setErrorMsg('Select a subject and topic first.');
      return;
    }

    const existing = precaps.find((p) => p.subjectId === sid && p.topicId === tid);
    if (existing) {
      setSelectedPreCapId(existing.id);
      setInfoMsg('Pre-cap already exists for this topic. Loaded saved guide (use Regenerate to refresh).');
      return;
    }

    setGenerating(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const syllabus = syllabi.find((s) => s.subjectId === sid);
      const generated = await apiClient.generatePreCap({
        subjectTitle: subject.title,
        subjectCode: subject.code,
        topicTitle: topic.title,
        topicDescription: topic.description,
        syllabusContext: syllabus?.extractedText,
        includeResources,
        model: profile?.preferredModel,
      });

      const newId = await createPreCap(user.uid, {
        subjectId: subject.id,
        topicId: topic.id,
        subjectTitle: subject.title,
        topicTitle: topic.title,
        lectureDetails: `${subject.code} · Topic #${topic.orderIndex}`,
        introduction: generated.introduction,
        concepts: generated.concepts,
        definitions: generated.definitions,
        prerequisites: generated.prerequisites,
        questions: generated.questions,
        suggestedResources: generated.suggestedResources,
        aiAssisted: true,
        modelUsed: generated.modelUsed,
      });
      setSelectedPreCapId(newId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate pre-cap.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateActive = async () => {
    if (!activePreCap) return;
    setGenerating(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const subject = subjects.find((s) => s.id === activePreCap.subjectId);
      const topic = topics.find((t) => t.id === activePreCap.topicId);
      const syllabus = syllabi.find((s) => s.subjectId === activePreCap.subjectId);

      const generated = await apiClient.generatePreCap({
        subjectTitle: activePreCap.subjectTitle,
        subjectCode: subject?.code,
        topicTitle: activePreCap.topicTitle,
        topicDescription: topic?.description,
        lectureDetails: activePreCap.lectureDetails,
        syllabusContext: syllabus?.extractedText,
        includeResources,
        model: profile?.preferredModel,
      });

      await updatePreCap(activePreCap.id, {
        topicId: activePreCap.topicId,
        timetableEntryId: activePreCap.timetableEntryId,
        subjectTitle: activePreCap.subjectTitle,
        topicTitle: activePreCap.topicTitle,
        lectureDetails: activePreCap.lectureDetails,
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
      setErrorMsg(err instanceof Error ? err.message : 'Failed to regenerate pre-cap.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stitch Context Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl workspace-card px-6 py-4 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7b7487] dark:text-slate-400">
          <span>Academic Intelligence</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Workspace</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[#630ed4] dark:text-violet-400">Lecture Pre-Caps</span>
        </div>
        <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
          Lecture Pre-Caps
        </h1>
        <p className="text-xs text-[#4a4455] dark:text-slate-400">
          Automatically maps your next scheduled class to the next syllabus topic to prepare concepts, definitions, prerequisites, and guiding questions.
        </p>
      </div>

      <AiSetupBanner contextLabel="Lecture Pre-Cap generation" />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div className="p-4 rounded-xl bg-[#f2f3ff] dark:bg-slate-800 border border-[#7c3aed]/30 text-sm text-[#131b2e] dark:text-slate-100">
          {infoMsg}
        </div>
      )}

      {/* Next Lecture Auto-Detector Card */}
      <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#630ed4] dark:text-violet-400">
              Upcoming Lecture Pipeline
            </p>
            {autoTarget ? (
              <>
                <h2 className="mt-1 font-display text-lg font-bold">
                  {autoTarget.subject?.code ? `${autoTarget.subject.code} · ` : ''}
                  {autoTarget.lecture.entry.subjectTitle}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#4a4455] dark:text-slate-400 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {DAY_NAMES[autoTarget.lecture.entry.dayOfWeek]} ·{' '}
                    {formatTime12h(autoTarget.lecture.entry.startTime)} –{' '}
                    {formatTime12h(autoTarget.lecture.entry.endTime)} (
                    {formatMinutesUntil(autoTarget.lecture.minutesUntilStart)})
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {autoTarget.lecture.entry.room}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#131b2e] dark:text-slate-200">
                  Next syllabus topic:{' '}
                  <strong>
                    {autoTarget.topic
                      ? `#${autoTarget.topic.orderIndex} · ${autoTarget.topic.title}`
                      : 'No topics linked to this subject yet'}
                  </strong>
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-[#4a4455] dark:text-slate-400">
                Add classes to your timetable to enable automatic next-lecture Pre-Cap detection.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="inline-flex items-center gap-2 text-xs text-[#4a4455] dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeResources}
                onChange={(e) => setIncludeResources(e.target.checked)}
                className="rounded accent-[#7c3aed]"
              />
              <span>Include grounded resources</span>
            </label>
            {autoTarget?.topic && (
              <button
                type="button"
                onClick={() => handleGenerateUpcoming(Boolean(autoTarget.existingPreCap))}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] disabled:opacity-60 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {generating
                    ? 'Generating...'
                    : autoTarget.existingPreCap
                    ? 'Refresh Upcoming Pre-Cap'
                    : 'Generate Upcoming Pre-Cap'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Manual Subject / Topic Trigger */}
        {subjects.length > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[#4a4455] dark:text-slate-400 mb-1">
                Or Prepare Any Subject &amp; Topic
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={manualSubjectId || subjects[0]?.id || ''}
                  onChange={(e) => {
                    setManualSubjectId(e.target.value);
                    setManualTopicId('');
                  }}
                  className="h-9 px-3 rounded-lg bg-[#faf8ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.title}
                    </option>
                  ))}
                </select>
                <select
                  value={manualTopicId || manualSubjectTopics[0]?.id || ''}
                  onChange={(e) => setManualTopicId(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-[#faf8ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  {manualSubjectTopics.length === 0 ? (
                    <option value="">No topics for this subject</option>
                  ) : (
                    manualSubjectTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.orderIndex} · {t.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerateManual}
              disabled={generating || manualSubjectTopics.length === 0}
              className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-[#f2f3ff] dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
            >
              Generate Topic Pre-Cap
            </button>
          </div>
        )}
      </div>

      {/* Saved Pre-Caps Split View */}
      {precaps.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No lecture pre-caps generated yet"
          description="Generate a Pre-Cap for your upcoming lecture or select any syllabus topic above to build a tailored preparation brief."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* History List */}
          <div className="lg:col-span-4 space-y-2.5">
            {precaps.map((p) => {
              const isSelected = p.id === activePreCap?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPreCapId(p.id)}
                  className={`w-full text-left p-4 rounded-xl workspace-card transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 ring-1 ring-[#7c3aed]'
                      : 'bg-white dark:bg-slate-900 dark:border dark:border-slate-800 hover:bg-[#f2f3ff]/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 truncate">
                    {p.subjectTitle}
                  </p>
                  <h3 className="mt-1 font-display text-sm font-bold text-[#131b2e] dark:text-slate-100">
                    {p.topicTitle}
                  </h3>
                  {p.lectureDetails && (
                    <p className="mt-1 text-xs text-[#7b7487] dark:text-slate-400 truncate">
                      {p.lectureDetails}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Pre-Cap Reader */}
          {activePreCap && (
            <article className="lg:col-span-8 bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-xs font-medium text-[#7b7487] dark:text-slate-400">
                    AI-Assisted Lecture Pre-Cap · {activePreCap.subjectTitle}
                    {activePreCap.modelUsed ? ` · ${activePreCap.modelUsed}` : ''}
                  </p>
                  <h2 className="mt-1 font-display text-xl font-bold">
                    {activePreCap.topicTitle}
                  </h2>
                  {activePreCap.lectureDetails && (
                    <p className="mt-1 text-xs text-[#4a4455] dark:text-slate-400">
                      {activePreCap.lectureDetails}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRegenerateActive}
                    disabled={generating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-[#f2f3ff] dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePreCap(activePreCap.id)}
                    className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    aria-label="Delete pre-cap"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <section>
                <h3 className="font-display text-sm font-bold mb-1.5">Introduction</h3>
                <p className="text-sm text-[#4a4455] dark:text-slate-300 leading-relaxed">
                  {activePreCap.introduction}
                </p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section>
                  <h3 className="font-display text-sm font-bold mb-2">
                    Concepts to Understand Before Class
                  </h3>
                  <ul className="space-y-1.5 text-sm text-[#4a4455] dark:text-slate-300">
                    {activePreCap.concepts.map((c, idx) => (
                      <li key={idx}>· {c}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="font-display text-sm font-bold mb-2">
                    Prerequisite Knowledge
                  </h3>
                  <ul className="space-y-1.5 text-sm text-[#4a4455] dark:text-slate-300">
                    {activePreCap.prerequisites.map((p, idx) => (
                      <li key={idx}>· {p}</li>
                    ))}
                  </ul>
                </section>
              </div>

              {activePreCap.definitions.length > 0 && (
                <section>
                  <h3 className="font-display text-sm font-bold mb-2.5">Important Definitions</h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                    {activePreCap.definitions.map((d, idx) => (
                      <div key={idx} className="p-3.5">
                        <dt className="text-xs font-bold text-[#131b2e] dark:text-slate-100">
                          {d.term}
                        </dt>
                        <dd className="mt-0.5 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                          {d.definition}
                        </dd>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="font-display text-sm font-bold mb-2">Questions to Consider</h3>
                <ul className="space-y-2 text-sm text-[#4a4455] dark:text-slate-300">
                  {activePreCap.questions.map((q, idx) => (
                    <li key={idx} className="p-3 rounded-lg bg-[#f2f3ff]/60 dark:bg-slate-800/70">
                      {idx + 1}. {q}
                    </li>
                  ))}
                </ul>
              </section>

              {activePreCap.suggestedResources && activePreCap.suggestedResources.length > 0 && (
                <section>
                  <h3 className="font-display text-sm font-bold mb-2">Suggested Resources</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activePreCap.suggestedResources.map((r, idx) => (
                      <a
                        key={idx}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#7c3aed] flex items-start justify-between gap-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{r.title}</p>
                          <p className="text-[11px] text-[#7b7487] dark:text-slate-400">
                            {r.source} · {r.resourceType}
                          </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </article>
          )}
        </div>
      )}
    </div>
  );
}
