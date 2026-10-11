import { useState } from 'react';
import { examLabel, keyKind } from '../lib/exams';
import type { Exam, Session } from '../types';
import { RichText } from './RichText';

interface Props {
  exam: Exam;
  questionIds: string[];
  durationMinutes: number;
  mode: 'full' | 'retry';
  otherSession: Session | null;
  otherLabel?: string;
  onStart: () => void;
}

/** The "are you ready to start?" page that precedes the exam, like the TestVision start screen. */
export function ConfirmScreen({ exam, questionIds, durationMinutes, mode, otherSession, otherLabel, onStart }: Props) {
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
            <li>Your answers, flags and remaining time are saved automatically; refreshing the page does not lose anything.</li>
            <li>Numeric answers: use a dot as decimal separator (0.51, not 0,51).</li>
            <li>
              Click <strong>Ready</strong> to hand in. You will see which questions are unanswered or flagged first.
            </li>
          </ul>
          {otherSession && (
            <div className="banner warn">
              You still have another exam in progress ({otherLabel ?? otherSession.examId}). Starting this one discards it.
            </div>
          )}
          <label className="row" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid="confirm-check" />
            I have read the instructions and I am ready to start.
          </label>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" disabled={!ok} onClick={onStart} data-testid="start-exam">
              Start
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
