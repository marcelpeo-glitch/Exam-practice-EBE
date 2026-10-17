import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmScreen } from './components/ConfirmScreen';
import { ExamScreen } from './components/ExamScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { StartScreen } from './components/StartScreen';
import { useI18n } from './i18n';
import type { TextKey } from './i18n/ui-en';
import { addPredictedExam, examLabel, getExam, loadExams } from './lib/exams';
import { scoreExam, snapshot } from './lib/scoring';
import { KEY_ATTEMPTS, KEY_PREDICTED, KEY_SESSION, clearAll, loadAttempts, loadSession, newId, saveSession, upsertAttempt } from './lib/storage';
import { blueprintFor } from './predict/courses';
import { randomSeed } from './predict/rng';
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

function NotFound({ what }: { what: 'notFound.exam' | 'notFound.attempt' | 'notFound.result' | 'notFound.noWrong' }) {
  const { t } = useI18n();
  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="brand">PreGame</span>
          <div className="spacer" />
          <LanguageSwitcher />
        </div>
      </div>
      <div className="page">
        <div className="banner bad" data-testid="not-found">
          {t(what)} <a href="#/">{t('notFound.back')}</a>
        </div>
      </div>
    </>
  );
}

const PAGE_TITLE: Record<string, TextKey> = { '': 'meta.overview', start: 'meta.start', exam: 'meta.exam', results: 'meta.results' };

export default function App() {
  const { t } = useI18n();
  const [hash, go] = useHash();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [attempts, setAttempts] = useState<Attempt[]>(() => loadAttempts());
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  useEffect(() => {
    window.scrollTo(0, 0);
    // The exam screen autosaves to localStorage, and another tab may have changed things; re-read both on
    // every route change so the resume banner, the history and a remounted exam screen are never stale.
    setSession(loadSession());
    setAttempts(loadAttempts());
  }, [hash]);

  // Idle tabs (overview, confirm page, results) follow what other tabs do: a stale "Resume" button must never
  // bring back an exam that was handed in or discarded elsewhere. The exam screen handles takeovers itself.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage) return;
      if (e.key !== null && e.key !== KEY_SESSION && e.key !== KEY_ATTEMPTS && e.key !== KEY_PREDICTED) return;
      if (window.location.hash.startsWith('#/exam')) return;
      setSession(loadSession());
      setAttempts(loadAttempts());
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  // Page title in the active language, e.g. "Results · PreGame".
  const titleKey = PAGE_TITLE[parts[0] ?? ''] ?? 'meta.notFound';
  useEffect(() => {
    document.title = `${t(titleKey)} · PreGame`;
  }, [t, titleKey]);

  // The exam route always works from what is saved right now, never from this tab's in-memory copy.
  const examSession = useMemo(() => (parts[0] === 'exam' ? loadSession() : null), [hash]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // "Generate predicted exam": build a new exam from the course's stored blueprint (all in the browser; the
  // generator is loaded on first use), save it, and open its start page.
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(false);
  const generate = useCallback(
    async (courseCode: string) => {
      setGenerating(true);
      setGenerateError(false);
      try {
        const blueprint = blueprintFor(courseCode);
        if (!blueprint) throw new Error(`No blueprint for ${courseCode}`);
        const { generatePredictedExam } = await import('./predict/generate');
        const past = loadExams().exams.filter((e) => e.courseCode === courseCode && !e.isDemo);
        const newest = past.find((e) => e.id === blueprint.exams[0]?.id) ?? past[past.length - 1];
        const exam = generatePredictedExam({
          blueprint,
          seed: randomSeed(),
          pastStems: past.flatMap((e) => e.questions.map((q) => q.stem)),
          resources: newest?.resources,
          generatedAt: new Date().toISOString(),
        });
        addPredictedExam(exam);
        go(`#/start/${exam.id}`);
      } catch (e) {
        console.error(e);
        setGenerateError(true);
      } finally {
        setGenerating(false);
      }
    },
    [go],
  );

  // ---- routes ----
  if (parts[0] === 'exam') {
    const exam = examSession ? getExam(examSession.examId) : undefined;
    if (!examSession || !exam) return <Redirect to="#/" navigate={go} />;
    return <ExamScreen key={examSession.attemptId} exam={exam} session={examSession} onHandIn={handIn} />;
  }

  if (parts[0] === 'start' && parts[1]) {
    const exam = getExam(parts[1]);
    if (!exam) return <NotFound what="notFound.exam" />;
    let questionIds = exam.questions.map((q) => q.id);
    let mode: 'full' | 'retry' = 'full';
    let duration = exam.durationMinutes;
    const retryOf = parts[2] === 'retry' ? parts[3] : undefined;
    if (retryOf) {
      const prev = attempts.find((a) => a.id === retryOf);
      if (!prev) return <NotFound what="notFound.attempt" />;
      const r = scoreExam(exam, prev.questionIds, prev.answers, prev.selfScores, prev.mode);
      questionIds = r.perQuestion.filter((p) => p.status !== 'correct').map((p) => p.questionId);
      if (questionIds.length === 0) return <NotFound what="notFound.noWrong" />;
      mode = 'retry';
      duration = Math.max(5, Math.round((exam.durationMinutes * questionIds.length) / exam.questions.length));
    }
    const otherExam = session ? getExam(session.examId) : undefined;
    const resumable = !!session && session.examId === exam.id && session.mode === mode && session.retryOf === retryOf;
    return (
      <ConfirmScreen
        exam={exam}
        questionIds={questionIds}
        durationMinutes={duration}
        mode={mode}
        otherSession={session}
        otherLabel={otherExam ? examLabel(otherExam) : undefined}
        resumable={resumable}
        onResume={() => {
          // Re-check what is saved right now (this page may be stale, e.g. the exam was handed in in another tab).
          const live = loadSession();
          setSession(live);
          if (live && live.examId === exam.id && live.mode === mode && live.retryOf === retryOf) go('#/exam', true);
        }}
        onStart={() => {
          // Never replace an exam this page does not know about (started in another tab since it was loaded).
          const live = loadSession();
          if ((live?.attemptId ?? null) !== (session?.attemptId ?? null)) {
            setSession(live);
            return;
          }
          startSession(exam.id, questionIds, duration, mode, retryOf);
        }}
      />
    );
  }

  if (parts[0] === 'results' && parts[1]) {
    const attempt = attempts.find((a) => a.id === parts[1]);
    const exam = attempt ? getExam(attempt.examId) : undefined;
    if (!attempt || !exam) return <NotFound what="notFound.result" />;
    return (
      <ResultsScreen
        exam={exam}
        attempt={attempt}
        onGenerate={() => generate(exam.courseCode)}
        generating={generating}
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
      onResume={() => {
        const live = loadSession();
        setSession(live);
        if (live) go('#/exam');
      }}
      onDiscard={() => {
        const live = loadSession();
        if (live && live.attemptId !== session?.attemptId) {
          setSession(live); // another tab started a different exam since this page was loaded
          return;
        }
        saveSession(null);
        setSession(null);
      }}
      onClearAll={() => {
        clearAll();
        setSession(null);
        setAttempts([]);
      }}
      onGenerate={generate}
      generating={generating}
      generateError={generateError}
    />
  );
}
