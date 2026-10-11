import { resolveImage } from '../lib/exams';
import { numericFields } from '../lib/scoring';
import type { AnswerValue, Question } from '../types';
import { RichText } from './RichText';

interface Props {
  q: Question;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue | undefined) => void;
}

/** Answer area for one question during the exam. Never shows correct answers. */
export function AnswerInput({ q, value, onChange }: Props) {
  switch (q.type) {
    case 'single-choice': {
      const cur = typeof value === 'string' ? value : '';
      return (
        <div role="radiogroup" aria-label={`Answer to question ${q.number}`}>
          {q.options?.map((o) => (
            <label key={o.id} className={cur === o.id ? 'opt selected' : 'opt'} data-testid={`option-${o.id}`}>
              <input type="radio" name={`q-${q.id}`} value={o.id} checked={cur === o.id} onChange={() => onChange(o.id)} />
              <span className="letter">{o.id}</span>
              <span className="otext">
                {o.text && <RichText as="span" text={o.text} />}
                {o.image && <img src={resolveImage(o.image)} alt={`Option ${o.id}`} />}
              </span>
            </label>
          ))}
          {cur && (
            <button className="clear-link" onClick={() => onChange(undefined)}>
              Clear answer
            </button>
          )}
        </div>
      );
    }
    case 'multi-select': {
      const cur = Array.isArray(value) ? value : [];
      const toggle = (id: string) => {
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
        onChange(next.length ? next : undefined);
      };
      return (
        <div role="group" aria-label={`Answer to question ${q.number}`}>
          {q.options?.map((o) => (
            <label key={o.id} className={cur.includes(o.id) ? 'opt selected' : 'opt'} data-testid={`option-${o.id}`}>
              <input type="checkbox" checked={cur.includes(o.id)} onChange={() => toggle(o.id)} />
              <span className="letter">{o.id}</span>
              <span className="otext">
                {o.text && <RichText as="span" text={o.text} />}
                {o.image && <img src={resolveImage(o.image)} alt={`Option ${o.id}`} />}
              </span>
            </label>
          ))}
        </div>
      );
    }
    case 'numeric': {
      const cur = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const fields = numericFields(q);
      return (
        <div>
          {fields.map((f) => {
            const raw = cur[f.id] ?? '';
            const id = `num-${q.id}-${f.id}`;
            const comma = raw.includes(',');
            const invalid = raw.trim() !== '' && !/^[-+]?(\d+[.,]?\d*|[.,]\d+)(e[-+]?\d+)?$/i.test(raw.trim());
            return (
              <div key={f.id}>
                <div className="field-row">
                  {f.label && (
                    <label htmlFor={id}>
                      <RichText as="span" text={f.label} />
                    </label>
                  )}
                  {f.prefix && <span>{f.prefix}</span>}
                  <input
                    id={id}
                    className="num-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={f.label ?? 'Your answer'}
                    data-testid={`numeric-${f.id}`}
                    value={raw}
                    onChange={(e) => {
                      const next = { ...cur, [f.id]: e.target.value };
                      if (Object.values(next).every((v) => v.trim() === '')) onChange(undefined);
                      else onChange(next);
                    }}
                  />
                  {f.suffix && <span>{f.suffix}</span>}
                </div>
                {comma && <div className="hint">TestVision expects a dot (.) as decimal separator.</div>}
                {invalid && !comma && <div className="hint">This does not look like a number.</div>}
              </div>
            );
          })}
        </div>
      );
    }
    case 'open': {
      const cur = typeof value === 'string' ? value : '';
      return (
        <div>
          <textarea
            className="open"
            aria-label={`Answer to question ${q.number}`}
            data-testid="open-answer"
            value={cur}
            onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
          />
          <div className="small muted">{cur.trim() ? cur.trim().split(/\s+/).length : 0} words</div>
        </div>
      );
    }
    case 'matching': {
      const cur = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      return (
        <div>
          {q.prompts?.map((p) => {
            const choices = p.choiceIds ? (q.choices ?? []).filter((c) => p.choiceIds!.includes(c.id)) : q.choices ?? [];
            return (
              <div className="match-row" key={p.id}>
                <RichText text={p.text} />
                <select
                  aria-label={p.text}
                  data-testid={`match-${p.id}`}
                  value={cur[p.id] ?? ''}
                  onChange={(e) => {
                    const next = { ...cur };
                    if (e.target.value) next[p.id] = e.target.value;
                    else delete next[p.id];
                    onChange(Object.keys(next).length ? next : undefined);
                  }}
                >
                  <option value="">— choose —</option>
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.text}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      );
    }
  }
}
