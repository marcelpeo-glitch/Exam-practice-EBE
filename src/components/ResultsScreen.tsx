import { useMemo, useState } from 'react';
import { useI18n, type I18n } from '../i18n';
import type { TextKey } from '../i18n/ui-en';
import { courseShortName, examLabel, resolveImage } from '../lib/exams';
import { choiceText, defaultTolerance, numericFields, questionsById, scoreExam, type PassCheck, type QuestionScore } from '../lib/scoring';
import type { Attempt, Exam, Question } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { DataTable, Figures } from './QuestionContent';
import { RichText } from './RichText';

interface Props {
  exam: Exam;
  attempt: Attempt;
  onSelfScore: (questionId: string, score: number | undefined) => void;
  /** Generate a new predicted exam (shown for predicted exams). */
  onGenerate?: () => void;
  generating?: boolean;
}

type Filter = 'all' | 'notright' | 'open';

const STATUS_LABEL: Record<QuestionScore['status'], TextKey> = {
  correct: 'status.correct',
  partial: 'status.partial',
  wrong: 'status.wrong',
  blank: 'status.blank',
  ungraded: 'status.ungraded',
};

function passText({ t, fmt }: I18n, check: PassCheck): string {
  if (check.kind === 'grade') return t('results.passIfGrade', { grade: fmt.grade(check.passGrade) });
  if (!check.failures.length) return t('results.meetsRule');
  const reasons = check.failures.map((f) =>
    f.kind === 'minPoints'
      ? t('results.fail.minPoints', { n: f.min })
      : f.kind === 'minPercentage'
        ? t('results.fail.minPercentage', { n: fmt.percent(f.min) })
        : t('results.fail.minSection', { n: f.min, section: f.section }),
  );
  return t('results.failsRule', { reasons: reasons.join('; ') });
}

