import { useI18n } from '../i18n';
import type { Blueprint } from '../predict/blueprint';
import { PREDICTED_FORMAT } from '../predict/courses';
import { apportion } from '../predict/plan';
import type { Attempt, Exam } from '../types';

interface Props {
  blueprint: Blueprint;
  /** Predicted exams generated earlier for this course, newest first. */
  predicted: Exam[];
  attempts: Attempt[];
  generating: boolean;
  error: boolean;
  onGenerate: () => void;
}

/** The "Generate predicted exam" box on the overview, with how the prediction is made. */
export function PredictedPanel({ blueprint: bp, predicted, attempts, generating, error, onGenerate }: Props) {
  const { t, tn, fmt } = useI18n();
  const sections = bp.sectionOrder;
  const split = apportion(
    sections.map((s) => bp.sections[s].share),
    PREDICTED_FORMAT.questions,
  );
  const ratio = sections.map((s) => fmt.num(bp.sections[s].share * 100, 1)).join(' : ');
  const years = [...bp.exams].sort((a, b) => a.year - b.year).map((e) => e.academicYear);
  const yearRange = years.length > 1 ? `${years[0]} – ${years[years.length - 1]}` : years[0];
  const sectionWeight = (s: string) => bp.topics.filter((x) => x.section === s).reduce((a, x) => a + x.weight, 0) || 1;

  return (
    <div className="predict-panel" data-testid="predict-panel">
      <div className="predict-head">
        <div className="predict-text">
          <h3>{t('predict.label')}</h3>
          <p>{t('predict.intro', { questions: PREDICTED_FORMAT.questions, time: fmt.minutes(PREDICTED_FORMAT.durationMinutes) })}</p>
          <p className="small" data-testid="predict-split">
            {t('predict.split', { first: sections[0], firstN: split[0], second: sections[1] ?? '', secondN: split[1] ?? 0, ratio, n: bp.exams.length })}
          </p>
          <p className="small predict-note">{t('predict.note')}</p>
        </div>
        <button className="btn primary big" onClick={onGenerate} disabled={generating} data-testid="generate-predicted">
          {generating ? t('predict.generating') : t('predict.generate')}
        </button>
      </div>
      {error && <div className="banner bad">{t('predict.error')}</div>}

      {predicted.length > 0 && (
        <div className="table-wrap">
          <table className="list" data-testid="predicted-list">
            <caption className="small muted">{t('predict.yours')}</caption>
            <tbody>
              {predicted.map((e) => {
                const mine = attempts.filter((a) => a.examId === e.id);
                const best = mine.filter((a) => a.mode === 'full').sort((a, b) => b.score.grade - a.score.grade)[0];
                return (
                  <tr key={e.id}>
                    <td>{t('predict.generatedOn', { date: fmt.date(e.prediction!.generatedAt) })}</td>
                    <td className="num">
                      {best ? (
                        <>
                          {fmt.grade(best.score.grade)}{' '}
                          <span className="muted small">
                            ({fmt.points(best.score.points)}/{fmt.points(best.score.maxPoints)})
                          </span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                      {mine.length > 0 && <div className="muted small">{tn('start.attempts', mine.length)}</div>}
                    </td>
                    <td className="num">
                      <a className="btn small" href={`#/start/${e.id}`} data-testid={`start-${e.id}`}>
                        {t('common.start')}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <details className="predict-how">
        <summary>{t('predict.how')}</summary>
        <p className="small">{t('predict.howText', { n: bp.exams.length, years: yearRange })}</p>
        <div className="table-wrap">
          <table className="list" data-testid="blueprint-table">
            <thead>
              <tr>
                <th>{t('results.col.topic')}</th>
                <th className="num">{t('predict.col.inExams')}</th>
                <th className="num">{t('predict.col.weight')}</th>
                <th className="num">{t('predict.col.expected')}</th>
              </tr>
            </thead>
            {sections.map((s, si) => (
              <tbody key={s}>
                <tr className="group-row">
                  <th colSpan={4} lang="en">
                    {s} ({fmt.num(split[si])})
                  </th>
                </tr>
                {bp.topics
                  .filter((x) => x.section === s)
                  .map((x) => (
                    <tr key={x.topic}>
                      <td lang="en">
                        {x.topic}
                        {x.inEveryExam && <span className="pill official"> {t('predict.always')}</span>}
                      </td>
                      <td className="num">{t('predict.inExamsValue', { n: x.exams, total: bp.exams.length })}</td>
                      <td className="num">{fmt.percent((x.weight / sectionWeight(s)) * 100, 1)}</td>
                      <td className="num">{fmt.num((x.weight / sectionWeight(s)) * split[si], 1)}</td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      </details>
    </div>
  );
}
