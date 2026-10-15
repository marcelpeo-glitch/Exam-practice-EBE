import type { Exam, Question } from '../types';

const TYPES = ['single-choice', 'multi-select', 'numeric', 'open', 'matching'];

/** Structural checks for an exam file. Returns human-readable problems (empty = OK). */
export function validateExam(exam: Exam, imageExists?: (src: string) => boolean): string[] {
  const errs: string[] = [];
  const req = ['id', 'courseCode', 'courseName', 'academicYear', 'examType', 'title', 'durationMinutes', 'questions'] as const;
  for (const k of req) if ((exam as unknown as Record<string, unknown>)[k] === undefined) errs.push(`missing "${k}"`);
  if (!Array.isArray(exam.questions)) return errs;
  if (!['regular', 'resit'].includes(exam.examType)) errs.push(`examType must be "regular" or "resit"`);
  if (!(exam.durationMinutes > 0)) errs.push('durationMinutes must be > 0');
  const ids = new Set<string>();
  const img = (src: string | undefined, where: string) => {
    if (src && imageExists && !imageExists(src)) errs.push(`${where}: image not found: ${src}`);
  };
  exam.resources?.forEach((r) => img(r.src, `resource "${r.title}"`));
  exam.questions.forEach((q: Question, i) => {
    const w = `question ${q.number ?? i + 1}`;
    if (!q.id) errs.push(`${w}: missing id`);
    if (ids.has(q.id)) errs.push(`${w}: duplicate id ${q.id}`);
    ids.add(q.id);
    if (!TYPES.includes(q.type)) errs.push(`${w}: unknown type ${q.type}`);
    if (typeof q.stem !== 'string') errs.push(`${w}: missing stem`);
    if (!(q.points > 0)) errs.push(`${w}: points must be > 0`);
    if (!q.topic) errs.push(`${w}: missing topic`);
    if (!['official', 'ai'].includes(q.answerSource)) errs.push(`${w}: answerSource must be "official" or "ai"`);
    q.images?.forEach((im) => img(im.src, w));
    q.explanationImages?.forEach((im) => img(im.src, w));
    const optIds = new Set((q.options ?? []).map((o) => o.id));
    q.options?.forEach((o) => img(o.image, `${w} option ${o.id}`));
    switch (q.type) {
      case 'single-choice':
        if (!q.options?.length) errs.push(`${w}: needs options`);
        if (typeof q.correctAnswer !== 'string' || !optIds.has(q.correctAnswer)) errs.push(`${w}: correctAnswer must be one option id`);
        q.alsoAccepted?.forEach((a) => !optIds.has(a) && errs.push(`${w}: alsoAccepted ${a} is not an option`));
        break;
      case 'multi-select':
        if (!q.options?.length) errs.push(`${w}: needs options`);
        if (!Array.isArray(q.correctAnswer) || !q.correctAnswer.every((c) => optIds.has(c))) errs.push(`${w}: correctAnswer must be a list of option ids`);
        break;
      case 'numeric':
        if (q.fields?.length) {
          q.fields.forEach((f) => typeof f.answer !== 'number' && errs.push(`${w}: field ${f.id} needs a numeric answer`));
        } else if (typeof q.correctAnswer !== 'number') errs.push(`${w}: correctAnswer must be a number (or use "fields")`);
        break;
      case 'matching': {
        const cids = new Set((q.choices ?? []).map((c) => c.id));
        const key = (q.correctAnswer ?? {}) as Record<string, string>;
        if (!q.prompts?.length || !q.choices?.length) errs.push(`${w}: needs prompts and choices`);
        q.prompts?.forEach((p) => {
          if (!cids.has(key[p.id])) errs.push(`${w}: correctAnswer for prompt ${p.id} is not a choice id`);
          p.choiceIds?.forEach((c) => !cids.has(c) && errs.push(`${w}: prompt ${p.id} lists unknown choice ${c}`));
          if (p.choiceIds && !p.choiceIds.includes(key[p.id])) errs.push(`${w}: correct choice for prompt ${p.id} is not in its choiceIds`);
        });
        break;
      }
      case 'open':
        if (!q.modelAnswer) errs.push(`${w}: open questions need a modelAnswer`);
        break;
    }
  });
  const sections = new Set(exam.questions.map((q) => q.section ?? ''));
  for (const sec of Object.keys(exam.grading?.passRule?.minSectionPoints ?? {}))
    if (!sections.has(sec)) errs.push(`grading.passRule.minSectionPoints: no question has section "${sec}"`);
  return errs;
}
