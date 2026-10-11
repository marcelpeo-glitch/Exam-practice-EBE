import { examLabel, keyKind, loadExams } from '../lib/exams';
import { fmtClock, fmtDate, fmtGrade, fmtPoints } from '../lib/format';
import type { Attempt, Exam, Session } from '../types';

interface Props {
  attempts: Attempt[];
  session: Session | null;
  onResume: () => void;
  onDiscard: () => void;
  onClearAll: () => void;
}

function best(attempts: Attempt[], exam: Exam): Attempt | undefined {
  return attempts
    .filter((a) => a.examId === exam.id && a.mode === 'full')
    .sort((a, b) => b.score.grade - a.score.grade || b.score.points - a.score.points)[0];
}

export function StartScreen({ attempts, session, onResume, onDiscard, onClearAll }: Props) {
  const { exams, problems } = loadExams();
  const sessionExam = session ? exams.find((e) => e.id === session.examId) : undefined;
  const courses = [...new Set(exams.map((e) => `${e.courseCode}|${e.courseName}`))];
  const history = [...attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            Mock TestVision<small>practice exams, marked at the end</small>
          </span>
        </div>
      </div>
      <div className="page">
        {session && sessionExam && (
          <div className="banner warn" data-testid="resume-banner">
            <div className="row">
              <div>
                <strong>Exam in progress:</strong> {examLabel(sessionExam)}
                {session.mode === 'retry' && ' (retry of wrong questions)'} — {fmtClock(session.remainingSec)} left.
              </div>
              <div className="spacer" />
              <button className="btn primary" onClick={onResume} data-testid="resume">
                Resume
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (confirm('Discard the exam in progress? Your answers will be lost.')) onDiscard();
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {problems.length > 0 && (
          <div className="banner bad">
            <strong>Some exam files have problems:</strong>
            <ul>
              {problems.map((p) => (
                <li key={p.file}>
                  <code>{p.file}</code>: {p.errors.slice(0, 5).join('; ')}
                  {p.errors.length > 5 && ` (+${p.errors.length - 5} more)`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {courses.map((c) => {
          const [code, name] = c.split('|');
          const list = exams.filter((e) => e.courseCode === code && e.courseName === name);
          return (
            <section className="card" key={c}>
              <h2>
                {name} <span className="muted small">{code}</span>
              </h2>
              <div className="table-wrap">
                <table className="list" data-testid="exam-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Exam</th>
                      <th>Type</th>
                      <th className="num">Questions</th>
                      <th className="num">Duration</th>
                      <th>Answer key</th>
                      <th className="num">Best score</th>
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
                          <td>{e.academicYear}</td>
                          <td>{e.title}</td>
                          <td>
                            {e.examType === 'resit' ? 'Resit' : 'Regular'}
                            {e.examTypeAssumed && <span className="muted small"> (assumed)</span>}
                          </td>
                          <td className="num">{e.questions.length}</td>
                          <td className="num">
                            {e.durationMinutes} min
                            {e.durationSource === 'assumed' && <span className="muted small" title="Not stated in the source; assumed"> *</span>}
                          </td>
                          <td>
                            <span className={`pill ${kind === 'Official' ? 'official' : kind === 'AI-solved' ? 'ai' : 'mixed'}`}>{kind}</span>
                          </td>
                          <td className="num" data-testid="best-score">
                            {b ? (
                              <>
                                {fmtGrade(b.score.grade)} <span className="muted small">({fmtPoints(b.score.points)}/{fmtPoints(b.score.maxPoints)})</span>
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                            {n > 0 && <div className="muted small">{n} attempt{n > 1 ? 's' : ''}</div>}
                          </td>
                          <td className="num">
                            <a className="btn primary small" href={`#/start/${e.id}`} data-testid={`start-${e.id}`}>
                              Start
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ marginBottom: 0 }}>
                * Duration not stated in the source file; assumed. Answer key: <span className="pill official">Official</span> from the exam files,{' '}
                <span className="pill ai">AI-solved</span> solved by AI (verify), <span className="pill mixed">Mixed</span> both.
              </p>
            </section>
          );
        })}

        <section className="card">
          <h2>Attempt history</h2>
          {history.length === 0 ? (
            <p className="muted">No attempts yet. Your results will be listed here.</p>
          ) : (
            <div className="table-wrap">
              <table className="list" data-testid="history">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Exam</th>
                    <th>Mode</th>
                    <th className="num">Score</th>
                    <th className="num">Grade</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => (window.location.hash = `#/results/${a.id}`)}>
                      <td>{fmtDate(a.submittedAt)}</td>
                      <td>
                        <a href={`#/results/${a.id}`}>{a.examLabel}</a>
                      </td>
                      <td>{a.mode === 'full' ? 'Full exam' : `Retry (${a.questionIds.length} q.)`}</td>
                      <td className="num">
                        {fmtPoints(a.score.points)} / {fmtPoints(a.score.maxPoints)}
                      </td>
                      <td className="num">{fmtGrade(a.score.grade)}</td>
                      <td>
                        <span className={a.score.passed ? 'pill pass' : 'pill fail'}>{a.score.passed ? 'Pass' : 'Fail'}</span>
                        {a.score.ungradedOpen > 0 && <span className="pill neutral"> {a.score.ungradedOpen} to mark</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="row small muted">
          <span>
            Exams are read from <code>data/exams/*.json</code>. Progress and history are stored in this browser (localStorage).
          </span>
          <div className="spacer" />
          {(history.length > 0 || session) && (
            <button
              className="btn small"
              onClick={() => {
                if (confirm('Delete all attempts and any exam in progress from this browser?')) onClearAll();
              }}
            >
              Clear saved data
            </button>
          )}
        </div>
      </div>
    </>
  );
}
