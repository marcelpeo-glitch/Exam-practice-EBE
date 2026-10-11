import { useState } from 'react';
import { examLabel, keyKind } from '../lib/exams';
import { fmtClock } from '../lib/format';
import { storageBlocked } from '../lib/storage';
import type { Exam, Session } from '../types';
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
  const [ok, setOk] = useState(false);
  const kind = keyKind(exam);
  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="brand">Mock TestVision</span>
          <div className="spacer" />
          <a className="btn small" href="#/">
            Back to overview
          </a>
        </div>
      </div>
      <div className="page" style={{ maxWidth: 760 }}>
        {resumable && otherSession && (
          <div className="banner warn" data-testid="resume-here-banner">
            <div className="row">
              <div>
                <strong>You already started this exam</strong> ({fmtClock(otherSession.remainingSec)} left). Your answers are saved.
              </div>
              <div className="spacer" />
              <button className="btn primary" onClick={onResume} data-testid="resume-here">
                Resume exam
              </button>
            </div>
          </div>
        )}
        {storageBlocked() && (
          <div className="banner bad" data-testid="storage-blocked">
            <strong>This browser blocks saving.</strong> The exam still works in this tab, but your answers and history are lost if you reload or close it.
          </div>
        )}
        <section className="card" data-testid="confirm-screen">
          <h2>{mode === 'retry' ? 'Retry wrong questions' : 'Start exam'}</h2>
          <dl className="facts">
            <dt>Test</dt>
            <dd>
              <strong>{examLabel(exam)}</strong>
            </dd>
            <dt>Course</dt>
            <dd>
              {exam.courseName} ({exam.courseCode})
            </dd>
            <dt>Academic year</dt>
            <dd>{exam.academicYear}</dd>
            <dt>Exam type</dt>
            <dd>
              {exam.examType === 'resit' ? 'Resit' : 'Regular'}
              {exam.examTypeAssumed && ' (assumed)'}
            </dd>
            <dt>Questions</dt>
            <dd>{mode === 'retry' ? `${questionIds.length} of ${exam.questions.length} (the ones you did not get fully right)` : questionIds.length}</dd>
            <dt>Time</dt>
            <dd data-testid="confirm-duration">
              {durationMinutes} minutes
              {mode === 'retry' && ' (scaled to the number of questions)'}
              {exam.durationSource === 'assumed' && mode === 'full' && <span className="muted"> (not stated in the source, assumed)</span>}
            </dd>
            <dt>Allowed aids</dt>
            <dd>Built-in calculator{exam.resources?.length ? ', formula sheets and tables' : ''}</dd>
            <dt>Answer key</dt>
            <dd>
              {kind === 'Official' ? 'Official' : kind === 'AI-solved' ? 'Solved by AI (no official key available)' : 'Mostly official, some answers solved by AI'}
            </dd>
          </dl>
          {exam.notes && exam.notes.length > 0 && (
            <ul className="small muted">
              {exam.notes.map((n, i) => (
                <li key={i}>
                  <RichText as="span" text={n} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Instructions</h2>
          <ul>
            <li>The timer starts as soon as you click <strong>Start</strong>. When it reaches zero, the exam is handed in automatically.</li>
            <li>Navigate with <strong>Previous</strong>/<strong>Next</strong> or click a question number. Use <strong>Flag</strong> to mark a question for review.</li>
            <li>Your answers, flags and remaining time are saved automatically; refreshing the page does not lose anything. Keep the exam open in one tab only.</li>
            <li>Numeric answers: use a dot as decimal separator (0.51, not 0,51).</li>
            <li>
              Click <strong>Ready</strong> to hand in. You will see which questions are unanswered or flagged first.
            </li>
          </ul>
          {otherSession && !resumable && (
            <div className="banner warn">
              You still have an exam in progress ({otherLabel ?? otherSession.examId}
              {otherSession.mode === 'retry' ? ', retry of wrong questions' : ''}). Starting this one discards it.
            </div>
          )}
          {resumable && <div className="small muted">Starting again discards the answers you have saved for this exam.</div>}
          <label className="row" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid="confirm-check" />
            I have read the instructions and I am ready to start.
          </label>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" disabled={!ok} onClick={onStart} data-testid="start-exam">
              {resumable ? 'Start over' : 'Start'}
            </button>
            <a className="btn" href="#/">
              Cancel
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
