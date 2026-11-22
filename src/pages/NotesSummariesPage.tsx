import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  FileText,
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
  createNote,
  createSummary,
  deleteNote,
  deleteSummary,
  updateNote,
  updateSummary,
} from '../services/firestoreService.ts';
import { StudyNote, StudySummary } from '../types/academic.ts';

export function NotesSummariesPage() {
  const { user, profile } = useAuth();
  const { subjects, topics, syllabi, notes, summaries } = useAcademicData();
  const [searchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') === 'summaries' ? 'summaries' : 'notes';
  const [activeTab, setActiveTab] = useState<'notes' | 'summaries'>(initialTab);

  // Notes generator state
  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') || '');
  const [topicId, setTopicId] = useState(searchParams.get('topicId') || '');
  const [customTopicText, setCustomTopicText] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('all');
  const [generatingNote, setGeneratingNote] = useState(false);

  // Summary generator state
  const [summaryMode, setSummaryMode] = useState<'from_note' | 'custom_text'>('from_note');
  const [sourceNoteId, setSourceNoteId] = useState('');
  const [customSummaryTitle, setCustomSummaryTitle] = useState('');
  const [customSummaryMaterial, setCustomSummaryMaterial] = useState('');
  const [focusMode, setFocusMode] = useState<'concise' | 'balanced' | 'exam'>('balanced');
  const [selectedSummaryId, setSelectedSummaryId] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('tab') === 'summaries') setActiveTab('summaries');
    const qsSub = searchParams.get('subjectId');
    const qsTop = searchParams.get('topicId');
    if (qsSub) setSubjectId(qsSub);
    if (qsTop) setTopicId(qsTop);
  }, [searchParams]);

  const effectiveSubjectId = subjectId || subjects[0]?.id || '';
  const subjectTopics = useMemo(
    () =>
      topics
        .filter((t) => t.subjectId === effectiveSubjectId)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [topics, effectiveSubjectId]
  );
  const effectiveTopicId =
    topicId && subjectTopics.some((t) => t.id === topicId)
      ? topicId
      : subjectTopics[0]?.id || '';

  const filteredNotes = useMemo(() => {
    if (filterSubjectId === 'all') return notes;
    return notes.filter((n) => n.subjectId === filterSubjectId);
  }, [notes, filterSubjectId]);

  const activeNote: StudyNote | null = useMemo(() => {
    if (selectedNoteId) {
      const found = filteredNotes.find((n) => n.id === selectedNoteId);
      if (found) return found;
    }
    return filteredNotes[0] || null;
  }, [selectedNoteId, filteredNotes]);

  const activeSummary: StudySummary | null = useMemo(() => {
    if (selectedSummaryId) {
      const found = summaries.find((s) => s.id === selectedSummaryId);
      if (found) return found;
    }
    return summaries[0] || null;
  }, [selectedSummaryId, summaries]);

  const handleGenerateNotes = async () => {
    if (!user) return;
    const subject = subjects.find((s) => s.id === effectiveSubjectId);
    const topic = topics.find((t) => t.id === effectiveTopicId);
    const resolvedTopicTitle = customTopicText.trim() || topic?.title || '';

    if (!subject || !resolvedTopicTitle) {
      setErrorMsg('Select a subject and topic (or enter a custom topic title).');
      return;
    }

    setGeneratingNote(true);
    setErrorMsg(null);
    try {
      const syllabus = syllabi.find((s) => s.subjectId === subject.id);
      const res = await apiClient.generateNotes({
        subjectTitle: subject.title,
        subjectCode: subject.code,
        topicTitle: resolvedTopicTitle,
        topicDescription: topic?.description,
        syllabusContext: syllabus?.extractedText,
        customInstructions: customInstructions.trim() || undefined,
        model: profile?.preferredModel,
      });

      const id = await createNote(user.uid, {
        subjectId: subject.id,
        topicId: topic?.id || '',
        subjectTitle: `${subject.code} · ${subject.title}`,
        topicTitle: resolvedTopicTitle,
        title: res.title,
        introduction: res.introduction,
        importantConcepts: res.importantConcepts,
        detailedExplanations: res.detailedExplanations,
        keyDefinitions: res.keyDefinitions,
        examples: res.examples,
        importantPoints: res.importantPoints,
        conclusion: res.conclusion,
        aiAssisted: true,
        modelUsed: res.modelUsed,
      });
      setSelectedNoteId(id);
      setCustomTopicText('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate study notes.');
    } finally {
      setGeneratingNote(false);
    }
  };

  const handleRegenerateNote = async () => {
    if (!activeNote) return;
    setGeneratingNote(true);
    setErrorMsg(null);
    try {
      const subject = subjects.find((s) => s.id === activeNote.subjectId);
      const topic = topics.find((t) => t.id === activeNote.topicId);
      const syllabus = syllabi.find((s) => s.subjectId === activeNote.subjectId);

      const res = await apiClient.generateNotes({
        subjectTitle: subject?.title || activeNote.subjectTitle,
        subjectCode: subject?.code,
        topicTitle: activeNote.topicTitle,
        topicDescription: topic?.description,
        syllabusContext: syllabus?.extractedText,
        model: profile?.preferredModel,
      });

      await updateNote(activeNote.id, {
        topicId: activeNote.topicId,
        topicTitle: activeNote.topicTitle,
        title: res.title,
        introduction: res.introduction,
        importantConcepts: res.importantConcepts,
        detailedExplanations: res.detailedExplanations,
        keyDefinitions: res.keyDefinitions,
        examples: res.examples,
        importantPoints: res.importantPoints,
        conclusion: res.conclusion,
        aiAssisted: true,
        modelUsed: res.modelUsed,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to regenerate note.');
    } finally {
      setGeneratingNote(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!user) return;
    let title = '';
    let sourceText = '';
    let sourceLabel = '';
    let linkedNoteId = '';
    let linkedSubjectId = '';

    if (summaryMode === 'from_note') {
      const note = notes.find((n) => n.id === (sourceNoteId || notes[0]?.id));
      if (!note) {
        setErrorMsg('Select a saved study note to summarize, or paste custom study material.');
        return;
      }
      title = `${note.title} — Summary`;
      sourceLabel = note.subjectTitle;
      linkedNoteId = note.id;
      linkedSubjectId = note.subjectId;
      sourceText = [
        note.introduction,
        note.importantConcepts.join('; '),
        note.detailedExplanations,
        note.keyDefinitions.map((d) => `${d.term}: ${d.definition}`).join('\n'),
        note.importantPoints.join('; '),
        note.conclusion,
      ].join('\n\n');
    } else {
      if (customSummaryMaterial.trim().length < 20) {
        setErrorMsg('Paste at least 20 characters of study material to summarize.');
        return;
      }
      title = customSummaryTitle.trim() || 'Study Material Summary';
      sourceLabel = 'Custom Material';
      sourceText = customSummaryMaterial.trim();
    }

    setGeneratingSummary(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.generateSummary({
        title,
        sourceText,
        focusMode,
        model: profile?.preferredModel,
      });

      const id = await createSummary(user.uid, {
        noteId: linkedNoteId,
        subjectId: linkedSubjectId,
        title: res.title,
        sourceLabel,
        summaryText: res.summaryText,
        keyTakeaways: res.keyTakeaways,
        aiAssisted: true,
        modelUsed: res.modelUsed,
      });
      setSelectedSummaryId(id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate summary.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleRegenerateSummary = async () => {
    if (!activeSummary) return;
    setGeneratingSummary(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.generateSummary({
        title: activeSummary.title,
        sourceText: `${activeSummary.summaryText}\n\n${activeSummary.keyTakeaways.join('\n')}`,
        focusMode,
        model: profile?.preferredModel,
      });
      await updateSummary(activeSummary.id, {
        title: res.title,
        sourceLabel: activeSummary.sourceLabel,
        summaryText: res.summaryText,
        keyTakeaways: res.keyTakeaways,
        aiAssisted: true,
        modelUsed: res.modelUsed,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to regenerate summary.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const downloadMarkdownNote = (note: StudyNote) => {
    const md = [
      `# ${note.title}`,
      `*AI-Assisted Study Notes · ${note.subjectTitle} · ${note.topicTitle}*`,
      '',
      '## Topic Introduction',
      note.introduction,
      '',
      '## Important Concepts',
      ...note.importantConcepts.map((c) => `- ${c}`),
      '',
      '## Detailed Explanations',
      note.detailedExplanations,
      '',
      '## Key Definitions',
      ...note.keyDefinitions.map((d) => `- **${d.term}**: ${d.definition}`),
      '',
      '## Examples',
      ...note.examples.map((ex, i) => `${i + 1}. ${ex}`),
      '',
      '## Important Points',
      ...note.importantPoints.map((p) => `- ${p}`),
      '',
      '## Conclusion',
      note.conclusion,
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.topicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stitch Context Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl workspace-card px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7b7487] dark:text-slate-400">
            <span>Academic Intelligence</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Workspace</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#630ed4] dark:text-violet-400">AI Study Notes &amp; Summaries</span>
          </div>
          <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
            AI Study Notes &amp; Summaries
          </h1>
          <p className="text-xs text-[#4a4455] dark:text-slate-400">
            Generate structured 7-section study notes and concise high-retention summaries.
          </p>
        </div>

        <div className="flex items-center p-1 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 w-fit shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'notes'
                ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white shadow-xs'
                : 'text-[#4a4455] dark:text-slate-400'
            }`}
          >
            Study Notes ({notes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('summaries')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'summaries'
                ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white shadow-xs'
                : 'text-[#4a4455] dark:text-slate-400'
            }`}
          >
            Summaries ({summaries.length})
          </button>
        </div>
      </div>

      <AiSetupBanner contextLabel="AI study notes and summary generation" />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {activeTab === 'notes' ? (
        <>
          {/* Notes Generator Bar */}
          <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Subject</label>
                <select
                  value={effectiveSubjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setTopicId('');
                  }}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  {subjects.length === 0 ? (
                    <option value="">Add a subject first</option>
                  ) : (
                    subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Syllabus Topic</label>
                <select
                  value={effectiveTopicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  {subjectTopics.length === 0 ? (
                    <option value="">No topics — enter custom topic</option>
                  ) : (
                    subjectTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.orderIndex} · {t.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Or Custom Topic Override
                </label>
                <input
                  type="text"
                  placeholder="Optional custom topic title..."
                  value={customTopicText}
                  onChange={(e) => setCustomTopicText(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input
                type="text"
                placeholder="Optional study focus (e.g., 'Include worked proofs and common exam pitfalls')"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="flex-1 h-10 px-3 rounded-lg bg-[#faf8ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <button
                type="button"
                onClick={handleGenerateNotes}
                disabled={generatingNote || subjects.length === 0}
                className="h-10 px-5 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>{generatingNote ? 'Generating Notes...' : 'Generate Study Notes'}</span>
              </button>
            </div>
          </div>

          {notes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No study notes saved yet"
              description="Select a subject and topic above to generate structured AI-assisted study notes with definitions, explanations, and examples."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 space-y-3">
                <select
                  value={filterSubjectId}
                  onChange={(e) => setFilterSubjectId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium"
                >
                  <option value="all">All Subjects ({notes.length})</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.title}
                    </option>
                  ))}
                </select>

                <div className="space-y-2">
                  {filteredNotes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setSelectedNoteId(n.id)}
                      className={`w-full text-left p-4 rounded-xl workspace-card transition-all ${
                        n.id === activeNote?.id
                          ? 'bg-white dark:bg-slate-900 ring-1 ring-[#7c3aed]'
                          : 'bg-white dark:bg-slate-900 dark:border dark:border-slate-800 hover:bg-[#f2f3ff]/50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <p className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 truncate">
                        {n.subjectTitle}
                      </p>
                      <h3 className="mt-1 font-display text-sm font-bold text-[#131b2e] dark:text-slate-100">
                        {n.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#7b7487] dark:text-slate-400 truncate">
                        {n.topicTitle}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {activeNote && (
                <article className="lg:col-span-8 bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-medium text-[#7b7487] dark:text-slate-400">
                        AI-Assisted Study Notes · {activeNote.subjectTitle}
                        {activeNote.modelUsed ? ` · ${activeNote.modelUsed}` : ''}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-bold">{activeNote.title}</h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => downloadMarkdownNote(activeNote)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-[#f2f3ff] dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export .md</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRegenerateNote}
                        disabled={generatingNote}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-[#f2f3ff] dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generatingNote ? 'animate-spin' : ''}`} />
                        <span>Regenerate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(activeNote.id)}
                        className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <section>
                    <h3 className="font-display text-sm font-bold mb-1.5">1. Topic Introduction</h3>
                    <p className="text-sm text-[#4a4455] dark:text-slate-300 leading-relaxed">
                      {activeNote.introduction}
                    </p>
                  </section>

                  <section>
                    <h3 className="font-display text-sm font-bold mb-2">2. Important Concepts</h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-[#4a4455] dark:text-slate-300">
                      {activeNote.importantConcepts.map((c, idx) => (
                        <li key={idx} className="p-2.5 rounded-lg bg-[#f2f3ff]/60 dark:bg-slate-800/70">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-display text-sm font-bold mb-1.5">3. Detailed Explanations</h3>
                    <div className="text-sm text-[#4a4455] dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {activeNote.detailedExplanations}
                    </div>
                  </section>

                  <section>
                    <h3 className="font-display text-sm font-bold mb-2">4. Key Definitions</h3>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                      {activeNote.keyDefinitions.map((d, idx) => (
                        <div key={idx} className="p-3.5">
                          <dt className="text-xs font-bold">{d.term}</dt>
                          <dd className="mt-0.5 text-xs text-[#4a4455] dark:text-slate-400 leading-relaxed">
                            {d.definition}
                          </dd>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="font-display text-sm font-bold mb-2">5. Examples</h3>
                    <ol className="space-y-2 text-sm text-[#4a4455] dark:text-slate-300">
                      {activeNote.examples.map((ex, idx) => (
                        <li key={idx} className="p-3 rounded-lg bg-[#faf8ff] dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          {idx + 1}. {ex}
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section>
                    <h3 className="font-display text-sm font-bold mb-2">6. Important Points</h3>
                    <ul className="space-y-1.5 text-sm text-[#4a4455] dark:text-slate-300">
                      {activeNote.importantPoints.map((pt, idx) => (
                        <li key={idx}>· {pt}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-display text-sm font-bold mb-1.5">7. Conclusion</h3>
                    <p className="text-sm text-[#4a4455] dark:text-slate-300 leading-relaxed">
                      {activeNote.conclusion}
                    </p>
                  </section>
                </article>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Summary Generator Bar */}
          <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#f2f3ff] dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSummaryMode('from_note')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                    summaryMode === 'from_note'
                      ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white shadow-xs'
                      : 'text-[#4a4455] dark:text-slate-400'
                  }`}
                >
                  Summarize Saved Note
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryMode('custom_text')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                    summaryMode === 'custom_text'
                      ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white shadow-xs'
                      : 'text-[#4a4455] dark:text-slate-400'
                  }`}
                >
                  Paste Study Material
                </button>
              </div>

              <select
                value={focusMode}
                onChange={(e) => setFocusMode(e.target.value as 'concise' | 'balanced' | 'exam')}
                className="h-9 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                <option value="concise">Concise Skim</option>
                <option value="balanced">Balanced Synthesis</option>
                <option value="exam">Exam Review Focus</option>
              </select>
            </div>

            {summaryMode === 'from_note' ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={sourceNoteId || notes[0]?.id || ''}
                  onChange={(e) => setSourceNoteId(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  {notes.length === 0 ? (
                    <option value="">No saved notes available — switch to Paste Study Material</option>
                  ) : (
                    notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.subjectTitle} · {n.title}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary || notes.length === 0}
                  className="h-10 px-5 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{generatingSummary ? 'Summarizing...' : 'Generate Summary'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Summary title (e.g., Chapter 4: Virtual Memory)"
                  value={customSummaryTitle}
                  onChange={(e) => setCustomSummaryTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
                <textarea
                  rows={5}
                  placeholder="Paste lecture transcript, textbook excerpts, or study notes..."
                  value={customSummaryMaterial}
                  onChange={(e) => setCustomSummaryMaterial(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-[#faf8ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="h-10 px-5 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{generatingSummary ? 'Summarizing...' : 'Generate Summary'}</span>
                </button>
              </div>
            )}
          </div>

          {summaries.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No summaries saved yet"
              description="Condense any saved study note or pasted lecture material into a high-retention summary."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 space-y-2">
                {summaries.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSummaryId(s.id)}
                    className={`w-full text-left p-4 rounded-xl workspace-card transition-all ${
                      s.id === activeSummary?.id
                        ? 'bg-white dark:bg-slate-900 ring-1 ring-[#7c3aed]'
                        : 'bg-white dark:bg-slate-900 dark:border dark:border-slate-800 hover:bg-[#f2f3ff]/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#630ed4] dark:text-violet-400 truncate">
                      {s.sourceLabel || 'Study Summary'}
                    </p>
                    <h3 className="mt-1 font-display text-sm font-bold text-[#131b2e] dark:text-slate-100">
                      {s.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#7b7487] dark:text-slate-400 tabular-nums">
                      {s.keyTakeaways.length} key takeaways
                    </p>
                  </button>
                ))}
              </div>

              {activeSummary && (
                <article className="lg:col-span-8 bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-medium text-[#7b7487] dark:text-slate-400">
                        AI-Assisted Summary · {activeSummary.sourceLabel || 'Study Material'}
                        {activeSummary.modelUsed ? ` · ${activeSummary.modelUsed}` : ''}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-bold">{activeSummary.title}</h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleRegenerateSummary}
                        disabled={generatingSummary}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-[#f2f3ff] dark:hover:bg-slate-800"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generatingSummary ? 'animate-spin' : ''}`} />
                        <span>Regenerate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSummary(activeSummary.id)}
                        className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        aria-label="Delete summary"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-[#4a4455] dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {activeSummary.summaryText}
                  </p>

                  <div>
                    <h3 className="font-display text-sm font-bold mb-2">Key Takeaways</h3>
                    <ul className="space-y-1.5 text-sm text-[#4a4455] dark:text-slate-300">
                      {activeSummary.keyTakeaways.map((item, idx) => (
                        <li key={idx} className="p-2.5 rounded-lg bg-[#f2f3ff]/60 dark:bg-slate-800/70">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
