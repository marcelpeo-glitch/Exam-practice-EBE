import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { courseShortName, examLabel, resolveImage } from '../lib/exams';
import { fmtClock } from '../lib/format';
import { isAnswered, questionsById } from '../lib/scoring';
import { KEY_SESSION, loadSession, newId, saveSession } from '../lib/storage';
import type { AnswerValue, Exam, Question, Session } from '../types';
import { AnswerInput } from './AnswerInput';
import { Calculator } from './Calculator';
import { BookIcon, CalcIcon, ClockIcon, FlagIcon, NextIcon, PrevIcon } from './Icons';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Modal } from './Modal';
import { QuestionStem } from './QuestionContent';

interface Props {
  exam: Exam;
  session: Session;
  onHandIn: (s: Session, auto: boolean) => void;
}

export function ExamScreen({ exam, session: initial, onHandIn }: Props) {
  const { t, tn, rich } = useI18n();
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
  // Time warnings at 10 minutes and 1 minute left (only when the countdown passes them while the exam is open).
  const [warning, setWarning] = useState<10 | 1 | null>(null);
  const lastRemaining = useRef(remaining);
  const scrollRef = useRef<HTMLDivElement>(null);
  // One tab owns the saved exam: the tab that opened it last. `owner` is this tab's token, stored inside the
  // saved session. When another tab or window takes the exam over (opens it, hands it in, discards or clears it),
  // this tab is `claimed`: it stops saving and cannot hand in, so it never overwrites or resurrects the other
  // tab's exam.
  const [owner] = useState(newId);
  const [claimed, setClaimed] = useState(false);
  useEffect(() => {
    // Take ownership when this screen opens. If the exam is no longer the saved one (handed in or replaced
    // elsewhere), do not bring it back.
    const cur = loadSession();
    if (cur && cur.attemptId === initial.attemptId) saveSession({ ...cur, owner });
    else setClaimed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage) return;
      if (e.key === null) return setClaimed(true); // storage cleared
      if (e.key !== KEY_SESSION) return;
      let by: string | undefined;
      try {
        by = e.newValue ? (JSON.parse(e.newValue) as Session).owner : undefined;
      } catch {
        /* unreadable value: treat as taken over */
      }
      if (!e.newValue || by !== owner) setClaimed(true);
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, [owner]);
  // Taking over closes this tab's other dialogs so the notice below is never hidden behind one.
  useEffect(() => {
    if (claimed) {
      setOverview(false);
      setConfirm(false);
      setResOpen(false);
    }
  }, [claimed]);

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
    if (handedIn.current || claimed) return;
    const cur = loadSession();
    if (!cur || cur.attemptId !== s.attemptId || cur.owner !== owner) {
      setClaimed(true); // another tab took over before its storage event reached us
      return;
    }
    saveSession({ ...s, remainingSec: remaining, owner });
  }, [s, remaining, claimed, owner]);

  const handIn = useCallback(
    (auto: boolean) => {
      if (handedIn.current || claimed) return;
      const cur = loadSession();
      if (!cur || cur.attemptId !== s.attemptId || cur.owner !== owner) {
        setClaimed(true);
        return;
      }
      handedIn.current = true;
      onHandIn({ ...s, remainingSec: remaining }, auto);
    },
    [s, remaining, onHandIn, claimed, owner],
  );

  useEffect(() => {
    if (remaining <= 0) handIn(true);
  }, [remaining, handIn]);

  useEffect(() => {
    const prev = lastRemaining.current;
    lastRemaining.current = remaining;
    if (prev > 60 && remaining <= 60 && remaining > 0) setWarning(1);
    else if (prev > 600 && remaining <= 600 && remaining > 60) setWarning(10);
  }, [remaining]);
  useEffect(() => {
    if (warning === null) return;
    const id = window.setTimeout(() => setWarning(null), 12000);
    return () => window.clearTimeout(id);
  }, [warning]);

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
  const toggleFlag = (qid: string) => setS((x) => ({ ...x, flags: x.flags.includes(qid) ? x.flags.filter((f) => f !== qid) : [...x.flags, qid] }));

  const answeredCount = questions.filter((qq) => isAnswered(qq, s.answers[qq.id])).length;
  const unanswered = questions.map((qq, i) => ({ qq, i })).filter(({ qq }) => !isAnswered(qq, s.answers[qq.id]));
  const flagged = questions.map((qq, i) => ({ qq, i })).filter(({ qq }) => s.flags.includes(qq.id));
  const isFlagged = s.flags.includes(q.id);
  const low = remaining <= 300;
  const baseLabel = exam.prediction ? `${courseShortName(exam.courseName)} · ${t('predict.label')}` : examLabel(exam);
  const label = s.mode === 'retry' ? `${baseLabel} · ${tn('common.retryOfN', questions.length)}` : baseLabel;
  // Navigator tiles grouped by section (e.g. Mathematics 1–14, Statistics 15–28) when the exam has several.
  const groups: { section: string; items: { qq: Question; i: number }[] }[] = [];
  questions.forEach((qq, i) => {
    const sec = qq.section ?? '';
    if (groups.length && groups[groups.length - 1].section === sec) groups[groups.length - 1].items.push({ qq, i });
    else groups.push({ section: sec, items: [{ qq, i }] });
  });

  return (
    <div className="exam">
      <div className="exam-top">
        <header className="exam-header">
          <div className="exam-title" title={label}>
            {label}
          </div>
          {exam.prediction && (
            <span className="pill predicted" title={t('predict.note')} data-testid="predicted-pill">
              {t('predict.label')}
            </span>
          )}
          <div className="spacer" />
          <div className={low ? 'timer low' : 'timer'} role="timer" aria-live="off" data-testid="timer">
            <ClockIcon />
            <span className="lbl">{t('exam.timeLeft')}</span>
            <span data-testid="timer-value">{fmtClock(remaining)}</span>
          </div>
          <LanguageSwitcher />
          <button className="btn primary" onClick={() => setOverview(true)} data-testid="ready">
            {t('exam.ready')}
          </button>
        </header>
        {exam.prediction && (
          <div className="predict-strip" data-testid="predicted-note">
            {t('predict.note')}
          </div>
        )}
      </div>
      {warning !== null && (
        <div className="time-warning" role="alert" data-testid="time-warning">
          <ClockIcon /> <span>{warning === 10 ? t('exam.warn10') : t('exam.warn1')}</span>
          <button className="btn small" onClick={() => setWarning(null)} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
      )}

      <div className="exam-body">
        <nav className="nav" aria-label={t('exam.questions')}>
          <h3>{t('exam.questions')}</h3>
          {groups.map((grp) => (
            <div key={`${grp.section}-${grp.items[0].i}`} className="tile-group">
              {groups.length > 1 && grp.section && (
                <div className="tile-group-label" lang="en">
                  {grp.section}
                </div>
              )}
              <div className="tiles">
                {grp.items.map(({ qq, i }) => {
                  const ans = isAnswered(qq, s.answers[qq.id]);
                  const fl = s.flags.includes(qq.id);
                  const cls = ['tile', ans ? 'answered' : '', i === idx ? 'current' : ''].join(' ').trim();
                  const state = `${ans ? 'answered' : 'unanswered'}${fl ? ', flagged' : ''}`;
                  const stateText = [t(ans ? 'exam.state.answered' : 'exam.state.unanswered'), ...(fl ? [t('exam.state.flagged')] : [])].join(', ');
                  return (
                    <button
                      key={qq.id}
                      className={cls}
                      onClick={() => goTo(i)}
                      aria-label={t('exam.tileAria', { n: i + 1, state: stateText })}
                      aria-current={i === idx ? 'step' : undefined}
                      data-testid={`tile-${i + 1}`}
                      data-state={state}
                    >
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
            </div>
          ))}
          <div className="legend">
            <div>
              <span className="sw answered" />
              {t('exam.legend.answered')}
            </div>
            <div>
              <span className="sw" />
              {t('exam.legend.unanswered')}
            </div>
            <div>
              <span className="sw flag" />
              {t('exam.legend.flagged')}
            </div>
          </div>
          <div className="counts">
            {t('exam.countAnswered', { answered: answeredCount, total: questions.length })}
            <br />
            {tn('exam.countFlagged', flagged.length)}
          </div>
        </nav>

        <main className="qpane">
          <div className="qscroll" ref={scrollRef}>
            <div className="qblock">
              <div className="qhead">
                <span className="qnum" data-testid="question-heading">
                  {t('exam.questionN', { n: idx + 1 })}
                </span>
                <span className="muted small">
                  {t('exam.ofTotal', { total: questions.length })}
                  {s.mode === 'retry' && ` · ${t('exam.originalNumber', { n: q.number })}`}
                  {` · ${tn('exam.points', q.points)}`}
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
              <FlagIcon filled={isFlagged} /> {isFlagged ? t('exam.flagged') : t('exam.flag')}
            </button>
            <button className={calcOpen ? 'btn active' : 'btn'} onClick={() => setCalcOpen((o) => !o)} aria-pressed={calcOpen} data-testid="calc-toggle">
              <CalcIcon /> {t('exam.calculator')}
            </button>
            {!!exam.resources?.length && (
              <button className="btn" onClick={() => setResOpen(true)} data-testid="resources">
                <BookIcon /> {t('exam.formulaSheets')}
              </button>
            )}
            <div className="spacer" />
            <button className="btn" onClick={() => goTo(idx - 1)} disabled={idx === 0} data-testid="prev">
              <PrevIcon /> {t('exam.previous')}
            </button>
            <button className="btn primary" onClick={() => goTo(idx + 1)} disabled={idx === questions.length - 1} data-testid="next">
              {t('exam.next')} <NextIcon />
            </button>
          </div>
        </main>
      </div>

      {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}

      {resOpen && exam.resources && (
        <Modal title={t('exam.resourcesTitle')} onClose={() => setResOpen(false)} wide>
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
          title={t('handin.title')}
          onClose={() => setOverview(false)}
          testId="handin-overview"
          footer={
            <>
              <button className="btn" onClick={() => setOverview(false)}>
                {t('handin.backToExam')}
              </button>
              <button
                className="btn primary"
                data-testid="handin-continue"
                onClick={() => {
                  setOverview(false);
                  setConfirm(true);
                }}
              >
                {t('handin.handIn')}
              </button>
            </>
          }
        >
          <p>{rich('handin.summary', { answered: answeredCount, total: questions.length, time: fmtClock(remaining) })}</p>
          <div>
            <strong>{t('handin.notAnswered', { n: unanswered.length })}</strong>
            {unanswered.length === 0 ? (
              <p className="muted">{t('handin.allAnswered')}</p>
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
            <strong>{t('handin.flagged', { n: flagged.length })}</strong>
            {flagged.length === 0 ? (
              <p className="muted">{t('handin.noneFlagged')}</p>
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
          <p className="small muted">{t('handin.clickNumber')}</p>
        </Modal>
      )}

      {confirm && (
        <Modal
          title={t('handin.sure')}
          onClose={() => setConfirm(false)}
          testId="handin-confirm"
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn primary" onClick={() => handIn(false)} data-testid="handin-confirm-yes">
                {t('handin.yes')}
              </button>
            </>
          }
        >
          <p>{t('handin.final')}</p>
          {unanswered.length > 0 && <p className="muted">{tn('handin.stillUnanswered', unanswered.length)}</p>}
        </Modal>
      )}

      {claimed && (
        <Modal
          title={t('claimed.title')}
          testId="claimed-modal"
          footer={
            <a className="btn primary" href="#/" data-testid="claimed-leave">
              {t('claimed.leave')}
            </a>
          }
        >
          <p>{t('claimed.body')}</p>
          <p className="muted">{t('claimed.hint', { resume: t('common.resume') })}</p>
        </Modal>
      )}
    </div>
  );
}
