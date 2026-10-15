import { useState } from 'react';
import { useI18n } from '../i18n';
import { courseShortName, examLabel, keyKind } from '../lib/exams';
import { fmtClock } from '../lib/format';
import { storageBlocked } from '../lib/storage';
import type { Exam, Session } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { RichText } from './RichText';

interface Props {
  exam: Exam;
  questionIds: string[];
  durationMinutes: number;
  mode: 'full' | 'retry';
  otherSession: Session | null;
  otherLabel?: string;
  /** The exam in progress is this very exam: offer to resume it instead of warning about "another exam". */
  resumable: boolean;
  onResume: () => void;
  onStart: () => void;
}

/** The "are you ready to start?" page that precedes the exam, like the TestVision start screen. */
export function ConfirmScreen({ exam, questionIds, durationMinutes, mode, otherSession, otherLabel, resumable, onResume, onStart }: Props) {
  const { t, tn, rich, fmt } = useI18n();
  const [ok, setOk] = useState(false);
  const kind = keyKind(exam);
  const p = exam.prediction;
  const label = p ? `${courseShortName(exam.courseName)} · ${t('predict.label')}` : examLabel(exam);
  const otherName = otherLabel ?? otherSession?.examId ?? '';
  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="brand">Mock TestVision</span>
          <div className="spacer" />
          <LanguageSwitcher />
          <a className="btn small" href="#/">
            {t('common.backToOverview')}
          </a>
        </div>
      </div>
      <div className="page" style={{ maxWidth: 760 }}>
        {resumable && otherSession && (
          <div className="banner warn" data-testid="resume-here-banner">
            <div className="row">
              <div>{rich('confirm.alreadyStarted', { time: fmtClock(otherSession.remainingSec) })}</div>
              <div className="spacer" />
              <button className="btn primary" onClick={onResume} data-testid="resume-here">
                {t('confirm.resumeExam')}
              </button>
            </div>
          </div>
        )}
        {storageBlocked() && (
          <div className="banner bad" data-testid="storage-blocked">
            <strong>{t('storage.blocked.title')}</strong> {t('storage.blocked.body')}
          </div>
        )}
        <section className="card" data-testid="confirm-screen">
          <h2>{mode === 'retry' ? t('confirm.titleRetry') : t('confirm.titleStart')}</h2>
          {p && (
            <div className="banner warn" data-testid="predicted-note">
              <strong>{t('predict.label')}.</strong> {t('predict.note')}
            </div>
          )}
          <dl className="facts">
            <dt>{t('confirm.test')}</dt>
            <dd>
              <strong>{label}</strong>
            </dd>
            <dt>{t('confirm.course')}</dt>
            <dd>
              {exam.courseName} ({exam.courseCode})
            </dd>
            {p ? (
              <>
                <dt>{t('predict.basedOn')}</dt>
                <dd>{tn('predict.basedOnValue', p.basedOn.length, { years: [...p.basedOnYears].reverse().join(', ') })}</dd>
                <dt>{t('predict.generatedLabel')}</dt>
                <dd>{fmt.date(p.generatedAt)}</dd>
              </>
            ) : (
              <>
                <dt>{t('confirm.year')}</dt>
                <dd>{exam.academicYear}</dd>
                <dt>{t('confirm.examType')}</dt>
                <dd>
                  {exam.examType === 'resit' ? t('examType.resit') : t('examType.regular')}
                  {exam.examTypeAssumed && ` ${t('common.assumed')}`}
                </dd>
              </>
            )}
            <dt>{t('confirm.questions')}</dt>
            <dd>
              {mode === 'retry'
                ? t('confirm.questionsRetry', { n: questionIds.length, total: exam.questions.length })
                : p
                  ? t('confirm.questionsSplit', {
                      n: questionIds.length,
                      split: Object.entries(p.split)
                        .map(([sec, n]) => `${sec} ${fmt.num(n)}`)
                        .join(', '),
                    })
                  : fmt.num(questionIds.length)}
            </dd>
            <dt>{t('confirm.time')}</dt>
            <dd data-testid="confirm-duration">
              {fmt.minutes(durationMinutes)}
              {mode === 'retry' && ` ${t('confirm.timeScaled')}`}
              {exam.durationSource === 'assumed' && mode === 'full' && <span className="muted"> {t('confirm.timeAssumed')}</span>}
            </dd>
            <dt>{t('confirm.aids')}</dt>
            <dd>{exam.resources?.length ? t('confirm.aidsCalcSheets') : t('confirm.aidsCalc')}</dd>
            <dt>{t('confirm.key')}</dt>
            <dd>
              {kind === 'Generated'
                ? t('predict.keyGenerated')
                : kind === 'Official'
                  ? t('confirm.keyOfficial')
                  : kind === 'AI-solved'
                    ? t('confirm.keyAi')
                    : t('confirm.keyMixed')}
            </dd>
          </dl>
          {exam.notes && exam.notes.length > 0 && (
            <ul className="small muted" lang="en">
              {exam.notes.map((n, i) => (
                <li key={i}>
                  <RichText as="span" text={n} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>{t('confirm.instructions')}</h2>
          <ul>
            <li>{rich('confirm.i1', { start: t('common.start') })}</li>
            <li>{rich('confirm.i2', { prev: t('exam.previous'), next: t('exam.next'), flag: t('exam.flag') })}</li>
            <li>{t('confirm.i3')}</li>
            <li>{t('confirm.i4')}</li>
            <li>{rich('confirm.i5', { ready: t('exam.ready') })}</li>
          </ul>
          {otherSession && !resumable && (
            <div className="banner warn">
              {t(otherSession.mode === 'retry' ? 'confirm.otherInProgressRetry' : 'confirm.otherInProgress', { exam: otherName })}
            </div>
          )}
          {resumable && <div className="small muted">{t('confirm.startAgainWarning')}</div>}
          <label className="row" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid="confirm-check" />
            {t('confirm.readyCheck')}
          </label>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" disabled={!ok} onClick={onStart} data-testid="start-exam">
              {resumable ? t('confirm.startOver') : t('common.start')}
            </button>
            <a className="btn" href="#/">
              {t('common.cancel')}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
