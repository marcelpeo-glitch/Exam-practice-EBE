// Course-agnostic exam schema. Exams are JSON files in /data/exams (see README.md).

export type QuestionType = 'single-choice' | 'multi-select' | 'numeric' | 'open' | 'matching';
export type AnswerSource = 'official' | 'ai';

export interface ImageRef {
  /** Path relative to /data/exams, e.g. "img/qm1-2023/q08-normal-pdf.png". */
  src: string;
  alt?: string;
  caption?: string;
}

export interface TableData {
  header?: string[];
  rows: string[][];
  caption?: string;
}

export interface Option {
  id: string;
  text?: string;
  image?: string;
}

export interface NumericField {
  id: string;
  label?: string;
  prefix?: string;
  suffix?: string;
  answer: number;
  /** Absolute tolerance. Defaults to 0.5% of the answer. */
  tolerance?: number;
  /** Inclusive range of accepted values (in addition to answer ± tolerance). */
  acceptRange?: [number, number];
}

export interface MatchingPrompt {
  id: string;
  text: string;
  /** Restrict the drop-down for this prompt to these choice ids (defaults to all choices). */
  choiceIds?: string[];
}

export interface Question {
  id: string;
  number: number;
  section?: string;
  type: QuestionType;
  topic: string;
  points: number;
  stem: string;
  instruction?: string;
  images?: ImageRef[];
  table?: TableData;
  /** single-choice / multi-select */
  options?: Option[];
  /** matching (drop-downs / drag-and-drop) */
  prompts?: MatchingPrompt[];
  choices?: Option[];
  /** numeric with several input boxes */
  fields?: NumericField[];
  /**
   * single-choice: option id; multi-select: option ids; numeric: number;
   * matching: { promptId: choiceId }; open: null.
   */
  correctAnswer?: string | string[] | number | Record<string, string> | null;
  /** single-choice: other option ids that also count as correct. */
  alsoAccepted?: string[];
  /** numeric (single field) */
  tolerance?: number;
  acceptRange?: [number, number];
  prefix?: string;
  suffix?: string;
  /** open */
  modelAnswer?: string;
  explanation: string;
  explanationImages?: ImageRef[];
  answerSource: AnswerSource;
  explanationSource?: AnswerSource;
  sourceNote?: string;
}

export interface PassRule {
  minPoints?: number;
  minPercentage?: number;
  minSectionPoints?: Record<string, number>;
  description?: string;
}

export interface Grading {
  /** grade = 10 × points / max points (one decimal) */
  method?: 'linear';
  passGrade?: number;
  passRule?: PassRule;
  multiSelectScoring?: 'partial' | 'all-or-nothing';
  /** Deduct points / (number of options − 1) for each wrong single-choice answer. */
  guessingCorrection?: boolean;
}

export interface Resource {
  title: string;
  src: string;
}

export interface Exam {
  schemaVersion: number;
  id: string;
  courseCode: string;
  courseName: string;
  academicYear: string;
  examType: 'regular' | 'resit';
  examTypeAssumed?: boolean;
  title: string;
  date?: string;
  durationMinutes: number;
  durationSource?: 'stated' | 'assumed';
  source?: { file?: string; kind?: string };
  grading?: Grading;
  resources?: Resource[];
  notes?: string[];
  questions: Question[];
  /** Set by the loader for demo/example exams. */
  isDemo?: boolean;
}

/** single-choice / open: string; multi-select: string[]; numeric & matching: { fieldOrPromptId: value } */
export type AnswerValue = string | string[] | Record<string, string>;
export type Answers = Record<string, AnswerValue>;

export interface Session {
  attemptId: string;
  examId: string;
  mode: 'full' | 'retry';
  questionIds: string[];
  answers: Answers;
  flags: string[];
  currentIndex: number;
  durationSec: number;
  remainingSec: number;
  startedAt: string;
  retryOf?: string;
}

export interface ScoreSnapshot {
  points: number;
  maxPoints: number;
  percentage: number;
  grade: number;
  passed: boolean;
  ungradedOpen: number;
}

export interface Attempt {
  id: string;
  examId: string;
  examLabel: string;
  mode: 'full' | 'retry';
  retryOf?: string;
  questionIds: string[];
  answers: Answers;
  flags: string[];
  selfScores: Record<string, number>;
  startedAt: string;
  submittedAt: string;
  durationSec: number;
  timeUsedSec: number;
  autoSubmitted: boolean;
  score: ScoreSnapshot;
}
