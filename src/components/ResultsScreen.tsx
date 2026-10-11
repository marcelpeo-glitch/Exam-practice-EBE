import { useMemo, useState } from 'react';
import { examLabel, resolveImage } from '../lib/exams';
import { fmtDate, fmtDuration, fmtGrade, fmtPoints } from '../lib/format';
import { choiceText, defaultTolerance, numericFields, questionsById, scoreExam, type QuestionScore } from '../lib/scoring';
import type { Attempt, Exam, Question } from '../types';
import { DataTable, Figures } from './QuestionContent';
import { RichText } from './RichText';

interface Props {
  exam: Exam;
  attempt: Attempt;
  onSelfScore: (questionId: string, score: number | undefined) => void;
}

type Filter = 'all' | 'notright' | 'open';

const STATUS_LABEL: Record<QuestionScore['status'], string> = {
  correct: 'Correct',
  partial: 'Partly correct',
  wrong: 'Wrong',
  blank: 'Not answered',
  ungraded: 'Mark it yourself',
};

export function ResultsScreen({ exam, attempt, onSelfScore }: Props) {
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

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="brand">Results</span>
          <div className="spacer" />
          <a className="btn small" href="#/" data-testid="back-overview">
            Back to overview
          </a>
        </div>
      </div>
      <div className="page">
        {attempt.autoSubmitted && (
          <div className="banner warn" data-testid="auto-submitted">
            Time is up: your exam was handed in automatically.
          </div>
        )}
        <section className="card" data-testid="summary">
          <h2>
            {examLabel(exam)}
            {!isFull && <span className="muted small"> · retry of {attempt.questionIds.length} questions</span>}
          </h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            Handed in {fmtDate(attempt.submittedAt)}
          </p>
          <div className="score-grid">
            <div className="stat">
              <div className="k">Points</div>
              <div className="v" data-testid="points">
                {fmtPoints(result.points)} <small>/ {fmtPoints(result.maxPoints)}</small>
              </div>
            </div>
            <div className="stat">
              <div className="k">Percentage</div>
              <div className="v" data-testid="percentage">
                {result.percentage.toFixed(1)}%
              </div>
            </div>
            <div className="stat">
              <div className="k">Grade (out of 10)</div>
              <div className="v" data-testid="grade">
                {fmtGrade(result.grade)}
              </div>
            </div>
            <div className="stat">
              <div className="k">Result</div>
              <div className="v">
                <span className={result.passed ? 'pill pass' : 'pill fail'} style={{ fontSize: 16 }} data-testid="pass-fail">
                  {result.passed ? 'Pass' : 'Fail'}
                </span>
              </div>
            </div>
            <div className="stat">
              <div className="k">Time used</div>
              <div className="v" style={{ fontSize: 20 }} data-testid="time-used">
                {fmtDuration(attempt.timeUsedSec)} <small>of {fmtDuration(attempt.durationSec)}</small>
              </div>
            </div>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Grade = 10 × points ÷ maximum points, rounded to one decimal. {result.passReason}
            {rule && isFull && rule.description && <> {rule.description}</>}
            {rule && !isFull && ' (The exam’s own pass rule only applies to full attempts.)'}
            {result.ungradedOpen > 0 && <strong> {result.ungradedOpen} open question(s) still need your marks below.</strong>}
          </p>
          <div className="row" style={{ marginTop: 14 }}>
            <a className="btn primary" href={`#/start/${exam.id}`} data-testid="retake">
              Retake exam
            </a>
            {notRight.length > 0 ? (
              <a className="btn" href={`#/start/${exam.id}/retry/${attempt.id}`} data-testid="retry-wrong">
                Retry the {notRight.length} question{notRight.length > 1 ? 's' : ''} I got wrong
              </a>
            ) : (
              <button className="btn" disabled>
                No wrong questions to retry
              </button>
            )}
          </div>
        </section>

        {result.bySection.length > 1 && (
          <section className="card">
            <h2>Score per part</h2>
            <div className="table-wrap">
              <table className="list">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th className="num">Points</th>
                    <th className="num">%</th>
                    {rule?.minSectionPoints && isFull && <th className="num">Minimum to pass</th>}
                  </tr>
                </thead>
                <tbody>
                  {result.bySection.map((s) => (
                    <tr key={s.section}>
                      <td>{s.section}</td>
                      <td className="num">
                        {fmtPoints(s.earned)} / {fmtPoints(s.max)}
                      </td>
                      <td className="num">{s.max ? Math.round((100 * s.earned) / s.max) : 0}%</td>
                      {rule?.minSectionPoints && isFull && <td className="num">{rule.minSectionPoints[s.section] ?? '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="card">
          <h2>Score per topic</h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            Weakest topics first.
          </p>
          <div className="table-wrap">
            <table className="list" data-testid="topics">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th className="num">Questions</th>
                  <th className="num">Points</th>
                  <th className="num">%</th>
                  <th className="bar-cell" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {topics.map((t) => {
                  const pct = t.max ? Math.round((100 * t.earned) / t.max) : 0;
                  return (
                    <tr key={t.topic}>
                      <td>{t.topic}</td>
                      <td className="num">{t.count}</td>
                      <td className="num">
                        {fmtPoints(t.earned)} / {fmtPoints(t.max)}
                      </td>
                      <td className="num">{pct}%</td>
                      <td className="bar-cell" title={`${t.topic}: ${pct}%`}>
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
          <h2>Question review</h2>
          <div className="review-tools">
            <button className={filter === 'all' ? 'btn small active' : 'btn small'} onClick={() => setFilter('all')}>
              All ({items.length})
            </button>
            <button className={filter === 'notright' ? 'btn small active' : 'btn small'} onClick={() => setFilter('notright')} data-testid="filter-wrong">
              Not fully correct ({notRight.length})
            </button>
            {hasOpen && (
              <button className={filter === 'open' ? 'btn small active' : 'btn small'} onClick={() => setFilter('open')}>
                Open questions
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
  const a = attempt.answers[q.id];
  const flagged = attempt.flags.includes(q.id);
  return (
    <article className="rq" data-testid={`review-${q.number}`} data-status={r.status}>
      <div className="rq-head">
        <span className="qn">Question {attempt.mode === 'full' ? q.number : `${index + 1} (Q${q.number})`}</span>
        <span className={`status ${r.status}`}>{STATUS_LABEL[r.status]}</span>
        <span className="small">
          {fmtPoints(r.earned)} / {fmtPoints(r.max)} pt
        </span>
        <span className="small muted">
          {q.section ? `${q.section} · ` : ''}
          {q.topic}
        </span>
        {flagged && <span className="pill neutral">Flagged</span>}
        <div className="spacer" />
        {q.answerSource === 'ai' && (
          <span className="pill ai" title="No official answer was available; this answer was solved by AI." data-testid="ai-badge">
            AI-solved, verify
          </span>
        )}
        {q.answerSource === 'official' && q.explanationSource === 'ai' && (
          <span className="pill neutral" title="The answer is official; the explanation was written by AI.">
            Explanation by AI
          </span>
        )}
      </div>
      <div className="rq-body">
        <RichText text={q.stem} />
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
                    {chosen && correct && '✓ Your answer'}
                    {chosen && !correct && '✗ Your answer'}
                    {!chosen && correct && 'Correct answer'}
                  </span>
                  <strong>{o.id}</strong>
                  <span className="otext">
                    {o.text && <RichText as="span" text={o.text} />}
                    {o.image && <img src={resolveImage(o.image)} alt={`Option ${o.id}`} />}
                  </span>
                </div>
              );
            })}
            <dl className="answers-compare">
              <dt>Your answer</dt>
              <dd data-testid="your-answer">{q.type === 'single-choice' ? (typeof a === 'string' ? a : '—') : Array.isArray(a) && a.length ? [...a].sort().join(', ') : '—'}</dd>
              <dt>Correct answer</dt>
              <dd data-testid="correct-answer">
                {q.type === 'single-choice' ? [q.correctAnswer as string, ...(q.alsoAccepted ?? [])].join(' or ') : ((q.correctAnswer as string[]) ?? []).join(', ')}
              </dd>
            </dl>
          </div>
        )}

        {q.type === 'numeric' && (
          <div className="table-wrap">
            <table className="list" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Your answer</th>
                  <th>Correct answer</th>
                </tr>
              </thead>
              <tbody>
                {numericFields(q).map((f) => {
                  const raw = a && typeof a === 'object' && !Array.isArray(a) ? a[f.id] : undefined;
                  const tol = f.tolerance ?? defaultTolerance(f.answer);
                  return (
                    <tr key={f.id}>
                      <td>{f.label ? <RichText as="span" text={f.label} /> : 'Answer'}</td>
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
                          {f.acceptRange ? ` (accepted ${f.acceptRange[0]}–${f.acceptRange[1]})` : tol > 1e-6 ? ` (± ${Number(tol.toPrecision(3))})` : ''}
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
                  <th>Item</th>
                  <th>Your answer</th>
                  <th>Correct answer</th>
                </tr>
              </thead>
              <tbody>
                {q.prompts?.map((p) => {
                  const mine = a && typeof a === 'object' && !Array.isArray(a) ? a[p.id] : undefined;
                  const right = (q.correctAnswer as Record<string, string>)[p.id];
                  return (
                    <tr key={p.id}>
                      <td>
                        <RichText as="span" text={p.text} />
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
            <div className="small muted">Your answer</div>
            <div className="open-answer" data-testid="your-answer">
              {typeof a === 'string' && a.trim() ? a : '—'}
            </div>
            <div className="explain">
              <h4>Model answer</h4>
              <RichText text={q.modelAnswer ?? ''} />
            </div>
            <SelfMark q={q} value={attempt.selfScores[q.id]} onChange={(v) => onSelfScore(q.id, v)} />
          </div>
        )}

        <div className="explain">
          <h4>Explanation</h4>
          <RichText text={q.explanation} />
          <Figures images={q.explanationImages} />
        </div>
        {q.sourceNote && <RichText className="source-note" text={`Note: ${q.sourceNote}`} />}
      </div>
    </article>
  );
}

function SelfMark({ q, value, onChange }: { q: Question; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <div className="self-mark" data-testid={`self-mark-${q.number}`}>
      <strong>Your mark:</strong>
      <input
        type="number"
        min={0}
        max={q.points}
        step={0.5}
        value={value ?? ''}
        placeholder="—"
        aria-label="Points you award yourself"
        data-testid="self-score"
        onChange={(e) => {
          const v = e.target.value === '' ? undefined : Math.max(0, Math.min(q.points, Number(e.target.value)));
          onChange(v === undefined || Number.isNaN(v) ? undefined : v);
        }}
      />
      <span>/ {q.points} points</span>
      <button className="btn small" onClick={() => onChange(0)}>
        0
      </button>
      {q.points > 1 && (
        <button className="btn small" onClick={() => onChange(q.points / 2)}>
          {q.points / 2}
        </button>
      )}
      <button className="btn small" onClick={() => onChange(q.points)}>
        Full
      </button>
    </div>
  );
}
