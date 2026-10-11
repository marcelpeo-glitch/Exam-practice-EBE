import { useCallback, useEffect, useState } from 'react';
import { ConfirmScreen } from './components/ConfirmScreen';
import { ExamScreen } from './components/ExamScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { StartScreen } from './components/StartScreen';
import { examLabel, getExam } from './lib/exams';
import { scoreExam, snapshot } from './lib/scoring';
import { clearAll, loadAttempts, loadSession, newId, saveSession, upsertAttempt } from './lib/storage';
import type { Attempt, Session } from './types';

// Hash routes: #/  ·  #/start/<examId>  ·  #/start/<examId>/retry/<attemptId>  ·  #/exam  ·  #/results/<attemptId>
// navigate() updates the route state synchronously, so it lands in the same render as other state changes.
type Navigate = (h: string, replace?: boolean) => void;

function useHash(): [string, Navigate] {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  // replace=true swaps the current history entry, so Back never lands on a route that only redirects.
  const navigate = useCallback<Navigate>((h, replace = false) => {
    if (window.location.hash !== h) {
      if (replace) window.location.replace(h);
      else window.location.hash = h;
    }
    setHash(h);
  }, []);
  return [hash, navigate];
}

function Redirect({ to, navigate }: { to: string; navigate: Navigate }) {
  useEffect(() => navigate(to, true), [to, navigate]);
  return null;
}

function NotFound({ what }: { what: string }) {
  return (
    <div className="page">
      <div className="banner bad">
        {what} not found. <a href="#/">Back to the overview</a>
      </div>
    </div>
  );
}

export default function App() {
  const [hash, go] = useHash();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [attempts, setAttempts] = useState<Attempt[]>(() => loadAttempts());
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  useEffect(() => {
    window.scrollTo(0, 0);
    // The exam screen autosaves to localStorage; re-read it on every route change so the resume
    // banner and a remounted exam screen never work from a stale copy.
    setSession(loadSession());
  }, [hash]);

  const startSession = useCallback((examId: string, questionIds: string[], durationMinutes: number, mode: 'full' | 'retry', retryOf?: string) => {
    const s: Session = {
      attemptId: newId(),
      examId,
      mode,
      retryOf,
      questionIds,
      answers: {},
      flags: [],
      currentIndex: 0,
      durationSec: Math.round(durationMinutes * 60),
      remainingSec: Math.round(durationMinutes * 60),
      startedAt: new Date().toISOString(),
    };
    saveSession(s);
    setSession(s);
    go('#/exam');
  }, [go]);

  const handIn = useCallback((s: Session, auto: boolean) => {
    const exam = getExam(s.examId);
    if (!exam) return;
    const result = scoreExam(exam, s.questionIds, s.answers, {}, s.mode);
    const attempt: Attempt = {
      id: s.attemptId,
      examId: exam.id,
      examLabel: examLabel(exam),
      mode: s.mode,
      retryOf: s.retryOf,
      questionIds: s.questionIds,
      answers: s.answers,
      flags: s.flags,
      selfScores: {},
      startedAt: s.startedAt,
      submittedAt: new Date().toISOString(),
      durationSec: s.durationSec,
      timeUsedSec: Math.min(s.durationSec, s.durationSec - s.remainingSec),
      autoSubmitted: auto,
      score: snapshot(result),
    };
    upsertAttempt(attempt);
    saveSession(null);
    setSession(null);
    setAttempts(loadAttempts());
    go(`#/results/${attempt.id}`, true);
  }, [go]);

  // ---- routes ----
  if (parts[0] === 'exam') {
    const exam = session ? getExam(session.examId) : undefined;
    if (!session || !exam) return <Redirect to="#/" navigate={go} />;
    return <ExamScreen key={session.attemptId} exam={exam} session={session} onHandIn={handIn} />;
  }

  if (parts[0] === 'start' && parts[1]) {
    const exam = getExam(parts[1]);
    if (!exam) return <NotFound what="Exam" />;
    let questionIds = exam.questions.map((q) => q.id);
    let mode: 'full' | 'retry' = 'full';
    let duration = exam.durationMinutes;
    const retryOf = parts[2] === 'retry' ? parts[3] : undefined;
    if (retryOf) {
      const prev = attempts.find((a) => a.id === retryOf);
      if (!prev) return <NotFound what="Attempt" />;
      const r = scoreExam(exam, prev.questionIds, prev.answers, prev.selfScores, prev.mode);
      questionIds = r.perQuestion.filter((p) => p.status !== 'correct').map((p) => p.questionId);
      if (questionIds.length === 0) return <NotFound what="Wrong question" />;
      mode = 'retry';
      duration = Math.max(5, Math.round((exam.durationMinutes * questionIds.length) / exam.questions.length));
    }
    const otherExam = session ? getExam(session.examId) : undefined;
    return (
      <ConfirmScreen
        exam={exam}
        questionIds={questionIds}
        durationMinutes={duration}
        mode={mode}
        otherSession={session}
        otherLabel={otherExam ? examLabel(otherExam) : undefined}
        onStart={() => startSession(exam.id, questionIds, duration, mode, retryOf)}
      />
    );
  }

  if (parts[0] === 'results' && parts[1]) {
    const attempt = attempts.find((a) => a.id === parts[1]);
    const exam = attempt ? getExam(attempt.examId) : undefined;
    if (!attempt || !exam) return <NotFound what="Result" />;
    return (
      <ResultsScreen
        exam={exam}
        attempt={attempt}
        onSelfScore={(qid, score) => {
          const selfScores = { ...attempt.selfScores };
          if (score === undefined) delete selfScores[qid];
          else selfScores[qid] = score;
          const updated: Attempt = { ...attempt, selfScores, score: snapshot(scoreExam(exam, attempt.questionIds, attempt.answers, selfScores, attempt.mode)) };
          upsertAttempt(updated);
          setAttempts(loadAttempts());
        }}
      />
    );
  }

  return (
    <StartScreen
      attempts={attempts}
      session={session}
      onResume={() => go('#/exam')}
      onDiscard={() => {
        saveSession(null);
        setSession(null);
      }}
      onClearAll={() => {
        clearAll();
        setSession(null);
        setAttempts([]);
      }}
    />
  );
}
