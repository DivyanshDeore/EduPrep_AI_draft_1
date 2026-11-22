import React, { useMemo, useState } from 'react';
import { Calendar, ChevronRight, Clock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '../components/EmptyState.tsx';
import { Modal } from '../components/Modal.tsx';
import { useAcademicData } from '../contexts/AcademicDataContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import {
  createSubject,
  createTimetableEntry,
  deleteTimetableEntry,
  updateTimetableEntry,
} from '../services/firestoreService.ts';
import { DAY_NAMES, SHORT_DAY_NAMES, TimetableEntry } from '../types/academic.ts';
import {
  formatMinutesUntil,
  formatTime12h,
  timeToMinutes,
  validateTimetableEntry,
} from '../utils/timetable.ts';

const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon -> Sun

export function TimetablePage() {
  const { user } = useAuth();
  const { subjects, timetableEntries, nextUpcomingLecture } = useAcademicData();

  const [viewMode, setViewMode] = useState<'weekly' | 'daily'>('weekly');
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);

  const [subjectId, setSubjectId] = useState('');
  const [quickNewSubjectTitle, setQuickNewSubjectTitle] = useState('');
  const [quickNewSubjectCode, setQuickNewSubjectCode] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<number>(new Date().getDay());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [room, setRoom] = useState('');
  const [instructor, setInstructor] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const entriesByDay = useMemo(() => {
    const map: Record<number, TimetableEntry[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const entry of timetableEntries) {
      if (map[entry.dayOfWeek]) {
        map[entry.dayOfWeek].push(entry);
      }
    }
    for (const k of Object.keys(map)) {
      map[Number(k)].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    }
    return map;
  }, [timetableEntries]);

  const openAddModal = (presetDay?: number) => {
    setEditingEntry(null);
    setSubjectId(subjects[0]?.id || '__new__');
    setQuickNewSubjectTitle('');
    setQuickNewSubjectCode('');
    setDayOfWeek(presetDay ?? new Date().getDay());
    setStartTime('09:00');
    setEndTime('10:30');
    setRoom('');
    setInstructor(subjects[0]?.instructor || '');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setSubjectId(entry.subjectId);
    setQuickNewSubjectTitle('');
    setQuickNewSubjectCode('');
    setDayOfWeek(entry.dayOfWeek);
    setStartTime(entry.startTime);
    setEndTime(entry.endTime);
    setRoom(entry.room);
    setInstructor(entry.instructor || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);

    let resolvedSubjectId = subjectId;
    let resolvedTitle = '';
    let resolvedCode = '';

    if (subjectId === '__new__') {
      if (!quickNewSubjectTitle.trim() || !quickNewSubjectCode.trim()) {
        setFormError('Enter both a subject code and title, or select an existing subject.');
        return;
      }
    } else {
      const sub = subjects.find((s) => s.id === subjectId);
      if (!sub) {
        setFormError('Please select a valid subject.');
        return;
      }
      resolvedTitle = sub.title;
      resolvedCode = sub.code;
    }

    const validationError = validateTimetableEntry(
      {
        subjectId: subjectId === '__new__' ? 'pending-new-subject' : resolvedSubjectId,
        dayOfWeek,
        startTime,
        endTime,
        room,
      },
      timetableEntries,
      editingEntry?.id
    );
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    try {
      if (subjectId === '__new__') {
        resolvedTitle = quickNewSubjectTitle.trim();
        resolvedCode = quickNewSubjectCode.trim();
        resolvedSubjectId = await createSubject(user.uid, {
          code: resolvedCode,
          title: resolvedTitle,
          instructor: instructor.trim(),
        });
      }

      if (editingEntry) {
        await updateTimetableEntry(editingEntry.id, {
          subjectId: resolvedSubjectId,
          subjectCode: resolvedCode,
          subjectTitle: resolvedTitle,
          dayOfWeek,
          startTime,
          endTime,
          room: room.trim(),
          instructor: instructor.trim(),
        });
      } else {
        await createTimetableEntry(user.uid, {
          subjectId: resolvedSubjectId,
          subjectCode: resolvedCode,
          subjectTitle: resolvedTitle,
          dayOfWeek,
          startTime,
          endTime,
          room: room.trim(),
          instructor: instructor.trim(),
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save class.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTimetableEntry(id);
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
            <span className="text-[#630ed4] dark:text-violet-400">Academic Timetable</span>
          </div>
          <h1 className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
            Academic Timetable
          </h1>
          <p className="text-xs text-[#4a4455] dark:text-slate-400">
            Manage weekly lectures with automatic overlap protection and upcoming class tracking.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center p-1 rounded-lg bg-[#f2f3ff] dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'weekly'
                  ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white shadow-xs'
                  : 'text-[#4a4455] dark:text-slate-400'
              }`}
            >
              Weekly View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white shadow-xs'
                  : 'text-[#4a4455] dark:text-slate-400'
              }`}
            >
              Daily View
            </button>
          </div>

          <button
            type="button"
            onClick={() => openAddModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Class</span>
          </button>
        </div>
      </div>

      {/* Next Upcoming Class Spotlight */}
      {nextUpcomingLecture && (
        <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 text-[#7c3aed] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#630ed4] dark:text-violet-400">
                Next Upcoming Lecture · Starts {formatMinutesUntil(nextUpcomingLecture.minutesUntilStart)}
              </p>
              <h2 className="mt-0.5 font-display text-base font-bold">
                {nextUpcomingLecture.entry.subjectCode
                  ? `${nextUpcomingLecture.entry.subjectCode} · `
                  : ''}
                {nextUpcomingLecture.entry.subjectTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[#4a4455] dark:text-slate-400 tabular-nums">
                {DAY_NAMES[nextUpcomingLecture.entry.dayOfWeek]} ·{' '}
                {formatTime12h(nextUpcomingLecture.entry.startTime)} –{' '}
                {formatTime12h(nextUpcomingLecture.entry.endTime)} · Room{' '}
                {nextUpcomingLecture.entry.room}
              </p>
            </div>
          </div>
        </div>
      )}

      {timetableEntries.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No classes scheduled yet"
          description="Add your weekly lectures to track upcoming classes, receive smart reminders, and unlock automated Lecture Pre-Caps."
          actionLabel="Add First Class"
          onAction={() => openAddModal()}
        />
      ) : viewMode === 'weekly' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
          {DISPLAY_DAYS.map((dIdx) => {
            const items = entriesByDay[dIdx] || [];
            const isToday = new Date().getDay() === dIdx;
            return (
              <div
                key={dIdx}
                className={`bg-white dark:bg-slate-900 workspace-card rounded-xl p-4 flex flex-col ${
                  isToday
                    ? 'ring-1 ring-[#7c3aed]/60'
                    : 'dark:border dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-display text-sm font-bold">
                    {SHORT_DAY_NAMES[dIdx]}
                    {isToday ? ' · Today' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => openAddModal(dIdx)}
                    aria-label={`Add class on ${DAY_NAMES[dIdx]}`}
                    className="p-1 rounded-md text-slate-400 hover:text-[#7c3aed] hover:bg-[#f2f3ff] dark:hover:bg-slate-800"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-[#7b7487] dark:text-slate-500 py-4 text-center">
                    No classes
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-[#f2f3ff]/70 dark:bg-slate-800/70 group"
                      >
                        <p className="text-xs font-bold text-[#131b2e] dark:text-slate-100 leading-snug">
                          {item.subjectCode ? `${item.subjectCode} · ` : ''}
                          {item.subjectTitle}
                        </p>
                        <p className="mt-1 text-[11px] text-[#4a4455] dark:text-slate-400 tabular-nums">
                          {formatTime12h(item.startTime)} – {formatTime12h(item.endTime)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#7b7487] dark:text-slate-500 truncate">
                          {item.room}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1 rounded text-slate-500 hover:text-[#7c3aed] hover:bg-white dark:hover:bg-slate-900"
                            aria-label="Edit class"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-900"
                            aria-label="Delete class"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {DISPLAY_DAYS.map((dIdx) => (
              <button
                key={dIdx}
                type="button"
                onClick={() => setSelectedDay(dIdx)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  selectedDay === dIdx
                    ? 'bg-[#7c3aed] text-white'
                    : 'bg-[#f2f3ff] dark:bg-slate-800 text-[#4a4455] dark:text-slate-300 hover:bg-[#eaedff] dark:hover:bg-slate-700'
                }`}
              >
                {DAY_NAMES[dIdx]}
              </button>
            ))}
          </div>

          {(entriesByDay[selectedDay] || []).length === 0 ? (
            <p className="text-sm text-[#4a4455] dark:text-slate-400 py-8 text-center">
              No classes scheduled on {DAY_NAMES[selectedDay]}.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(entriesByDay[selectedDay] || []).map((item) => (
                <div
                  key={item.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="font-display text-base font-semibold">
                      {item.subjectCode ? `${item.subjectCode} · ` : ''}
                      {item.subjectTitle}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#4a4455] dark:text-slate-400 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime12h(item.startTime)} – {formatTime12h(item.endTime)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {item.room}
                      </span>
                      {item.instructor && <span>· {item.instructor}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Class Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEntry ? 'Edit Class Entry' : 'Add Class to Timetable'}
        subtitle="Overlapping sessions and invalid time ranges are validated automatically."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#4a4455] dark:text-slate-300 mb-1.5">
              Subject
            </label>
            <select
              value={subjectId}
              onChange={(e) => {
                const val = e.target.value;
                setSubjectId(val);
                const found = subjects.find((s) => s.id === val);
                if (found && found.instructor) setInstructor(found.instructor);
              }}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.title}
                </option>
              ))}
              {!editingEntry && <option value="__new__">+ Create a new subject</option>}
            </select>
          </div>

          {subjectId === '__new__' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#f2f3ff] dark:bg-slate-800">
              <div>
                <label className="block text-xs font-semibold mb-1">Course Code</label>
                <input
                  type="text"
                  required
                  placeholder="CS 314"
                  value={quickNewSubjectCode}
                  onChange={(e) => setQuickNewSubjectCode(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">Subject Title</label>
                <input
                  type="text"
                  required
                  placeholder="Distributed Systems"
                  value={quickNewSubjectTitle}
                  onChange={(e) => setQuickNewSubjectTitle(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4a4455] dark:text-slate-300 mb-1.5">
                Day of Week
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              >
                {DISPLAY_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_NAMES[d]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a4455] dark:text-slate-300 mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a4455] dark:text-slate-300 mb-1.5">
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4a4455] dark:text-slate-300 mb-1.5">
                Classroom / Location
              </label>
              <input
                type="text"
                required
                placeholder="Gates Hall B12"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a4455] dark:text-slate-300 mb-1.5">
                Instructor (optional)
              </label>
              <input
                type="text"
                placeholder="Prof. M. Rosenblum"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingEntry ? 'Save Changes' : 'Add Class'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
