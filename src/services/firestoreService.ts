import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import {
  AppNotification,
  ChatMessage,
  ChatModelId,
  ChatSession,
  LearningResource,
  NotificationPreference,
  PreCap,
  ResourceType,
  StudentProfile,
  StudyNote,
  StudySummary,
  Subject,
  Topic,
  TopicStatus,
} from '../types/academic.ts';

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return result as Partial<T>;
}

export async function getOrCreateStudentProfile(params: {
  uid: string;
  email: string;
  fullName: string;
  photoUrl?: string;
}): Promise<StudentProfile> {
  const path = `students/${params.uid}`;
  const ref = doc(db, 'students', params.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as StudentProfile;
    }
    const payload = stripUndefined({
      uid: params.uid,
      email: params.email,
      fullName: params.fullName || 'Student',
      institution: '',
      program: '',
      academicTerm: 'Fall Semester 2026',
      dailyGoal: 25,
      preferredModel: 'gemini-4-hydrogen',
      themeMode: 'light' as const,
      photoUrl: params.photoUrl || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(ref, payload);
    const created = await getDoc(ref);
    return created.data() as StudentProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateStudentProfile(
  uid: string,
  updates: Partial<
    Pick<
      StudentProfile,
      'email' | 'fullName' | 'institution' | 'program' | 'academicTerm' | 'dailyGoal' | 'preferredModel' | 'themeMode' | 'photoUrl'
    >
  >
): Promise<void> {
  const path = `students/${uid}`;
  try {
    const clean = stripUndefined({
      ...updates,
      dailyGoal: updates.dailyGoal !== undefined ? Math.max(1, Math.min(200, Math.trunc(updates.dailyGoal))) : undefined,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'students', uid), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function getOrCreateNotificationPreferences(uid: string): Promise<NotificationPreference> {
  const path = `notificationPreferences/${uid}`;
  const ref = doc(db, 'notificationPreferences', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as NotificationPreference;
    }
    const initial = {
      studentId: uid,
      leadMinutes: 15,
      inAppEnabled: true,
      browserEnabled: false,
      focusStart: '08:00',
      focusEnd: '21:00',
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initial);
    const created = await getDoc(ref);
    return created.data() as NotificationPreference;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateNotificationPreferences(
  uid: string,
  updates: Partial<Omit<NotificationPreference, 'studentId' | 'updatedAt'>>
): Promise<void> {
  const path = `notificationPreferences/${uid}`;
  try {
    const clean = stripUndefined({
      ...updates,
      leadMinutes:
        updates.leadMinutes !== undefined
          ? Math.max(5, Math.min(180, Math.trunc(updates.leadMinutes)))
          : undefined,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'notificationPreferences', uid), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Subjects
export async function createSubject(
  studentId: string,
  input: {
    code: string;
    title: string;
    instructor?: string;
    credits?: number;
    description?: string;
    syllabusId?: string;
  }
): Promise<string> {
  const ref = doc(collection(db, 'subjects'));
  const path = `subjects/${ref.id}`;
  try {
    await setDoc(
      ref,
      stripUndefined({
        studentId,
        code: input.code.trim().slice(0, 32),
        title: input.title.trim().slice(0, 160),
        instructor: (input.instructor || '').trim().slice(0, 120),
        credits: input.credits !== undefined ? Number(input.credits) : 3,
        description: (input.description || '').trim().slice(0, 2000),
        syllabusId: input.syllabusId || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateSubject(
  subjectId: string,
  updates: Partial<Pick<Subject, 'code' | 'title' | 'instructor' | 'credits' | 'description' | 'syllabusId'>>
): Promise<void> {
  const path = `subjects/${subjectId}`;
  try {
    await updateDoc(
      doc(db, 'subjects', subjectId),
      stripUndefined({
        ...updates,
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteSubjectCascade(studentId: string, subjectId: string): Promise<void> {
  const path = `subjects/${subjectId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'subjects', subjectId));

    const collectionsToClean = ['topics', 'timetableEntries', 'precaps', 'notes', 'syllabi'] as const;
    for (const colName of collectionsToClean) {
      const q = query(
        collection(db, colName),
        where('studentId', '==', studentId),
        where('subjectId', '==', subjectId)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => batch.delete(d.ref));
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Topics
export async function createTopic(
  studentId: string,
  input: {
    subjectId: string;
    syllabusId?: string;
    orderIndex: number;
    weekNumber?: number;
    title: string;
    description?: string;
    status?: TopicStatus;
    keyConcepts?: string[];
  }
): Promise<string> {
  const ref = doc(collection(db, 'topics'));
  const path = `topics/${ref.id}`;
  try {
    await setDoc(
      ref,
      stripUndefined({
        studentId,
        subjectId: input.subjectId,
        syllabusId: input.syllabusId || '',
        orderIndex: Math.max(0, Math.trunc(input.orderIndex)),
        weekNumber:
          input.weekNumber !== undefined && input.weekNumber >= 1
            ? Math.min(52, Math.trunc(input.weekNumber))
            : undefined,
        title: input.title.trim().slice(0, 200),
        description: (input.description || '').trim().slice(0, 2000),
        status: input.status || 'pending',
        keyConcepts: (input.keyConcepts || []).slice(0, 25),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateTopicStatus(topicId: string, status: TopicStatus): Promise<void> {
  const path = `topics/${topicId}`;
  try {
    await updateDoc(doc(db, 'topics', topicId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateTopic(
  topicId: string,
  updates: Pick<Topic, 'orderIndex' | 'title' | 'status'> &
    Partial<Pick<Topic, 'weekNumber' | 'description' | 'keyConcepts'>>
): Promise<void> {
  const path = `topics/${topicId}`;
  try {
    await updateDoc(
      doc(db, 'topics', topicId),
      stripUndefined({
        orderIndex: Math.max(0, Math.trunc(updates.orderIndex)),
        weekNumber:
          updates.weekNumber !== undefined && updates.weekNumber >= 1
            ? Math.min(52, Math.trunc(updates.weekNumber))
            : undefined,
        title: updates.title.trim().slice(0, 200),
        description: (updates.description || '').trim().slice(0, 2000),
        status: updates.status,
        keyConcepts: (updates.keyConcepts || []).slice(0, 25),
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteTopic(topicId: string): Promise<void> {
  const path = `topics/${topicId}`;
  try {
    await deleteDoc(doc(db, 'topics', topicId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Syllabi
export async function saveSyllabusWithSubjectAndTopics(params: {
  studentId: string;
  existingSubjectId?: string;
  subjectCode: string;
  subjectTitle: string;
  instructor: string;
  credits: number;
  description: string;
  fileName: string;
  fileType: 'pdf' | 'txt' | 'docx' | 'pasted';
  fileSize: number;
  extractedText: string;
  topics: {
    orderIndex: number;
    weekNumber?: number;
    title: string;
    description: string;
    keyConcepts: string[];
  }[];
}): Promise<{ subjectId: string; syllabusId: string }> {
  try {
    let subjectId = params.existingSubjectId;
    if (!subjectId) {
      subjectId = await createSubject(params.studentId, {
        code: params.subjectCode,
        title: params.subjectTitle,
        instructor: params.instructor,
        credits: params.credits,
        description: params.description,
      });
    }

    const syllabusRef = doc(collection(db, 'syllabi'));
    await setDoc(syllabusRef, {
      studentId: params.studentId,
      subjectId,
      fileName: params.fileName.slice(0, 255),
      fileType: params.fileType,
      fileSize: Math.max(0, Math.trunc(params.fileSize)),
      extractedText: params.extractedText.slice(0, 120000),
      parsedTopicCount: Math.trunc(params.topics.length),
      createdAt: serverTimestamp(),
    });

    await updateSubject(subjectId, { syllabusId: syllabusRef.id });

    const batch = writeBatch(db);
    for (let i = 0; i < params.topics.length; i++) {
      const t = params.topics[i];
      const topicRef = doc(collection(db, 'topics'));
      batch.set(
        topicRef,
        stripUndefined({
          studentId: params.studentId,
          subjectId,
          syllabusId: syllabusRef.id,
          orderIndex: Math.max(0, Math.trunc(t.orderIndex || i + 1)),
          weekNumber:
            t.weekNumber !== undefined && t.weekNumber >= 1
              ? Math.min(52, Math.trunc(t.weekNumber))
              : undefined,
          title: t.title.trim().slice(0, 200),
          description: (t.description || '').trim().slice(0, 2000),
          status: 'pending' as const,
          keyConcepts: (t.keyConcepts || []).slice(0, 25),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }
    await batch.commit();

    return { subjectId, syllabusId: syllabusRef.id };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'syllabi');
  }
}

export async function deleteSyllabus(syllabusId: string): Promise<void> {
  const path = `syllabi/${syllabusId}`;
  try {
    await deleteDoc(doc(db, 'syllabi', syllabusId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Timetable Entries
export async function createTimetableEntry(
  studentId: string,
  input: {
    subjectId: string;
    subjectCode?: string;
    subjectTitle: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string;
    instructor?: string;
  }
): Promise<string> {
  const ref = doc(collection(db, 'timetableEntries'));
  const path = `timetableEntries/${ref.id}`;
  try {
    await setDoc(
      ref,
      stripUndefined({
        studentId,
        subjectId: input.subjectId,
        subjectCode: (input.subjectCode || '').trim().slice(0, 32),
        subjectTitle: input.subjectTitle.trim().slice(0, 160),
        dayOfWeek: Math.trunc(input.dayOfWeek),
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room.trim().slice(0, 100),
        instructor: (input.instructor || '').trim().slice(0, 120),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateTimetableEntry(
  entryId: string,
  updates: {
    subjectId: string;
    subjectCode?: string;
    subjectTitle: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string;
    instructor?: string;
  }
): Promise<void> {
  const path = `timetableEntries/${entryId}`;
  try {
    await updateDoc(
      doc(db, 'timetableEntries', entryId),
      stripUndefined({
        subjectId: updates.subjectId,
        subjectCode: (updates.subjectCode || '').trim().slice(0, 32),
        subjectTitle: updates.subjectTitle.trim().slice(0, 160),
        dayOfWeek: Math.trunc(updates.dayOfWeek),
        startTime: updates.startTime,
        endTime: updates.endTime,
        room: updates.room.trim().slice(0, 100),
        instructor: (updates.instructor || '').trim().slice(0, 120),
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteTimetableEntry(entryId: string): Promise<void> {
  const path = `timetableEntries/${entryId}`;
  try {
    await deleteDoc(doc(db, 'timetableEntries', entryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Notifications
export async function createNotification(
  studentId: string,
  input: Omit<AppNotification, 'id' | 'studentId' | 'createdAt'>
): Promise<string> {
  const ref = doc(collection(db, 'notifications'));
  const path = `notifications/${ref.id}`;
  try {
    await setDoc(
      ref,
      stripUndefined({
        studentId,
        timetableEntryId: input.timetableEntryId,
        subjectId: input.subjectId,
        subjectTitle: input.subjectTitle.slice(0, 160),
        classTime: input.classTime.slice(0, 40),
        room: (input.room || '').slice(0, 100),
        title: input.title.slice(0, 200),
        message: input.message.slice(0, 500),
        occurrenceKey: input.occurrenceKey.slice(0, 120),
        isRead: input.isRead,
        createdAt: serverTimestamp(),
      })
    );
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Pre-Caps
export async function createPreCap(
  studentId: string,
  input: Omit<PreCap, 'id' | 'studentId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = doc(collection(db, 'precaps'));
  const path = `precaps/${ref.id}`;
  try {
    await setDoc(
      ref,
      stripUndefined({
        studentId,
        subjectId: input.subjectId,
        topicId: input.topicId,
        timetableEntryId: input.timetableEntryId || '',
        subjectTitle: input.subjectTitle.slice(0, 160),
        topicTitle: input.topicTitle.slice(0, 200),
        lectureDetails: (input.lectureDetails || '').slice(0, 240),
        introduction: input.introduction.slice(0, 5000),
        concepts: input.concepts.slice(0, 20),
        definitions: input.definitions.slice(0, 20),
        prerequisites: input.prerequisites.slice(0, 15),
        questions: input.questions.slice(0, 15),
        suggestedResources: (input.suggestedResources || []).slice(0, 12),
        aiAssisted: input.aiAssisted,
        modelUsed: input.modelUsed || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updatePreCap(
  precapId: string,
  updates: Omit<PreCap, 'id' | 'studentId' | 'subjectId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `precaps/${precapId}`;
  try {
    await updateDoc(
      doc(db, 'precaps', precapId),
      stripUndefined({
        topicId: updates.topicId,
        timetableEntryId: updates.timetableEntryId || '',
        topicTitle: updates.topicTitle.slice(0, 200),
        lectureDetails: (updates.lectureDetails || '').slice(0, 240),
        introduction: updates.introduction.slice(0, 5000),
        concepts: updates.concepts.slice(0, 20),
        definitions: updates.definitions.slice(0, 20),
        prerequisites: updates.prerequisites.slice(0, 15),
        questions: updates.questions.slice(0, 15),
        suggestedResources: (updates.suggestedResources || []).slice(0, 12),
        aiAssisted: updates.aiAssisted,
        modelUsed: updates.modelUsed || '',
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deletePreCap(precapId: string): Promise<void> {
  const path = `precaps/${precapId}`;
  try {
    await deleteDoc(doc(db, 'precaps', precapId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Notes
export async function createNote(
  studentId: string,
  input: Omit<StudyNote, 'id' | 'studentId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = doc(collection(db, 'notes'));
  const path = `notes/${ref.id}`;
  try {
    await setDoc(
      ref,
      stripUndefined({
        studentId,
        subjectId: input.subjectId,
        topicId: input.topicId || '',
        subjectTitle: input.subjectTitle.slice(0, 160),
        topicTitle: input.topicTitle.slice(0, 200),
        title: input.title.slice(0, 200),
        introduction: input.introduction.slice(0, 5000),
        importantConcepts: input.importantConcepts.slice(0, 25),
        detailedExplanations: input.detailedExplanations.slice(0, 25000),
        keyDefinitions: input.keyDefinitions.slice(0, 25),
        examples: input.examples.slice(0, 15),
        importantPoints: input.importantPoints.slice(0, 25),
        conclusion: input.conclusion.slice(0, 5000),
        aiAssisted: input.aiAssisted,
        modelUsed: input.modelUsed || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateNote(
  noteId: string,
  updates: Omit<StudyNote, 'id' | 'studentId' | 'subjectId' | 'subjectTitle' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `notes/${noteId}`;
  try {
    await updateDoc(
      doc(db, 'notes', noteId),
      stripUndefined({
        topicId: updates.topicId || '',
        topicTitle: updates.topicTitle.slice(0, 200),
        title: updates.title.slice(0, 200),
        introduction: updates.introduction.slice(0, 5000),
        importantConcepts: updates.importantConcepts.slice(0, 25),
        detailedExplanations: updates.detailedExplanations.slice(0, 25000),
        keyDefinitions: updates.keyDefinitions.slice(0, 25),
        examples: updates.examples.slice(0, 15),
        importantPoints: updates.importantPoints.slice(0, 25),
        conclusion: updates.conclusion.slice(0, 5000),
        aiAssisted: updates.aiAssisted,
        modelUsed: updates.modelUsed || '',
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteNote(noteId: string): Promise<void> {
  const path = `notes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'notes', noteId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Summaries
export async function createSummary(
  studentId: string,
  input: Omit<StudySummary, 'id' | 'studentId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = doc(collection(db, 'summaries'));
  const path = `summaries/${ref.id}`;
  try {
    await setDoc(
      ref,
      stripUndefined({
        studentId,
        noteId: input.noteId || '',
        subjectId: input.subjectId || '',
        title: input.title.slice(0, 200),
        sourceLabel: (input.sourceLabel || '').slice(0, 200),
        summaryText: input.summaryText.slice(0, 15000),
        keyTakeaways: input.keyTakeaways.slice(0, 25),
        aiAssisted: input.aiAssisted,
        modelUsed: input.modelUsed || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateSummary(
  summaryId: string,
  updates: Pick<StudySummary, 'title' | 'summaryText' | 'keyTakeaways' | 'aiAssisted'> &
    Partial<Pick<StudySummary, 'sourceLabel' | 'modelUsed'>>
): Promise<void> {
  const path = `summaries/${summaryId}`;
  try {
    await updateDoc(
      doc(db, 'summaries', summaryId),
      stripUndefined({
        title: updates.title.slice(0, 200),
        sourceLabel: (updates.sourceLabel || '').slice(0, 200),
        summaryText: updates.summaryText.slice(0, 15000),
        keyTakeaways: updates.keyTakeaways.slice(0, 25),
        aiAssisted: updates.aiAssisted,
        modelUsed: updates.modelUsed || '',
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteSummary(summaryId: string): Promise<void> {
  const path = `summaries/${summaryId}`;
  try {
    await deleteDoc(doc(db, 'summaries', summaryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Learning Resources
export async function saveResource(
  studentId: string,
  input: {
    subjectId?: string;
    topicId?: string;
    title: string;
    source: string;
    resourceType: ResourceType;
    url: string;
    description?: string;
    isGrounded: boolean;
  }
): Promise<string> {
  const ref = doc(collection(db, 'resources'));
  const path = `resources/${ref.id}`;
  try {
    await setDoc(
      ref,
      stripUndefined({
        studentId,
        subjectId: input.subjectId || '',
        topicId: input.topicId || '',
        title: input.title.slice(0, 240),
        source: input.source.slice(0, 120),
        resourceType: input.resourceType,
        url: input.url.slice(0, 1000),
        description: (input.description || '').slice(0, 1000),
        isGrounded: input.isGrounded,
        createdAt: serverTimestamp(),
      })
    );
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteResource(resourceId: string): Promise<void> {
  const path = `resources/${resourceId}`;
  try {
    await deleteDoc(doc(db, 'resources', resourceId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

const VALID_CHAT_MODELS = new Set<ChatModelId>([
  'gemini-4-carbon',
  'gemini-4-neon',
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
]);

function sanitizeChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-60).map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    text: String(m.text || '').slice(0, 8000),
    createdAtIso: String(m.createdAtIso || new Date().toISOString()).slice(0, 40),
  }));
}

// Chat Sessions
export async function createChatSession(
  studentId: string,
  input: {
    title: string;
    model: ChatModelId;
    systemInstruction?: string;
    messages: ChatMessage[];
  }
): Promise<string> {
  const ref = doc(collection(db, 'chatSessions'));
  const path = `chatSessions/${ref.id}`;
  const model: ChatModelId = VALID_CHAT_MODELS.has(input.model)
    ? input.model
    : 'gemini-4-hydrogen';
  try {
    await setDoc(
      ref,
      stripUndefined({
        studentId,
        title: (input.title || 'New Study Session').trim().slice(0, 160),
        model,
        systemInstruction: (input.systemInstruction || '').trim().slice(0, 2500),
        messages: sanitizeChatMessages(input.messages),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateChatSession(
  sessionId: string,
  updates: Partial<Pick<ChatSession, 'title' | 'model' | 'systemInstruction' | 'messages'>>
): Promise<void> {
  const path = `chatSessions/${sessionId}`;
  try {
    await updateDoc(
      doc(db, 'chatSessions', sessionId),
      stripUndefined({
        title: updates.title !== undefined ? updates.title.trim().slice(0, 160) : undefined,
        model:
          updates.model && VALID_CHAT_MODELS.has(updates.model)
            ? updates.model
            : undefined,
        systemInstruction:
          updates.systemInstruction !== undefined
            ? updates.systemInstruction.trim().slice(0, 2500)
            : undefined,
        messages:
          updates.messages !== undefined
            ? sanitizeChatMessages(updates.messages)
            : undefined,
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const path = `chatSessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'chatSessions', sessionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Optional starter semester seed (strictly user-initiated from empty dashboard)
export async function seedStarterSemester(studentId: string): Promise<void> {
  try {
    const sub1 = await createSubject(studentId, {
      code: 'CS 314',
      title: 'Distributed Systems',
      instructor: 'Prof. M. Rosenblum',
      credits: 4,
      description: 'Fault tolerance, consensus protocols (Raft/Paxos), replication, and distributed transactions.',
    });
    const sub2 = await createSubject(studentId, {
      code: 'MATH 285',
      title: 'Linear Algebra & Differential Equations',
      instructor: 'Prof. S. Venkatesh',
      credits: 3,
      description: 'Eigenvalue decompositions, coupled linear systems, Laplace transforms, and Fourier series.',
    });

    const topicsData = [
      {
        subjectId: sub1,
        orderIndex: 1,
        weekNumber: 1,
        title: 'Logical Clocks & Causal Ordering',
        description: 'Lamport timestamps, vector clocks, and happens-before relationships.',
        status: 'completed' as const,
        keyConcepts: ['Happens-Before', 'Lamport Clock', 'Vector Clock'],
      },
      {
        subjectId: sub1,
        orderIndex: 2,
        weekNumber: 2,
        title: 'Raft Consensus & Leader Election',
        description: 'Replicated state machines, leader election safety, and log matching invariants.',
        status: 'in_progress' as const,
        keyConcepts: ['Term Numbers', 'Log Matching', 'Split Vote'],
      },
      {
        subjectId: sub1,
        orderIndex: 3,
        weekNumber: 3,
        title: 'Two-Phase Commit & Distributed Transactions',
        description: 'Atomic commitment protocols, coordinator recovery, and Spanner TrueTime.',
        status: 'pending' as const,
        keyConcepts: ['2PC', 'Coordinator Failure', 'Serializable Isolation'],
      },
      {
        subjectId: sub2,
        orderIndex: 1,
        weekNumber: 1,
        title: 'Eigenvalues, Eigenvectors & Diagonalization',
        description: 'Characteristic polynomials, algebraic vs geometric multiplicity, and spectral theorem.',
        status: 'completed' as const,
        keyConcepts: ['Characteristic Equation', 'Spectral Theorem', 'Similarity'],
      },
      {
        subjectId: sub2,
        orderIndex: 2,
        weekNumber: 2,
        title: 'Fourier Series & Boundary Value Problems',
        description: 'Orthogonal function bases, convergence, and heat equation separation of variables.',
        status: 'pending' as const,
        keyConcepts: ['Orthogonality', 'Dirichlet Conditions', 'Heat Equation'],
      },
    ];

    for (const t of topicsData) {
      await createTopic(studentId, t);
    }

    const now = new Date();
    const today = now.getDay();
    const tomorrow = (today + 1) % 7;

    await createTimetableEntry(studentId, {
      subjectId: sub1,
      subjectCode: 'CS 314',
      subjectTitle: 'Distributed Systems',
      dayOfWeek: today,
      startTime: '14:00',
      endTime: '15:30',
      room: 'Gates Hall B12',
      instructor: 'Prof. M. Rosenblum',
    });

    await createTimetableEntry(studentId, {
      subjectId: sub2,
      subjectCode: 'MATH 285',
      subjectTitle: 'Linear Algebra & Differential Equations',
      dayOfWeek: tomorrow,
      startTime: '10:30',
      endTime: '12:00',
      room: 'Sloan Hall 104',
      instructor: 'Prof. S. Venkatesh',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seedStarterSemester');
  }
}
