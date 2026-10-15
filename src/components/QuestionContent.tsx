import { resolveImage } from '../lib/exams';
import type { ImageRef, Question, TableData } from '../types';
import { RichText } from './RichText';

export function Figures({ images }: { images?: ImageRef[] }) {
  if (!images?.length) return null;
  return (
    <>
      {images.map((im) => (
        <figure className="figure" key={im.src}>
          <img src={resolveImage(im.src)} alt={im.alt ?? ''} loading="lazy" />
          {im.caption && <figcaption>{im.caption}</figcaption>}
        </figure>
      ))}
    </>
  );
}

export function DataTable({ table }: { table?: TableData }) {
  if (!table) return null;
  return (
    <div className="table-wrap">
      <table className="data">
        {table.caption && <caption>{table.caption}</caption>}
        {table.header && (
          <thead>
            <tr>
              {table.header.map((h, i) => (
                <th key={i}>
                  <RichText as="span" text={h} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>
                  <RichText as="span" text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Section bar + stem + table + figures + instruction: what TestVision shows above the answer area. */
export function QuestionStem({ q }: { q: Question }) {
  return (
    <div>
      {q.section && (
        <div className="section-bar" lang="en">
          {q.section}
        </div>
      )}
      <div className={q.section ? 'stem-box' : 'stem-box no-bar'} lang="en">
        <RichText text={q.stem} />
        <DataTable table={q.table} />
        <Figures images={q.images} />
        {q.instruction && <RichText className="instruction" text={q.instruction} />}
      </div>
    </div>
  );
}
