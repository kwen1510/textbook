import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type ProgressState = "unread" | "reading" | "completed" | "needs_review";
type NoteType = "note" | "highlight" | "question" | "voice";
type ReviewRating = "again" | "hard" | "good" | "easy";

type StoredNote = {
  id: string;
  userId: string;
  sectionId: string;
  type: NoteType;
  quote: string | null;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type StoredProgress = {
  id: string;
  userId: string;
  sectionId: string;
  state: ProgressState;
  updatedAt: string;
};

type StoredReviewSchedule = {
  id: string;
  userId: string;
  sectionId: string;
  mode: string;
  dueAt: string;
  intervalDays: number;
  masteryScore: number;
  attempts: number;
  lastRating: string | null;
  updatedAt: string;
};

type StoredRecallAttempt = {
  id: string;
  userId: string;
  sectionId: string;
  prompt: string;
  answer: string;
  rating: ReviewRating;
  createdAt: string;
};

type StoredTranscriptionJob = {
  id: string;
  userId: string;
  sectionId: string | null;
  status: "pending" | "completed" | "failed";
  model: string;
  transcript: string | null;
  error: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

type LocalStoreData = {
  notes: StoredNote[];
  progress: StoredProgress[];
  recallAttempts: StoredRecallAttempt[];
  reviewSchedules: StoredReviewSchedule[];
  transcriptionJobs: StoredTranscriptionJob[];
};

export type LocalNote = Omit<StoredNote, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

export type LocalProgress = Omit<StoredProgress, "updatedAt"> & {
  updatedAt: Date;
};

export type LocalReviewSchedule = Omit<StoredReviewSchedule, "dueAt" | "updatedAt"> & {
  dueAt: Date;
  updatedAt: Date;
};

export type LocalRecallAttempt = Omit<StoredRecallAttempt, "createdAt"> & {
  createdAt: Date;
};

export type LocalTranscriptionJob = Omit<StoredTranscriptionJob, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

let storeCache: LocalStoreData | null = null;

function emptyStore(): LocalStoreData {
  return {
    notes: [],
    progress: [],
    recallAttempts: [],
    reviewSchedules: [],
    transcriptionJobs: [],
  };
}

function getStorePath() {
  return path.join(process.cwd(), ".textbook", "local.json");
}

function toIso(date = new Date()) {
  return date.toISOString();
}

function readStore() {
  if (storeCache) return storeCache;
  const storePath = getStorePath();
  mkdirSync(path.dirname(storePath), { recursive: true });
  if (!existsSync(storePath)) {
    storeCache = emptyStore();
    writeStore(storeCache);
    return storeCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as Partial<LocalStoreData>;
    storeCache = {
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      progress: Array.isArray(parsed.progress) ? parsed.progress : [],
      recallAttempts: Array.isArray(parsed.recallAttempts) ? parsed.recallAttempts : [],
      reviewSchedules: Array.isArray(parsed.reviewSchedules) ? parsed.reviewSchedules : [],
      transcriptionJobs: Array.isArray(parsed.transcriptionJobs) ? parsed.transcriptionJobs : [],
    };
    return storeCache;
  } catch (error) {
    throw new Error(`Local Textbook store could not be read: ${error instanceof Error ? error.message : "invalid JSON"}`);
  }
}

function writeStore(store: LocalStoreData) {
  const storePath = getStorePath();
  mkdirSync(path.dirname(storePath), { recursive: true });
  writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

function saveStore() {
  if (storeCache) writeStore(storeCache);
}

function mapNote(note: StoredNote): LocalNote {
  return { ...note, createdAt: new Date(note.createdAt), updatedAt: new Date(note.updatedAt) };
}

function mapProgress(progress: StoredProgress): LocalProgress {
  return { ...progress, updatedAt: new Date(progress.updatedAt) };
}

function mapReviewSchedule(schedule: StoredReviewSchedule): LocalReviewSchedule {
  return { ...schedule, dueAt: new Date(schedule.dueAt), updatedAt: new Date(schedule.updatedAt) };
}

function mapRecallAttempt(attempt: StoredRecallAttempt): LocalRecallAttempt {
  return { ...attempt, createdAt: new Date(attempt.createdAt) };
}

function mapTranscriptionJob(job: StoredTranscriptionJob): LocalTranscriptionJob {
  return { ...job, createdAt: new Date(job.createdAt), updatedAt: new Date(job.updatedAt) };
}

export function getLocalDb() {
  return readStore();
}

export function getLocalStoreInfo() {
  return { path: getStorePath(), type: "json-file" };
}

export function listLocalProgress(userId: string) {
  return readStore().progress
    .filter((row) => row.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(mapProgress);
}

export function upsertLocalProgress(userId: string, sectionIds: string[], state: ProgressState) {
  const store = readStore();
  const now = toIso();
  const rows: LocalProgress[] = [];
  for (const sectionId of sectionIds) {
    let row = store.progress.find((item) => item.userId === userId && item.sectionId === sectionId);
    if (!row) {
      row = { id: randomUUID(), userId, sectionId, state, updatedAt: now };
      store.progress.push(row);
    } else {
      row.state = state;
      row.updatedAt = now;
    }
    rows.push(mapProgress(row));
  }
  saveStore();
  return rows;
}

export function listLocalNotes(userId: string, sectionId?: string | null) {
  return readStore().notes
    .filter((row) => row.userId === userId && (!sectionId || row.sectionId === sectionId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(mapNote);
}

export function createLocalNote(input: { userId: string; sectionId: string; body: string; quote?: string | null; type: NoteType; tags: string[] }) {
  const store = readStore();
  const now = toIso();
  const note: StoredNote = {
    id: randomUUID(),
    userId: input.userId,
    sectionId: input.sectionId,
    type: input.type,
    quote: input.quote ?? null,
    body: input.body,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
  };
  store.notes.push(note);
  saveStore();
  return mapNote(note);
}

export function updateLocalNote(userId: string, id: string, input: { body?: string; quote?: string | null; type?: NoteType; tags?: string[] }) {
  const store = readStore();
  const note = store.notes.find((item) => item.id === id && item.userId === userId);
  if (!note) return null;
  if (input.body !== undefined) note.body = input.body;
  if (input.quote !== undefined) note.quote = input.quote;
  if (input.type !== undefined) note.type = input.type;
  if (input.tags !== undefined) note.tags = input.tags;
  note.updatedAt = toIso();
  saveStore();
  return mapNote(note);
}

export function deleteLocalNote(userId: string, id: string) {
  const store = readStore();
  const next = store.notes.filter((item) => !(item.id === id && item.userId === userId));
  const deleted = next.length !== store.notes.length;
  if (deleted) {
    store.notes = next;
    saveStore();
  }
  return deleted;
}

export function listLocalReviewSchedules(userId: string) {
  return readStore().reviewSchedules.filter((row) => row.userId === userId).map(mapReviewSchedule);
}

export function createLocalRecallAttempt(input: { userId: string; sectionId: string; prompt: string; answer: string; rating: ReviewRating }) {
  const store = readStore();
  const attempt: StoredRecallAttempt = { id: randomUUID(), ...input, createdAt: toIso() };
  store.recallAttempts.push(attempt);
  saveStore();
  return mapRecallAttempt(attempt);
}

export function upsertLocalReviewSchedule(input: {
  userId: string;
  sectionId: string;
  mode: string;
  dueAt: Date;
  intervalDays: number;
  masteryScore: number;
  attempts: number;
  lastRating: ReviewRating;
}) {
  const store = readStore();
  let row = store.reviewSchedules.find((item) => item.userId === input.userId && item.sectionId === input.sectionId);
  const now = toIso();
  if (!row) {
    row = {
      id: randomUUID(),
      userId: input.userId,
      sectionId: input.sectionId,
      mode: input.mode,
      dueAt: input.dueAt.toISOString(),
      intervalDays: input.intervalDays,
      masteryScore: input.masteryScore,
      attempts: input.attempts,
      lastRating: input.lastRating,
      updatedAt: now,
    };
    store.reviewSchedules.push(row);
  } else {
    row.mode = input.mode;
    row.dueAt = input.dueAt.toISOString();
    row.intervalDays = input.intervalDays;
    row.masteryScore = input.masteryScore;
    row.attempts = input.attempts;
    row.lastRating = input.lastRating;
    row.updatedAt = now;
  }
  saveStore();
  return mapReviewSchedule(row);
}

export function getLocalReviewSchedule(userId: string, sectionId: string) {
  const row = readStore().reviewSchedules.find((item) => item.userId === userId && item.sectionId === sectionId);
  return row ? mapReviewSchedule(row) : null;
}

export function createLocalTranscriptionJob(input: { userId: string; sectionId?: string | null; model: string }) {
  const store = readStore();
  const now = toIso();
  const job: StoredTranscriptionJob = {
    id: randomUUID(),
    userId: input.userId,
    sectionId: input.sectionId ?? null,
    status: "pending",
    model: input.model,
    transcript: null,
    error: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };
  store.transcriptionJobs.push(job);
  saveStore();
  return mapTranscriptionJob(job);
}

export function updateLocalTranscriptionJob(id: string, input: { status: LocalTranscriptionJob["status"]; transcript?: string | null; error?: string | null; metadata?: unknown }) {
  const store = readStore();
  const job = store.transcriptionJobs.find((item) => item.id === id);
  if (!job) return;
  job.status = input.status;
  if (input.transcript !== undefined) job.transcript = input.transcript;
  if (input.error !== undefined) job.error = input.error;
  if (input.metadata !== undefined) job.metadata = input.metadata;
  job.updatedAt = toIso();
  saveStore();
}
