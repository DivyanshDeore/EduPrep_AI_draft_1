import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Compass,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import { EmptyState } from '../components/EmptyState.tsx';
import { Modal } from '../components/Modal.tsx';
import { useAcademicData } from '../contexts/AcademicDataContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import {
  createSubject,
  createTopic,
  deleteSubjectCascade,
  deleteTopic,
  updateTopic,
  updateTopicStatus,
} from '../services/firestoreService.ts';
import { Topic, TopicStatus } from '../types/academic.ts';

export function SubjectsTopicsPage() {
  const { user } = useAuth();
  const { subjects, topics } = useAcademicData();
  const navigate = useNavigate();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [topicModalOpen, setTopicModalOpen] = useState(false);

  // Subject form
  const [subCode, setSubCode] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [subInstructor, setSubInstructor] = useState('');
  const [subCredits, setSubCredits] = useState(3);
  const [subDesc, setSubDesc] = useState('');

  // Topic form
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [topicWeek, setTopicWeek] = useState(1);

  const activeSubjectId = useMemo(() => {
    if (selectedSubjectId && subjects.some((s) => s.id === selectedSubjectId)) {
      return selectedSubjectId;
    }
    return subjects[0]?.id || '';
  }, [selectedSubjectId, subjects]);

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) || null;

  const subjectTopics = useMemo(
    () =>
      topics
        .filter((t) => t.subjectId === activeSubjectId)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [topics, activeSubjectId]
  );

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subCode.trim() || !subTitle.trim()) return;
    const id = await createSubject(user.uid, {
      code: subCode,
      title: subTitle,
      instructor: subInstructor,
      credits: subCredits,
      description: subDesc,
    });
    setSelectedSubjectId(id);
    setSubCode('');
    setSubTitle('');
    setSubInstructor('');
    setSubDesc('');
    setSubjectModalOpen(false);
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeSubject || !topicTitle.trim()) return;
    await createTopic(user.uid, {
      subjectId: activeSubject.id,
      orderIndex: subjectTopics.length + 1,
      weekNumber: topicWeek,
      title: topicTitle,
      description: topicDesc,
      status: 'pending',
    });
    setTopicTitle('');
    setTopicDesc('');
    setTopicModalOpen(false);
  };

  const cycleStatus = async (topic: Topic) => {
    const next: TopicStatus =
      topic.status === 'pending'
        ? 'in_progress'
        : topic.status === 'in_progress'
        ? 'completed'
        : 'pending';
    await updateTopicStatus(topic.id, next);
  };

  const moveTopic = async (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= subjectTopics.length) return;
    const current = subjectTopics[idx];
    const swap = subjectTopics[targetIdx];
    await Promise.all([
      updateTopic(current.id, {
        orderIndex: swap.orderIndex,
        title: current.title,
        status: current.status,
        weekNumber: current.weekNumber,
        description: current.description,
        keyConcepts: current.keyConcepts,
      }),
      updateTopic(swap.id, {
        orderIndex: current.orderIndex,
        title: swap.title,
        status: swap.status,
        weekNumber: swap.weekNumber,
        description: swap.description,
        keyConcepts: swap.keyConcepts,
      }),
    ]);
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
            <span className="text-[#630ed4] dark:text-violet-400">Subjects &amp; Topics</span>
          </div>
          <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
            Subjects &amp; Topics
          </h1>
          <p className="text-xs text-[#4a4455] dark:text-slate-400">
            Organize courses, reorder syllabus topics, track completion, and launch study notes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSubjectModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] shadow-sm whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subject</span>
        </button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects added yet"
          description="Add a subject manually or upload a syllabus to populate your subjects and ordered lecture topics."
          actionLabel="Create First Subject"
          onAction={() => setSubjectModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Subject List */}
          <div className="lg:col-span-4 space-y-2.5">
            {subjects.map((sub) => {
              const subTopics = topics.filter((t) => t.subjectId === sub.id);
              const done = subTopics.filter((t) => t.status === 'completed').length;
              const pct = subTopics.length > 0 ? Math.round((done / subTopics.length) * 100) : 0;
              const isSelected = sub.id === activeSubject?.id;

              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className={`w-full text-left p-4 rounded-xl workspace-card transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 ring-1 ring-[#7c3aed]'
                      : 'bg-white dark:bg-slate-900 dark:border dark:border-slate-800 hover:bg-[#f2f3ff]/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#630ed4] dark:text-violet-400">
                      {sub.code}
                    </span>
                    <span className="text-xs text-[#7b7487] dark:text-slate-400 tabular-nums">
                      {done}/{subTopics.length} topics
                    </span>
                  </div>
                  <h2 className="mt-1 font-display text-sm font-bold text-[#131b2e] dark:text-slate-100">
                    {sub.title}
                  </h2>
                  {sub.instructor && (
                    <p className="mt-0.5 text-xs text-[#4a4455] dark:text-slate-400 truncate">
                      {sub.instructor}
                    </p>
                  )}
                  <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#7c3aed] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Subject Topics */}
          {activeSubject && (
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="font-mono text-xs font-bold text-[#630ed4] dark:text-violet-400">
                    {activeSubject.code} · {activeSubject.credits || 3} Credits
                  </p>
                  <h2 className="mt-0.5 font-display text-xl font-bold">
                    {activeSubject.title}
                  </h2>
                  {activeSubject.description && (
                    <p className="mt-1 text-sm text-[#4a4455] dark:text-slate-400">
                      {activeSubject.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTopicModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Topic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSubjectCascade(user!.uid, activeSubject.id)}
                    className="p-2 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Delete subject"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {subjectTopics.length === 0 ? (
                <p className="text-sm text-[#4a4455] dark:text-slate-400 py-6 text-center">
                  No topics in this subject yet. Add topics manually or ingest a syllabus.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {subjectTopics.map((topic, idx) => (
                    <div
                      key={topic.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => cycleStatus(topic)}
                          title="Toggle status (Pending -> In Progress -> Completed)"
                          className="mt-0.5 shrink-0"
                        >
                          {topic.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-[#005b3d] dark:text-emerald-400" />
                          ) : topic.status === 'in_progress' ? (
                            <Clock className="w-5 h-5 text-amber-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-[#7b7487] dark:text-slate-400 tabular-nums">
                              #{topic.orderIndex}
                            </span>
                            <h3 className="text-sm font-semibold text-[#131b2e] dark:text-slate-100">
                              {topic.title}
                            </h3>
                          </div>
                          {topic.description && (
                            <p className="mt-0.5 text-xs text-[#4a4455] dark:text-slate-400">
                              {topic.description}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-[#7b7487] dark:text-slate-500">
                            Status: {topic.status.replace('_', ' ')}
                            {topic.weekNumber ? ` · Week ${topic.weekNumber}` : ''}
                            {topic.keyConcepts && topic.keyConcepts.length > 0
                              ? ` · ${topic.keyConcepts.join(', ')}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/notes?subjectId=${activeSubject.id}&topicId=${topic.id}`)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-[#630ed4] dark:text-violet-300 text-xs font-semibold hover:bg-[#eaedff] dark:hover:bg-slate-700 inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Notes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/resources?q=${encodeURIComponent(
                                `${activeSubject.title} ${topic.title}`
                              )}&subjectId=${activeSubject.id}&topicId=${topic.id}`
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-[#131b2e] dark:text-slate-200 text-xs font-semibold hover:bg-[#eaedff] dark:hover:bg-slate-700 inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>Resources</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTopic(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          aria-label="Move topic up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTopic(idx, 1)}
                          disabled={idx === subjectTopics.length - 1}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          aria-label="Move topic down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTopic(topic.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600"
                          aria-label="Delete topic"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* New Subject Modal */}
      <Modal
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title="Add New Subject"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Code</label>
              <input
                type="text"
                required
                placeholder="CS 314"
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Title</label>
              <input
                type="text"
                required
                placeholder="Distributed Systems"
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Instructor</label>
              <input
                type="text"
                placeholder="Prof. M. Rosenblum"
                value={subInstructor}
                onChange={(e) => setSubInstructor(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Credits</label>
              <input
                type="number"
                min={0}
                max={20}
                value={subCredits}
                onChange={(e) => setSubCredits(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Description</label>
            <textarea
              rows={3}
              value={subDesc}
              onChange={(e) => setSubDesc(e.target.value)}
              className="w-full p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSubjectModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9]"
            >
              Create Subject
            </button>
          </div>
        </form>
      </Modal>

      {/* New Topic Modal */}
      <Modal
        open={topicModalOpen}
        onClose={() => setTopicModalOpen(false)}
        title={`Add Topic to ${activeSubject?.code || ''}`}
      >
        <form onSubmit={handleCreateTopic} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-xs font-semibold mb-1.5">Topic Title</label>
              <input
                type="text"
                required
                placeholder="Raft Consensus & Leader Election"
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Week</label>
              <input
                type="number"
                min={1}
                max={52}
                value={topicWeek}
                onChange={(e) => setTopicWeek(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Description</label>
            <textarea
              rows={3}
              value={topicDesc}
              onChange={(e) => setTopicDesc(e.target.value)}
              className="w-full p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTopicModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9]"
            >
              Add Topic
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
