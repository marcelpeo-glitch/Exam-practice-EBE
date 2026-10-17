import type { Question, TableData } from '../types';
import type { Rng } from './rng';

export const SECTIONS = ['Mathematics', 'Statistics'] as const;
export type Section = (typeof SECTIONS)[number];

/** The topic tags used in data/exams (EXTRACTION_REPORT.md), per section. */
export const TOPICS = {
  Mathematics: [
    'Functions & domains',
    'Derivatives',
    'Inverse functions',
    'Elasticity',
    'Economic applications',
    'Monotonicity, convexity & extremes',
    'Exponential & logistic growth',
    'Two variables: partial derivatives & level curves',
    'Two variables: stationary points',
  ],
  Statistics: [
    'Data & displays',
    'Describing distributions',
    'Probability',
    'Random variables & binomial',
    'Normal model',
    'Sampling & study design',
    'Sampling distributions',
    'Confidence intervals',
    'Hypothesis tests',
    'Errors & power',
  ],
} as const;
export type Topic = (typeof TOPICS)[Section][number];

export const sectionOf = (topic: string): Section => ((TOPICS.Mathematics as readonly string[]).includes(topic) ? 'Mathematics' : 'Statistics');

/** Question types the generator produces (open questions never appear in the past QM1 exams). */
export const GEN_TYPES = ['single-choice', 'numeric', 'multi-select', 'matching'] as const;
export type GenType = (typeof GEN_TYPES)[number];

export type Difficulty = 1 | 2 | 3;

export interface GenContext {
  rng: Rng;
  /** The question type to produce (always one of the template's `types`). */
  type: GenType;
  /** Number of options for single-choice/multi-select questions (4 or 5, as in the past exams). */
  optionCount: number;
}

/**
 * What a template returns: a question without the bookkeeping fields (id, number, section, topic, points and the
 * answer source are filled in by the exam assembler). `explanation` is the full worked solution (Markdown + KaTeX).
 */
export type Generated = Omit<Question, 'id' | 'number' | 'section' | 'topic' | 'points' | 'answerSource' | 'explanationSource' | 'type'> & {
  type: GenType;
  explanation: string;
  table?: TableData;
};

export interface Template {
  /** Unique, stable id, e.g. "derivatives.quotient-rule". */
  id: string;
  topic: Topic;
  /** Short description of what is asked (shown in the blueprint report, not to students). */
  title: string;
  /** Question types this template can produce. */
  types: readonly GenType[];
  /** 1 = routine, 2 = standard exam question, 3 = harder (multi-step). */
  difficulty: Difficulty;
  generate(ctx: GenContext): Generated;
}
