import { describe, expect, it } from 'vitest';
import {
  formatMinutesUntil,
  formatTime12h,
  getNextUpcomingLecture,
  getTodaysClasses,
  timeToMinutes,
  validateTimetableEntry,
} from '../utils/timetable.ts';
import { TimetableEntry } from '../types/academic.ts';

function makeEntry(overrides: Partial<TimetableEntry>): TimetableEntry {
  return {
    id: 'entry-1',
    studentId: 'student-1',
    subjectId: 'sub-1',
    subjectCode: 'CS 314',
    subjectTitle: 'Distributed Systems',
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '11:30',
    room: 'Gates B12',
    ...overrides,
  };
}

describe('timetable utilities', () => {
  it('converts HH:MM strings to minutes and formats 12-hour times', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('14:30')).toBe(870);
    expect(timeToMinutes('25:00')).toBe(-1);
    expect(timeToMinutes('invalid')).toBe(-1);

    expect(formatTime12h('00:15')).toBe('12:15 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('14:30')).toBe('2:30 PM');
  });

  it('validates missing fields, reversed times, and overlapping sessions', () => {
    const existing = [
      makeEntry({
        id: 'e1',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '11:30',
        subjectTitle: 'Distributed Systems',
      }),
    ];

    expect(
      validateTimetableEntry(
        { subjectId: '', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', room: 'Room 1' },
        existing
      )
    ).toMatch(/select a subject/i);

    expect(
      validateTimetableEntry(
        { subjectId: 'sub-2', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', room: '   ' },
        existing
      )
    ).toMatch(/classroom/i);

    expect(
      validateTimetableEntry(
        { subjectId: 'sub-2', dayOfWeek: 1, startTime: '14:00', endTime: '13:00', room: 'Sloan 104' },
        existing
      )
    ).toMatch(/strictly after/i);

    // Overlapping slot on Monday
    expect(
      validateTimetableEntry(
        { subjectId: 'sub-2', dayOfWeek: 1, startTime: '11:00', endTime: '12:00', room: 'Sloan 104' },
        existing
      )
    ).toMatch(/Overlaps with Distributed Systems/);

    // Adjacent slot (starts exactly when previous ends) is valid
    expect(
      validateTimetableEntry(
        { subjectId: 'sub-2', dayOfWeek: 1, startTime: '11:30', endTime: '12:30', room: 'Sloan 104' },
        existing
      )
    ).toBeNull();

    // Same slot on Tuesday is valid
    expect(
      validateTimetableEntry(
        { subjectId: 'sub-2', dayOfWeek: 2, startTime: '10:00', endTime: '11:30', room: 'Sloan 104' },
        existing
      )
    ).toBeNull();

    // Editing the same entry does not conflict with itself
    expect(
      validateTimetableEntry(
        { subjectId: 'sub-1', dayOfWeek: 1, startTime: '10:15', endTime: '11:30', room: 'Gates B12' },
        existing,
        'e1'
      )
    ).toBeNull();
  });

  it('sorts todays classes and computes the next upcoming lecture across week boundaries', () => {
    const entries = [
      makeEntry({ id: 'mon-late', dayOfWeek: 1, startTime: '15:00', endTime: '16:00' }),
      makeEntry({ id: 'mon-early', dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }),
      makeEntry({ id: 'wed', dayOfWeek: 3, startTime: '11:00', endTime: '12:00' }),
    ];

    // Monday 08:30 AM (getDay() === 1)
    const mondayMorning = new Date(2026, 10, 16, 8, 30, 0);
    const todays = getTodaysClasses(entries, mondayMorning);
    expect(todays.map((e) => e.id)).toEqual(['mon-early', 'mon-late']);

    const nextFromMorning = getNextUpcomingLecture(entries, mondayMorning);
    expect(nextFromMorning?.entry.id).toBe('mon-early');
    expect(nextFromMorning?.minutesUntilStart).toBe(30);
    expect(nextFromMorning?.isToday).toBe(true);

    // Monday 16:00 PM -> next class is Wednesday 11:00 AM
    const mondayEvening = new Date(2026, 10, 16, 16, 0, 0);
    const nextFromEvening = getNextUpcomingLecture(entries, mondayEvening);
    expect(nextFromEvening?.entry.id).toBe('wed');
    expect(nextFromEvening?.isToday).toBe(false);
    expect(formatMinutesUntil(45)).toBe('in 45m');
    expect(formatMinutesUntil(135)).toBe('in 2h 15m');
    expect(formatMinutesUntil(24 * 60 + 120)).toBe('in 1d 2h');
  });
});
