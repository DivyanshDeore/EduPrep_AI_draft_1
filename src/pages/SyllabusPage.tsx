import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderUp,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { AiSetupBanner } from '../components/AiSetupBanner.tsx';
import { useAcademicData } from '../contexts/AcademicDataContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { apiClient } from '../services/apiClient.ts';
import {
  deleteSyllabus,
  saveSyllabusWithSubjectAndTopics,
} from '../services/firestoreService.ts';

interface PreviewTopic {
  orderIndex: number;
  weekNumber?: number;
  title: string;
  description: string;
  keyConcepts: string[];
}

export function SyllabusPage() {
  const { user, profile } = useAuth();
  const { subjects, syllabi } = useAcademicData();

  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [rawTextInput, setRawTextInput] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Preview state
  const [previewReady, setPreviewReady] = useState(false);
  const [targetSubjectId, setTargetSubjectId] = useState<string>('__create__');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [instructor, setInstructor] = useState('');
  const [credits, setCredits] = useState(3);
  const [description, setDescription] = useState('');
  const [fileMeta, setFileMeta] = useState<{
    fileName: string;
    fileType: 'pdf' | 'txt' | 'docx' | 'pasted';
    fileSize: number;
    extractedText: string;
  } | null>(null);
  const [previewTopics, setPreviewTopics] = useState<PreviewTopic[]>([]);

  const applyParsedResult = (res: {
    fileName: string;
    fileType: 'pdf' | 'txt' | 'docx' | 'pasted';
    fileSize: number;
    extractedText: string;
    structured: {
      subjectCode: string;
      subjectTitle: string;
      instructor: string;
      credits: number;
      description: string;
      topics: PreviewTopic[];
    } | null;
    aiWarning: string | null;
  }) => {
    setFileMeta({
      fileName: res.fileName,
      fileType: res.fileType,
      fileSize: res.fileSize,
      extractedText: res.extractedText,
    });
    setWarningMsg(res.aiWarning);

    if (res.structured) {
      setSubjectCode(res.structured.subjectCode);
      setSubjectTitle(res.structured.subjectTitle);
      setInstructor(res.structured.instructor);
      setCredits(res.structured.credits);
      setDescription(res.structured.description);
      setPreviewTopics(
        res.structured.topics.length > 0
          ? res.structured.topics
          : [{ orderIndex: 1, title: 'Introduction & Course Overview', description: '', keyConcepts: [] }]
      );
    } else {
      setSubjectCode('COURSE');
      setSubjectTitle(res.fileName.replace(/\.[^.]+$/, ''));
      setInstructor('');
      setCredits(3);
      setDescription('');
      setPreviewTopics([
        { orderIndex: 1, title: 'Topic 1', description: 'Review extracted syllabus text and customize.', keyConcepts: [] },
      ]);
    }
    setTargetSubjectId('__create__');
    setPreviewReady(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setErrorMsg(null);
    setSuccessMsg(null);
    setParsing(true);
    try {
      const res = await apiClient.parseSyllabusFile(file, profile?.preferredModel);
      applyParsedResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse syllabus file.');
    } finally {
      setParsing(false);
    }
  };

  const handleParseText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTextInput.trim()) {
      setErrorMsg('Please paste syllabus content first.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setParsing(true);
    try {
      const res = await apiClient.parseSyllabusText(
        rawTextInput,
        'pasted-syllabus.txt',
        profile?.preferredModel
      );
      applyParsedResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse syllabus text.');
    } finally {
      setParsing(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!user || !fileMeta) return;
    if (targetSubjectId === '__create__' && (!subjectCode.trim() || !subjectTitle.trim())) {
      setErrorMsg('Subject code and title are required.');
      return;
    }
    const cleanTopics = previewTopics
      .filter((t) => t.title.trim().length > 0)
      .map((t, idx) => ({ ...t, orderIndex: idx + 1 }));

    if (cleanTopics.length === 0) {
      setErrorMsg('Add at least one topic before saving.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await saveSyllabusWithSubjectAndTopics({
        studentId: user.uid,
        existingSubjectId: targetSubjectId === '__create__' ? undefined : targetSubjectId,
        subjectCode: subjectCode.trim(),
        subjectTitle: subjectTitle.trim(),
        instructor: instructor.trim(),
        credits: Number(credits) || 3,
        description: description.trim(),
        fileName: fileMeta.fileName,
        fileType: fileMeta.fileType,
        fileSize: fileMeta.fileSize,
        extractedText: fileMeta.extractedText,
        topics: cleanTopics,
      });
      setPreviewReady(false);
      setFileMeta(null);
      setRawTextInput('');
      setSelectedFileName('');
      setSuccessMsg(`Saved syllabus and ${cleanTopics.length} ordered topics to your workspace.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save syllabus.');
    } finally {
      setSaving(false);
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
          <span className="text-[#630ed4] dark:text-violet-400">Syllabus Ingestion</span>
        </div>
        <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
          Syllabus Ingestion
        </h1>
        <p className="text-xs text-[#4a4455] dark:text-slate-400">
          Upload a PDF, DOCX, or TXT syllabus (max 10 MB) or paste course outlines to extract ordered subjects and topics.
        </p>
      </div>

      <AiSetupBanner contextLabel="AI-assisted syllabus topic structuring" />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {warningMsg && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
          {warningMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Upload / Paste Card */}
      <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setMode('file')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === 'file'
                ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white shadow-xs'
                : 'text-[#4a4455] dark:text-slate-400'
            }`}
          >
            Upload File (PDF / DOCX / TXT)
          </button>
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === 'paste'
                ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white shadow-xs'
                : 'text-[#4a4455] dark:text-slate-400'
            }`}
          >
            Paste Syllabus Text
          </button>
        </div>

        {mode === 'file' ? (
          <label className="block border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#7c3aed] rounded-2xl p-10 text-center cursor-pointer transition-colors bg-[#faf8ff] dark:bg-slate-950/40">
            <input
              type="file"
              accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              disabled={parsing}
              className="sr-only"
            />
            <div className="w-12 h-12 rounded-xl bg-[#f2f3ff] dark:bg-slate-800 text-[#7c3aed] flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="font-display text-sm font-semibold text-[#131b2e] dark:text-slate-100">
              {parsing
                ? `Extracting and structuring ${selectedFileName}...`
                : selectedFileName || 'Click to choose a PDF, DOCX, or TXT syllabus'}
            </p>
            <p className="mt-1 text-xs text-[#7b7487] dark:text-slate-400">
              Files are validated by signature and parsed securely in memory without execution · Max 10 MB
            </p>
          </label>
        ) : (
          <form onSubmit={handleParseText} className="space-y-3">
            <textarea
              rows={7}
              value={rawTextInput}
              onChange={(e) => setRawTextInput(e.target.value)}
              placeholder="Paste your course syllabus, weekly schedule, or reading outline here..."
              className="w-full p-3.5 rounded-xl bg-[#faf8ff] dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
            />
            <button
              type="submit"
              disabled={parsing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] disabled:opacity-60"
            >
              <FolderUp className="w-4 h-4" />
              <span>{parsing ? 'Processing Syllabus...' : 'Extract Subject & Topics'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Interactive Syllabus Preview Editor */}
      {previewReady && fileMeta && (
        <div className="bg-white dark:bg-slate-900 workspace-card ring-1 ring-[#7c3aed]/40 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-display text-lg font-bold">Syllabus Preview &amp; Topic Review</h2>
              <p className="text-xs text-[#4a4455] dark:text-slate-400">
                Source: {fileMeta.fileName} · {(fileMeta.fileSize / 1024).toFixed(1)} KB ·{' '}
                {previewTopics.length} topics detected
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] disabled:opacity-60 whitespace-nowrap"
            >
              {saving ? 'Saving to Workspace...' : 'Confirm & Save Subject + Topics'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Destination Subject</label>
              <select
                value={targetSubjectId}
                onChange={(e) => setTargetSubjectId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              >
                <option value="__create__">Create New Subject from Syllabus</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    Attach to {s.code} · {s.title}
                  </option>
                ))}
              </select>
            </div>

            {targetSubjectId === '__create__' && (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Course Code</label>
                  <input
                    type="text"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Credits</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={credits}
                    onChange={(e) => setCredits(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm tabular-nums"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5">Subject Title</label>
                  <input
                    type="text"
                    value={subjectTitle}
                    onChange={(e) => setSubjectTitle(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5">Instructor</label>
                  <input
                    type="text"
                    value={instructor}
                    onChange={(e) => setInstructor(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold">Ordered Topics</h3>
              <button
                type="button"
                onClick={() =>
                  setPreviewTopics((prev) => [
                    ...prev,
                    { orderIndex: prev.length + 1, title: '', description: '', keyConcepts: [] },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#7c3aed] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Topic
              </button>
            </div>

            <div className="space-y-2.5">
              {previewTopics.map((topic, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#f2f3ff]/60 dark:bg-slate-800/70 flex flex-col sm:flex-row gap-3 items-start"
                >
                  <span className="font-mono text-xs font-bold text-[#630ed4] dark:text-violet-400 pt-2 w-7 shrink-0 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                    <input
                      type="text"
                      value={topic.title}
                      placeholder="Topic title"
                      onChange={(e) => {
                        const val = e.target.value;
                        setPreviewTopics((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, title: val } : item))
                        );
                      }}
                      className="h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium"
                    />
                    <input
                      type="text"
                      value={topic.description}
                      placeholder="Brief topic summary"
                      onChange={(e) => {
                        const val = e.target.value;
                        setPreviewTopics((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, description: val } : item))
                        );
                      }}
                      className="h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewTopics((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600"
                    aria-label="Remove topic"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Syllabi History */}
      <section className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6">
        <h2 className="font-display text-base font-bold mb-4">Uploaded Syllabi</h2>
        {syllabi.length === 0 ? (
          <p className="text-sm text-[#4a4455] dark:text-slate-400">
            No syllabi uploaded yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {syllabi.map((syl) => {
              const sub = subjects.find((s) => s.id === syl.subjectId);
              return (
                <div
                  key={syl.id}
                  className="py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-[#7c3aed] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{syl.fileName}</p>
                      <p className="text-xs text-[#4a4455] dark:text-slate-400 truncate">
                        {sub ? `${sub.code} · ${sub.title}` : 'Subject'} · {syl.parsedTopicCount} topics ·{' '}
                        {syl.fileType.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteSyllabus(syl.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600"
                    aria-label="Delete syllabus record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
