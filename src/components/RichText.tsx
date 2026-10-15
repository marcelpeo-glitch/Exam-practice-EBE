import katex from 'katex';
import { Fragment, memo, useMemo, type ReactNode } from 'react';
import { parseRich } from '../lib/richParse';

const cache = new Map<string, string>();

function renderMath(tex: string, display: boolean): string {
  const key = (display ? 'D:' : 'I:') + tex;
  let html = cache.get(key);
  if (html === undefined) {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false });
    cache.set(key, html);
  }
  return html;
}

interface Props {
  text: string;
  className?: string;
  as?: 'div' | 'span';
  /** Language of the text (exam content is English while the UI around it may not be). */
  lang?: string;
}

export const RichText = memo(function RichText({ text, className, as = 'div', lang }: Props) {
  const nodes = useMemo(() => parseRich(text), [text]);
  const Tag = as;
  return (
    <Tag className={className ? `rich ${className}` : 'rich'} lang={lang}>
      {nodes.map((s, i) => {
        if (s.kind === 'br') return <br key={i} />;
        if (s.kind === 'math')
          return <span key={i} className={s.display ? 'math-display' : 'math-inline'} dangerouslySetInnerHTML={{ __html: renderMath(s.tex, s.display) }} />;
        let el: ReactNode = s.text;
        if (s.italic) el = <em>{el}</em>;
        if (s.bold) el = <strong>{el}</strong>;
        return <Fragment key={i}>{el}</Fragment>;
      })}
    </Tag>
  );
});
