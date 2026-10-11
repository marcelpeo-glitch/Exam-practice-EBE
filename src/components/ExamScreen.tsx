import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { examLabel, resolveImage } from '../lib/exams';
import { fmtClock } from '../lib/format';
import { isAnswered, questionsById } from '../lib/scoring';
import { KEY_SESSION, loadSession, saveSession } from '../lib/storage';
import type { AnswerValue, Exam, Question, Session } from '../types';
import { AnswerInput } from './AnswerInput';
import { Calculator } from './Calculator';
import { BookIcon, CalcIcon, ClockIcon, FlagIcon, NextIcon, PrevIcon } from './Icons';
import { Modal } from './Modal';
import { QuestionStem } from './QuestionContent';

interface Props {
  exam: Exam;
  session: Session;
  onHandIn: (s: Session, auto: boolean) => void;
}

export function ExamScreen({ exam, session: initial, onHandIn }: Props) {
  // Start from the latest autosave for this attempt (the prop can be stale after Back/Forward or Resume).
  const [s, setS] = useState<Session>(() => {
    const saved = loadSession();
    return saved && saved.attemptId === initial.attemptId ? saved : initial;
  });
  const [remaining, setRemaining] = useState(() => s.remainingSec);
  const [calcOpen, setCalcOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [resTab, setResTab] = useState(0);
  const [overview, setOverview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const handedIn = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Set when another tab or window changes the saved exam (opened it, handed it in, cleared it). This tab then
  // stops saving and cannot hand in, so it never overwrites or resurrects the other tab's exam.
  const [claimed, setClaimed] = useState(false);
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.storageArea === window.localStorage && (e.key === KEY_SESSION || e.key === null)) setClaimed(true);
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const byId = useMemo(() => questionsById(exam), [exam]);
  const questions = useMemo(() => s.questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q), [s.questionIds, byId]);
  const idx = Math.min(s.currentIndex, questions.length - 1);
  const q = questions[idx];

  // Countdown based on elapsed wall-clock time (robust against throttled timers in background tabs).
  useEffect(() => {
    let last = performance.now();
    let acc = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      acc += (now - last) / 1000;
      last = now;
      if (acc >= 1) {
        const whole = Math.floor(acc);
        acc -= whole;
        setRemaining((r) => Math.max(0, r - whole));
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // Autosave answers, flags, position and remaining time on every change (and every second).
  useEffect(() => {
    if (!handedIn.current && !claimed) saveSession({ ...s, remainingSec: remaining });
  }, [s, remaining, claimed]);

  const handIn = useCallback(
    (auto: boolean) => {
      if (handedIn.current || claimed) return;
      handedIn.current = true;
      onHandIn({ ...s, remainingSec: remaining }, auto);
    },
    [s, remaining, onHandIn, claimed],
  );

  useEffect(() => {
    if (remaining <= 0) handIn(true);
  }, [remaining, handIn]);

  const goTo = (i: number) => {
    setS((x) => ({ ...x, currentIndex: Math.max(0, Math.min(questions.length - 1, i)) }));
    scrollRef.current?.scrollTo({ top: 0 });
  };
  const setAnswer = (qid: string, v: AnswerValue | undefined) =>
    setS((x) => {
      const answers = { ...x.answers };
      if (v === undefined) delete answers[qid];
      else answers[qid] = v;
      return { ...x, answers };
    });
  const toggleFlag = (qid: string) =>
    setS((x) => ({ ...x, flags: x.flags.includes(qid) ? x.flags.filter((f) => f !== qid) : [...x.flags, qid] }));

  const answeredCount = questions.filter((qq) => isAnswered(qq, s.answers[qq.id])).length;
  const unanswered = questions.map((qq, i) => ({ qq, i })).filter(({ qq }) => !isAnswered(qq, s.answers[qq.id]));
  const flagged = questions.map((qq, i) => ({ qq, i })).filter(({ qq }) => s.flags.includes(qq.id));
  const isFlagged = s.flags.includes(q.id);
  const low = remaining <= 300;
  const label = s.mode === 'retry' ? `${examLabel(exam)} · retry of ${questions.length} questions` : examLabel(exam);

  return (
    <div className="exam">
      <header className="exam-header">
        <div className="exam-title" title={label}>
          {label}
        </div>
        <div className="spacer" />
        <div className={low ? 'timer low' : 'timer'} role="timer" aria-live="off" data-testid="timer">
          <ClockIcon />
          <span className="lbl">Time left</span>
          <span data-testid="timer-value">{fmtClock(remaining)}</span>
        </div>
        <button className="btn primary" onClick={() => setOverview(true)} data-testid="ready">
          Ready
        </button>
      </header>

      <div className="exam-body">
        <nav className="nav" aria-label="Questions">
          <h3>Questions</h3>
          <div className="tiles">
            {questions.map((qq, i) => {
              const ans = isAnswered(qq, s.answers[qq.id]);
              const fl = s.flags.includes(qq.id);
              const cls = ['tile', ans ? 'answered' : '', i === idx ? 'current' : ''].join(' ').trim();
              const state = `${ans ? 'answered' : 'unanswered'}${fl ? ', flagged' : ''}`;
              return (
                <button key={qq.id} className={cls} onClick={() => goTo(i)} aria-label={`Question ${i + 1}, ${state}`} aria-current={i === idx ? 'step' : undefined} data-testid={`tile-${i + 1}`} data-state={state}>
                  {i + 1}
                  {fl && (
                    <span className="flagmark" aria-hidden="true">
                      <svg viewBox="0 0 10 10">
                        <path d="M2 9V1h6L7 3l1 2H2" fill="currentColor" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="legend">
            <div>
              <span className="sw answered" />
              Answered
            </div>
            <div>
              <span className="sw" />
              Not answered
            </div>
            <div>
              <span className="sw flag" />
              Flagged for review
            </div>
          </div>
          <div className="counts">
            {answeredCount} of {questions.length} answered
            <br />
            {flagged.length} flagged
          </div>
        </nav>

        <main className="qpane">
          <div className="qscroll" ref={scrollRef}>
            <div className="qblock">
              <div className="qhead">
                <span className="qnum" data-testid="question-heading">
                  Question {idx + 1}
                </span>
                <span className="muted small">
                  of {questions.length}
                  {s.mode === 'retry' && ` · question ${q.number} in the original exam`}
                  {` · ${q.points} ${q.points === 1 ? 'point' : 'points'}`}
                </span>
              </div>
              <QuestionStem q={q} />
              <div className="answer-box">
                <AnswerInput key={q.id} q={q} value={s.answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
              </div>
            </div>
          </div>
          <div className="qfoot">
            <button className={isFlagged ? 'btn flagged' : 'btn'} onClick={() => toggleFlag(q.id)} aria-pressed={isFlagged} data-testid="flag">
              <FlagIcon filled={isFlagged} /> {isFlagged ? 'Flagged' : 'Flag'}
            </button>
            <button className={calcOpen ? 'btn active' : 'btn'} onClick={() => setCalcOpen((o) => !o)} aria-pressed={calcOpen} data-testid="calc-toggle">
              <CalcIcon /> Calculator
            </button>
            {!!exam.resources?.length && (
              <button className="btn" onClick={() => setResOpen(true)} data-testid="resources">
                <BookIcon /> Formula sheets
              </button>
            )}
            <div className="spacer" />
            <button className="btn" onClick={() => goTo(idx - 1)} disabled={idx === 0} data-testid="prev">
              <PrevIcon /> Previous
            </button>
            <button className="btn primary" onClick={() => goTo(idx + 1)} disabled={idx === questions.length - 1} data-testid="next">
              Next <NextIcon />
            </button>
          </div>
        </main>
      </div>

      {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}

      {claimed && (
        <Modal
          title="This exam is open in another tab"
          testId="claimed-modal"
          footer={
            <a className="btn primary" href="#/" data-testid="claimed-leave">
              Go to the overview
            </a>
          }
        >
          <p>
            This exam was changed in another tab or window, so this tab has stopped saving. That keeps the other tab&apos;s answers safe.
          </p>
          <p className="muted">Continue in the other tab, or go to the overview and click Resume to continue here.</p>
        </Modal>
      )}

      {resOpen && exam.resources && (
        <Modal title="Formula sheets and tables" onClose={() => setResOpen(false)} wide>
          <div className="tabs">
            {exam.resources.map((r, i) => (
              <button key={r.src} className={i === resTab ? 'btn small active' : 'btn small'} onClick={() => setResTab(i)}>
                {r.title}
              </button>
            ))}
          </div>
          <img className="resource-img" src={resolveImage(exam.resources[resTab].src)} alt={exam.resources[resTab].title} />
        </Modal>
      )}

      {overview && (
        <Modal
          title="Hand in your exam"
          onClose={() => setOverview(false)}
          testId="handin-overview"
          footer={
            <>
              <button className="btn" onClick={() => setOverview(false)}>
                Back to the exam
              </button>
              <button
                className="btn primary"
                data-testid="handin-continue"
                onClick={() => {
                  setOverview(false);
                  setConfirm(true);
                }}
              >
                Hand in
              </button>
            </>
          }
        >
          <p>
            You answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions. Time left: <strong>{fmtClock(remaining)}</strong>.
          </p>
          <div>
            <strong>Not answered ({unanswered.length})</strong>
            {unanswered.length === 0 ? (
              <p className="muted">All questions have an answer.</p>
            ) : (
              <div className="chips" data-testid="unanswered-list">
                {unanswered.map(({ i }) => (
                  <button
                    key={i}
                    className="chip"
                    onClick={() => {
                      setOverview(false);
                      goTo(i);
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <strong>Flagged for review ({flagged.length})</strong>
            {flagged.length === 0 ? (
              <p className="muted">No flagged questions.</p>
            ) : (
              <div className="chips" data-testid="flagged-list">
                {flagged.map(({ i }) => (
                  <button
                    key={i}
                    className="chip flag"
                    onClick={() => {
                      setOverview(false);
                      goTo(i);
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="small muted">Click a number to go back to that question.</p>
        </Modal>
      )}

      {confirm && (
        <Modal
          title="Are you sure?"
          onClose={() => setConfirm(false)}
          testId="handin-confirm"
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={() => handIn(false)} data-testid="handin-confirm-yes">
                Yes, hand in
              </button>
            </>
          }
        >
          <p>After handing in you can no longer change your answers.</p>
          {unanswered.length > 0 && <p className="muted">{unanswered.length} question(s) are still unanswered.</p>}
        </Modal>
      )}
    </div>
  );
}