export function ResultsScreen({ exam, attempt, onSelfScore, onGenerate, generating }: Props) {
  const i18n = useI18n();
  const { t, tn, fmt } = i18n;
  const [filter, setFilter] = useState<Filter>('all');
  const result = useMemo(() => scoreExam(exam, attempt.questionIds, attempt.answers, attempt.selfScores, attempt.mode), [exam, attempt]);
  const byId = useMemo(() => questionsById(exam), [exam]);
  const items = attempt.questionIds
    .map((id, i) => ({ q: byId.get(id), r: result.perQuestion.find((p) => p.questionId === id), i }))
    .filter((x): x is { q: Question; r: QuestionScore; i: number } => !!x.q && !!x.r);
  const notRight = items.filter((x) => x.r.status !== 'correct');
  const shown = items.filter((x) => (filter === 'all' ? true : filter === 'notright' ? x.r.status !== 'correct' : x.q.type === 'open'));
  const hasOpen = items.some((x) => x.q.type === 'open');
  const topics = [...result.byTopic].sort((a, b) => a.earned / a.max - b.earned / b.max || a.topic.localeCompare(b.topic));
  const isFull = attempt.mode === 'full';
  const rule = exam.grading?.passRule;
  const label = exam.prediction ? `${courseShortName(exam.courseName)} · ${t('predict.label')}` : examLabel(exam);

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="brand">{t('results.title')}</span>
          <div className="spacer" />
          <LanguageSwitcher />
          <a className="btn small" href="#/" data-testid="back-overview">
            {t('common.backToOverview')}
          </a>
        </div>
      </div>
      <div className="page">
        {attempt.autoSubmitted && (
          <div className="banner warn" data-testid="auto-submitted">
            {t('results.autoSubmitted')}
          </div>
        )}
        {exam.prediction && (
          <div className="banner warn" data-testid="predicted-note">
            <strong>{t('predict.label')}.</strong> {t('predict.note')}
          </div>
        )}
        <section className="card" data-testid="summary">
          <h2>
            {label}
            {!isFull && <span className="muted small"> · {tn('common.retryOfN', attempt.questionIds.length)}</span>}
          </h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            {t('results.handedIn', { date: fmt.date(attempt.submittedAt) })}
          </p>
          <div className="score-grid">
            <div className="stat">
              <div className="k">{t('results.points')}</div>
              <div className="v" data-testid="points">
                {fmt.points(result.points)} <small>/ {fmt.points(result.maxPoints)}</small>
              </div>
            </div>
            <div className="stat">
              <div className="k">{t('results.percentage')}</div>
              <div className="v" data-testid="percentage">
                {fmt.percent(result.percentage, 1)}
              </div>
            </div>
            <div className="stat">
              <div className="k">{t('results.grade')}</div>
              <div className="v" data-testid="grade">
                {fmt.grade(result.grade)}
              </div>
            </div>
            <div className="stat">
              <div className="k">{t('results.result')}</div>
              <div className="v">
                <span className={result.passed ? 'pill pass' : 'pill fail'} style={{ fontSize: 16 }} data-testid="pass-fail">
                  {result.passed ? t('common.pass') : t('common.fail')}
                </span>
              </div>
            </div>
            {result.bySection.length > 1 &&
              result.bySection.map((sec) => (
                <div className="stat" key={sec.section} data-testid={`section-score-${sec.section}`}>
                  <div className="k" lang="en">
                    {sec.section || t('exam.questions')}
                  </div>
                  <div className="v">
                    {fmt.points(sec.earned)} <small>/ {fmt.points(sec.max)}</small>
                  </div>
                  <div className="small muted">{fmt.percent(sec.max ? (100 * sec.earned) / sec.max : 0)}</div>
                </div>
              ))}
            <div className="stat">
              <div className="k">{t('results.timeUsed')}</div>
              <div className="v" style={{ fontSize: 20 }} data-testid="time-used">
                {fmt.duration(attempt.timeUsedSec)} <small>{t('results.ofDuration', { duration: fmt.duration(attempt.durationSec) })}</small>
              </div>
            </div>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {t('results.gradeRule')} {passText(i18n, result.passCheck)}
            {rule && isFull && rule.description && <span lang="en"> {rule.description}</span>}
            {rule && !isFull && ` ${t('results.ruleFullOnly')}`}
            {result.ungradedOpen > 0 && <strong> {tn('results.toMark', result.ungradedOpen)}</strong>}
          </p>
          <div className="row" style={{ marginTop: 14 }}>
            <a className="btn primary" href={`#/start/${exam.id}`} data-testid="retake">
              {t('results.retake')}
            </a>
            {notRight.length > 0 ? (
              <a className="btn" href={`#/start/${exam.id}/retry/${attempt.id}`} data-testid="retry-wrong">
                {tn('results.retryWrong', notRight.length)}
              </a>
            ) : (
              <button className="btn" disabled>
                {t('results.noWrong')}
              </button>
            )}
            {exam.prediction && onGenerate && (
              <button className="btn" onClick={onGenerate} disabled={generating} data-testid="generate-again">
                {generating ? t('predict.generating') : t('predict.newOne')}
              </button>
            )}
          </div>
        </section>

        {result.bySection.length > 1 && (
          <section className="card">
            <h2>{t('results.perPart')}</h2>
            <div className="table-wrap">
              <table className="list">
                <thead>
                  <tr>
                    <th>{t('results.col.part')}</th>
                    <th className="num">{t('results.col.points')}</th>
                    <th className="num">{t('results.col.pct')}</th>
                    {rule?.minSectionPoints && isFull && <th className="num">{t('results.col.minPass')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {result.bySection.map((s) => (
                    <tr key={s.section}>
                      <td lang="en">{s.section || t('exam.questions')}</td>
                      <td className="num">
                        {fmt.points(s.earned)} / {fmt.points(s.max)}
                      </td>
                      <td className="num">{fmt.percent(s.max ? (100 * s.earned) / s.max : 0)}</td>
                      {rule?.minSectionPoints && isFull && <td className="num">{rule.minSectionPoints[s.section] !== undefined ? fmt.points(rule.minSectionPoints[s.section]) : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="card">
          <h2>{t('results.perTopic')}</h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            {t('results.weakestFirst')}
          </p>
          <div className="table-wrap">
            <table className="list" data-testid="topics">
              <thead>
                <tr>
                  <th>{t('results.col.topic')}</th>
                  <th className="num">{t('results.col.questions')}</th>
                  <th className="num">{t('results.col.points')}</th>
                  <th className="num">{t('results.col.pct')}</th>
                  <th className="bar-cell" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {topics.map((tp) => {
                  const pct = tp.max ? Math.round((100 * tp.earned) / tp.max) : 0;
                  return (
                    <tr key={tp.topic}>
                      <td lang="en">{tp.topic}</td>
                      <td className="num">{fmt.num(tp.count)}</td>
                      <td className="num">
                        {fmt.points(tp.earned)} / {fmt.points(tp.max)}
                      </td>
                      <td className="num">{fmt.percent(pct)}</td>
                      <td className="bar-cell" title={`${tp.topic}: ${fmt.percent(pct)}`}>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>{t('results.review')}</h2>
          <div className="review-tools">
            <button className={filter === 'all' ? 'btn small active' : 'btn small'} onClick={() => setFilter('all')}>
              {t('results.filter.all', { n: items.length })}
            </button>
            <button className={filter === 'notright' ? 'btn small active' : 'btn small'} onClick={() => setFilter('notright')} data-testid="filter-wrong">
              {t('results.filter.notRight', { n: notRight.length })}
            </button>
            {hasOpen && (
              <button className={filter === 'open' ? 'btn small active' : 'btn small'} onClick={() => setFilter('open')}>
                {t('results.filter.open')}
              </button>
            )}
          </div>
          {shown.map(({ q, r, i }) => (
            <ReviewItem key={q.id} q={q} r={r} index={i} attempt={attempt} onSelfScore={onSelfScore} />
          ))}
        </section>
      </div>
    </>
  );
}

function ReviewItem({ q, r, index, attempt, onSelfScore }: { q: Question; r: QuestionScore; index: number; attempt: Attempt; onSelfScore: Props['onSelfScore'] }) {
  const { t, fmt } = useI18n();
  const a = attempt.answers[q.id];
  const flagged = attempt.flags.includes(q.id);
  return (
    <article className="rq" data-testid={`review-${q.number}`} data-status={r.status}>
      <div className="rq-head">
        <span className="qn">{attempt.mode === 'full' ? t('review.questionN', { n: q.number }) : t('review.questionRetry', { n: index + 1, orig: q.number })}</span>
        <span className={`status ${r.status}`}>{t(STATUS_LABEL[r.status])}</span>
        <span className="small">{t('review.pts', { earned: fmt.points(r.earned), max: fmt.points(r.max) })}</span>
        <span className="small muted" lang="en">
          {q.section ? `${q.section} · ` : ''}
          {q.topic}
        </span>
        {flagged && <span className="pill neutral">{t('exam.flagged')}</span>}
        <div className="spacer" />
        {q.answerSource === 'ai' && (
          <span className="pill ai" title={t('review.aiBadgeTitle')} data-testid="ai-badge">
            {t('review.aiBadge')}
          </span>
        )}
        {q.answerSource === 'generated' && (
          <span className="pill official" title={t('review.generatedBadgeTitle')} data-testid="generated-badge">
            {t('review.generatedBadge')}
          </span>
        )}
        {q.answerSource === 'official' && q.explanationSource === 'ai' && (
          <span className="pill neutral" title={t('review.aiExplanationTitle')}>
            {t('review.aiExplanation')}
          </span>
        )}
      </div>
      <div className="rq-body">
        <RichText text={q.stem} lang="en" />
        <DataTable table={q.table} />
        <Figures images={q.images} />

        {(q.type === 'single-choice' || q.type === 'multi-select') && (
          <div style={{ marginTop: 8 }}>
            {q.options?.map((o) => {
              const correct = q.type === 'single-choice' ? o.id === q.correctAnswer || (q.alsoAccepted ?? []).includes(o.id) : ((q.correctAnswer as string[]) ?? []).includes(o.id);
              const chosen = q.type === 'single-choice' ? a === o.id : Array.isArray(a) && a.includes(o.id);
              const cls = correct ? 'ropt is-correct' : chosen ? 'ropt is-chosen-wrong' : 'ropt';
              return (
                <div key={o.id} className={cls}>
                  <span className="mark">
                    {chosen && correct && t('review.yourAnswerRight')}
                    {chosen && !correct && t('review.yourAnswerWrong')}
                    {!chosen && correct && t('review.correctAnswer')}
                  </span>
                  <strong>{o.id}</strong>
                  <span className="otext" lang="en">
                    {o.text && <RichText as="span" text={o.text} />}
                    {o.image && <img src={resolveImage(o.image)} alt={t('answer.optionAlt', { id: o.id })} />}
                  </span>
                </div>
              );
            })}
            <dl className="answers-compare">
              <dt>{t('review.yourAnswer')}</dt>
              <dd data-testid="your-answer">{q.type === 'single-choice' ? (typeof a === 'string' ? a : '—') : Array.isArray(a) && a.length ? [...a].sort().join(', ') : '—'}</dd>
              <dt>{t('review.correctAnswer')}</dt>
              <dd data-testid="correct-answer">
                {q.type === 'single-choice' ? fmt.or([q.correctAnswer as string, ...(q.alsoAccepted ?? [])]) : ((q.correctAnswer as string[]) ?? []).join(', ')}
              </dd>
            </dl>
          </div>
        )}

        {q.type === 'numeric' && (
          <div className="table-wrap">
            <table className="list" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>{t('review.field')}</th>
                  <th>{t('review.yourAnswer')}</th>
                  <th>{t('review.correctAnswer')}</th>
                </tr>
              </thead>
              <tbody>
                {numericFields(q).map((f) => {
                  const raw = a && typeof a === 'object' && !Array.isArray(a) ? a[f.id] : undefined;
                  const tol = f.tolerance ?? defaultTolerance(f.answer);
                  return (
                    <tr key={f.id}>
                      <td>{f.label ? <RichText as="span" text={f.label} lang="en" /> : t('review.answer')}</td>
                      <td data-testid="your-answer">
                        {f.prefix ? `${f.prefix} ` : ''}
                        {raw?.trim() || '—'}
                        {f.suffix ? ` ${f.suffix}` : ''}
                      </td>
                      <td data-testid="correct-answer">
                        {f.prefix ? `${f.prefix} ` : ''}
                        {f.answer}
                        {f.suffix ? ` ${f.suffix}` : ''}
                        <span className="muted small">
                          {f.acceptRange ? ` ${t('review.accepted', { from: String(f.acceptRange[0]), to: String(f.acceptRange[1]) })}` : tol > 1e-6 ? ` (± ${Number(tol.toPrecision(3))})` : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {q.type === 'matching' && (
          <div className="table-wrap">
            <table className="list" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>{t('review.item')}</th>
                  <th>{t('review.yourAnswer')}</th>
                  <th>{t('review.correctAnswer')}</th>
                </tr>
              </thead>
              <tbody>
                {q.prompts?.map((p) => {
                  const mine = a && typeof a === 'object' && !Array.isArray(a) ? a[p.id] : undefined;
                  const right = (q.correctAnswer as Record<string, string>)[p.id];
                  return (
                    <tr key={p.id}>
                      <td>
                        <RichText as="span" text={p.text} lang="en" />
                      </td>
                      <td style={{ color: mine ? (mine === right ? 'var(--ok)' : 'var(--bad)') : undefined }}>{choiceText(q, mine) ?? '—'}</td>
                      <td>{choiceText(q, right)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {q.type === 'open' && (
          <div style={{ marginTop: 10 }}>
            <div className="small muted">{t('review.yourAnswer')}</div>
            <div className="open-answer" data-testid="your-answer">
              {typeof a === 'string' && a.trim() ? a : '—'}
            </div>
            <div className="explain">
              <h4>{t('review.modelAnswer')}</h4>
              <RichText text={q.modelAnswer ?? ''} lang="en" />
            </div>
            <SelfMark q={q} value={attempt.selfScores[q.id]} onChange={(v) => onSelfScore(q.id, v)} />
          </div>
        )}

        <div className="explain">
          <h4>{q.answerSource === 'generated' ? t('review.workedSolution') : t('review.explanation')}</h4>
          <RichText text={q.explanation} lang="en" />
          <Figures images={q.explanationImages} />
        </div>
        {q.sourceNote && (
          <div className="rich source-note">
            <strong>{t('review.note')}</strong> <RichText as="span" text={q.sourceNote} lang="en" />
          </div>
        )}
      </div>
    </article>
  );
}

function SelfMark({ q, value, onChange }: { q: Question; value: number | undefined; onChange: (v: number | undefined) => void }) {
  const { t, tn, fmt } = useI18n();
  return (
    <div className="self-mark" data-testid={`self-mark-${q.number}`}>
      <strong>{t('selfMark.yourMark')}</strong>
      <input
        type="number"
        min={0}
        max={q.points}
        step={0.5}
        value={value ?? ''}
        placeholder="—"
        aria-label={t('selfMark.aria')}
        data-testid="self-score"
        onChange={(e) => {
          const v = e.target.value === '' ? undefined : Math.max(0, Math.min(q.points, Number(e.target.value)));
          onChange(v === undefined || Number.isNaN(v) ? undefined : v);
        }}
      />
      <span>{tn('selfMark.outOf', q.points)}</span>
      <button className="btn small" onClick={() => onChange(0)}>
        0
      </button>
      {q.points > 1 && (
        <button className="btn small" onClick={() => onChange(q.points / 2)}>
          {fmt.num(q.points / 2)}
        </button>
      )}
      <button className="btn small" onClick={() => onChange(q.points)}>
        {t('selfMark.full')}
      </button>
    </div>
  );
}
