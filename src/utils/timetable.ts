import { DAY_NAMES, TimetableEntry } from '../types/academic.ts';

export function timeToMinutes(hhmm: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return -1;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;
  return hours * 60 + minutes;
}

export function formatTime12h(hhmm: string): string {
  const mins = timeToMinutes(hhmm);
  if (mins < 0) return hhmm;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function validateTimetableEntry(
  candidate: {
    subjectId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string;
  },
  existingEntries: TimetableEntry[],
  editingId?: string
): string | null {
  if (!candidate.subjectId.trim()) {
    return 'Please select a subject.';
  }
  if (!candidate.room.trim()) {
    return 'Please enter a classroom or location.';
  }
  if (candidate.dayOfWeek < 0 || candidate.dayOfWeek > 6) {
    return 'Please choose a valid day of the week.';
  }
  const startMins = timeToMinutes(candidate.startTime);
  const endMins = timeToMinutes(candidate.endTime);
  if (startMins < 0 || endMins < 0) {
    return 'Please enter valid start and end times (HH:MM).';
  }
  if (endMins <= startMins) {
    return 'End time must be strictly after start time.';
  }

  for (const entry of existingEntries) {
    if (editingId && entry.id === editingId) continue;
    if (entry.dayOfWeek !== candidate.dayOfWeek) continue;
    const eStart = timeToMinutes(entry.startTime);
    const eEnd = timeToMinutes(entry.endTime);
    if (startMins < eEnd && endMins > eStart) {
      return `Overlaps with ${entry.subjectTitle} (${formatTime12h(entry.startTime)} – ${formatTime12h(entry.endTime)}) on ${DAY_NAMES[entry.dayOfWeek]}.`;
    }
  }

  return null;
}

export interface UpcomingLecture {
  entry: TimetableEntry;
  minutesUntilStart: number;
  isToday: boolean;
  startsAtDate: Date;
}

export function getTodaysClasses(entries: TimetableEntry[], now = new Date()): TimetableEntry[] {
  const today = now.getDay();
  return entries
    .filter((e) => e.dayOfWeek === today)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function getNextUpcomingLecture(
  entries: TimetableEntry[],
  now = new Date()
): UpcomingLecture | null {
  if (entries.length === 0) return null;

  const currentDay = now.getDay();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  let best: UpcomingLecture | null = null;

  for (const entry of entries) {
    const startMins = timeToMinutes(entry.startTime);
    if (startMins < 0) continue;

    let dayOffset = (entry.dayOfWeek - currentDay + 7) % 7;
    if (dayOffset === 0 && startMins <= currentMins) {
      dayOffset = 7;
    }

    const minutesUntilStart = dayOffset * 24 * 60 + (startMins - currentMins);
    const startsAtDate = new Date(now);
    startsAtDate.setDate(now.getDate() + dayOffset);
    startsAtDate.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);

    if (!best || minutesUntilStart < best.minutesUntilStart) {
      best = {
        entry,
        minutesUntilStart,
        isToday: dayOffset === 0,
        startsAtDate,
      };
    }
  }

  return best;
}

export function formatMinutesUntil(minutes: number): string {
  if (minutes < 60) {
    return `in ${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  if (hours < 24) {
    return remMins > 0 ? `in ${hours}h ${remMins}m` : `in ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `in ${days}d ${remHours}h` : `in ${days}d`;
}
