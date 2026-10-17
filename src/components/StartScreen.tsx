import { useState } from 'react';
import { useI18n } from '../i18n';
import { courseShortName, examLabel, getExam, isPredictedId, keyKind, loadExams } from '../lib/exams';
import { fmtClock } from '../lib/format';
import { loadPredictedExams, storageBlocked } from '../lib/storage';
import { blueprintFor } from '../predict/courses';
import type { Attempt, Exam, Session } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Modal } from './Modal';
import { PredictedPanel } from './PredictedPanel';

interface Props {
  attempts: Attempt[];
  session: Session | null;
  onResume: () => void;
  onDiscard: () => void;
  onClearAll: () => void;
  onGenerate: (courseCode: string) => void;
  generating: boolean;
  generateError: boolean;
}

function best(attempts: Attempt[], exam: Exam): Attempt | undefined {
  return attempts
    .filter((a) => a.examId === exam.id && a.mode === 'full')
    .sort((a, b) => b.score.grade - a.score.grade || b.score.points - a.score.points)[0];
}

export function StartScreen({ attempts, session, onResume, onDiscard, onClearAll, onGenerate, generating, generateError }: Props) {
  const { t, tn, rich, fmt } = useI18n();
  const { exams, problems } = loadExams();
  // In-page confirmations (browser confirm() dialogs are blocked in some embedded viewers).
  const [ask, setAsk] = useState<'discard' | 'clear' | null>(null);
  const predicted = loadPredictedExams();
  const sessionExam = session ? (isPredictedId(session.examId) ? getExam(session.examId) : exams.find((e) => e.id === session.examId)) : undefined;
  // Labels in the active language for predicted exams (attempts store an English label).
  const labelOf = (examId: string, stored: string) => {
    const e = isPredictedId(examId) ? getExam(examId) : undefined;
    return e?.prediction ? `${courseShortName(e.courseName)} · ${t('predict.label')}` : stored;
  };
  const courses = [...new Set(exams.map((e) => `${e.courseCode}|${e.courseName}`))];
  const history = [...attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const keyLabel = { Official: t('key.official'), 'AI-solved': t('key.ai'), Mixed: t('key.mixed'), Generated: t('key.generated') };

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            PreGame<small>{t('start.tagline')}</small>
          </span>
          <div className="spacer" />
          <LanguageSwitcher />
        </div>
      </div>
      <div className="page">
        {storageBlocked() && (
          <div className="banner bad" data-testid="storage-blocked">
            <strong>{t('storage.blocked.title')}</strong> {t('storage.blocked.body')}
          </div>
        )}
        {session && sessionExam && (
          <div className="banner warn" data-testid="resume-banner">
            <div className="row">
              <div>{rich(session.mode === 'retry' ? 'start.inProgressRetry' : 'start.inProgress', { exam: labelOf(sessionExam.id, examLabel(sessionExam)), time: fmtClock(session.remainingSec) })}</div>
              <div className="spacer" />
              <button className="btn primary" onClick={onResume} data-testid="resume">
                {t('common.resume')}
              </button>
              <button className="btn" onClick={() => setAsk('discard')} data-testid="discard">
                {t('common.discard')}
              </button>
            </div>
          </div>
        )}

        {problems.length > 0 && (
          <div className="banner bad">
            <strong>{t('start.fileProblems')}</strong>
            <ul>
              {problems.map((p) => (
                <li key={p.file}>
                  <code>{p.file}</code>: {p.errors.slice(0, 5).join('; ')}
                  {p.errors.length > 5 && ` ${t('start.moreProblems', { n: p.errors.length - 5 })}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {courses.map((c) => {
          const [code, name] = c.split('|');
          const list = exams.filter((e) => e.courseCode === code && e.courseName === name);
          const bp = blueprintFor(code);
          return (
            <section className="card" key={c}>
              <h2>
                {name} <span className="muted small">{code}</span>
              </h2>
              {bp && (
                <PredictedPanel
                  blueprint={bp}
                  predicted={predicted.filter((e) => e.courseCode === code)}
                  attempts={attempts}
                  generating={generating}
                  error={generateError}
                  onGenerate={() => onGenerate(code)}
                />
              )}
              <div className="table-wrap">
                <table className="list" data-testid="exam-table">
                  <thead>
                    <tr>
                      <th>{t('start.col.year')}</th>
                      <th>{t('start.col.exam')}</th>
                      <th>{t('start.col.type')}</th>
                      <th className="num">{t('start.col.questions')}</th>
                      <th className="num">{t('start.col.duration')}</th>
                      <th>{t('start.col.key')}</th>
                      <th className="num">{t('start.col.best')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => {
                      const b = best(attempts, e);
                      const n = attempts.filter((a) => a.examId === e.id).length;
                      const kind = keyKind(e);
                      return (
                        <tr key={e.id} data-testid={`exam-row-${e.id}`}>
                          <td data-label={t('start.col.year')}>{e.academicYear}</td>
                          <td data-label={t('start.col.exam')}>{e.title}</td>
                          <td data-label={t('start.col.type')}>
                            {e.examType === 'resit' ? t('examType.resit') : t('examType.regular')}
                            {e.examTypeAssumed && <span className="muted small"> {t('common.assumed')}</span>}
                          </td>
                          <td className="num" data-label={t('start.col.questions')}>
                            {fmt.num(e.questions.length)}
                          </td>
                          <td className="num" data-label={t('start.col.duration')}>
                            {fmt.minutes(e.durationMinutes, 'short')}
                            {e.durationSource === 'assumed' && (
                              <span className="muted small" title={t('start.durationAssumed')}>
                                {' '}
                                *
                              </span>
                            )}
                          </td>
                          <td data-label={t('start.col.key')}>
                            <span className={`pill ${kind === 'Official' ? 'official' : kind === 'AI-solved' ? 'ai' : 'mixed'}`}>{keyLabel[kind]}</span>
                          </td>
                          <td className="num" data-label={t('start.col.best')} data-testid="best-score">
                            {b ? (
                              <>
                                {fmt.grade(b.score.grade)}{' '}
                                <span className="muted small">
                                  ({fmt.points(b.score.points)}/{fmt.points(b.score.maxPoints)})
                                </span>
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                            {n > 0 && <div className="muted small">{tn('start.attempts', n)}</div>}
                          </td>
                          <td className="num">
                            <a className="btn primary small" href={`#/start/${e.id}`} data-testid={`start-${e.id}`}>
                              {t('common.start')}
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ marginBottom: 0 }}>
                {t('start.legend.assumed')} {t('start.legend.key')} <span className="pill official">{keyLabel.Official}</span> {t('start.legend.official')},{' '}
                <span className="pill ai">{keyLabel['AI-solved']}</span> {t('start.legend.ai')}, <span className="pill mixed">{keyLabel.Mixed}</span>{' '}
                {t('start.legend.mixed')}.
              </p>
            </section>
          );
        })}

        <section className="card">
          <h2>{t('start.history')}</h2>
          {history.length === 0 ? (
            <p className="muted">{t('start.historyEmpty')}</p>
          ) : (
            <div className="table-wrap">
              <table className="list" data-testid="history">
                <thead>
                  <tr>
                    <th>{t('start.col.date')}</th>
                    <th>{t('start.col.exam')}</th>
                    <th>{t('start.col.mode')}</th>
                    <th className="num">{t('start.col.score')}</th>
                    <th className="num">{t('start.col.grade')}</th>
                    <th>{t('start.col.result')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => (window.location.hash = `#/results/${a.id}`)}>
                      <td>{fmt.date(a.submittedAt)}</td>
                      <td>
                        <a href={`#/results/${a.id}`}>{labelOf(a.examId, a.examLabel)}</a>
                      </td>
                      <td>{a.mode === 'full' ? t('start.modeFull') : tn('start.modeRetry', a.questionIds.length)}</td>
                      <td className="num">
                        {fmt.points(a.score.points)} / {fmt.points(a.score.maxPoints)}
                      </td>
                      <td className="num">{fmt.grade(a.score.grade)}</td>
                      <td>
                        <span className={a.score.passed ? 'pill pass' : 'pill fail'}>{a.score.passed ? t('common.pass') : t('common.fail')}</span>
                        {a.score.ungradedOpen > 0 && <span className="pill neutral"> {tn('start.toMark', a.score.ungradedOpen)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="row small muted">
          <span>{t('start.storedLocally')}</span>
          <div className="spacer" />
          {(history.length > 0 || session) && (
            <button className="btn small" onClick={() => setAsk('clear')} data-testid="clear-data">
              {t('start.clearData')}
            </button>
          )}
        </div>
      </div>

      {ask && (
        <Modal
          title={ask === 'discard' ? t('start.discardTitle') : t('start.clearTitle')}
          onClose={() => setAsk(null)}
          testId="confirm-dialog"
          footer={
            <>
              <button className="btn" onClick={() => setAsk(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn danger"
                data-testid="confirm-yes"
                onClick={() => {
                  if (ask === 'discard') onDiscard();
                  else onClearAll();
                  setAsk(null);
                }}
              >
                {ask === 'discard' ? t('start.discardYes') : t('start.clearYes')}
              </button>
            </>
          }
        >
          <p>{ask === 'discard' ? t('start.discardBody') : t('start.clearBody')}</p>
        </Modal>
      )}
    </>
  );
}
