import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { evaluate, formatResult, type AngleMode } from '../lib/calc';

interface Props {
  onClose: () => void;
}

type Key = { label: string; insert?: string; cls?: string; action?: 'eq' | 'del' | 'ac' | 'neg'; title?: 'calc.log10' | 'calc.sciNotation' };

const KEYS: Key[] = [
  { label: 'sin', insert: 'sin(', cls: 'fn' },
  { label: 'cos', insert: 'cos(', cls: 'fn' },
  { label: 'tan', insert: 'tan(', cls: 'fn' },
  { label: 'ln', insert: 'ln(', cls: 'fn' },
  { label: 'log', insert: 'log(', cls: 'fn', title: 'calc.log10' },
  { label: 'x²', insert: '^2', cls: 'fn' },
  { label: 'xʸ', insert: '^', cls: 'fn' },
  { label: '√', insert: '√(', cls: 'fn' },
  { label: 'eˣ', insert: 'e^(', cls: 'fn' },
  { label: '10ˣ', insert: '10^(', cls: 'fn' },
  { label: '(', insert: '(', cls: 'fn' },
  { label: ')', insert: ')', cls: 'fn' },
  { label: 'π', insert: 'π', cls: 'fn' },
  { label: 'e', insert: 'e', cls: 'fn' },
  { label: 'x!', insert: '!', cls: 'fn' },
  { label: '7', insert: '7' },
  { label: '8', insert: '8' },
  { label: '9', insert: '9' },
  { label: 'DEL', action: 'del', cls: 'del' },
  { label: 'AC', action: 'ac', cls: 'del' },
  { label: '4', insert: '4' },
  { label: '5', insert: '5' },
  { label: '6', insert: '6' },
  { label: '×', insert: '×', cls: 'op' },
  { label: '÷', insert: '÷', cls: 'op' },
  { label: '1', insert: '1' },
  { label: '2', insert: '2' },
  { label: '3', insert: '3' },
  { label: '+', insert: '+', cls: 'op' },
  { label: '−', insert: '−', cls: 'op' },
  { label: '0', insert: '0' },
  { label: '.', insert: '.' },
  { label: '×10ˣ', insert: 'E', title: 'calc.sciNotation' },
  { label: 'Ans', insert: 'Ans', cls: 'fn' },
  { label: '=', action: 'eq', cls: 'eq' },
];

/** Basic scientific calculator in a draggable pop-up. */
export function Calculator({ onClose }: Props) {
  const { t } = useI18n();
  // calc.ts reports errors in English ("Syntax error" / "Math error"); show them in the active language.
  const errText = (msg: string) => (msg === 'Math error' ? t('calc.mathError') : t('calc.syntaxError'));
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<{ text: string; err?: boolean } | null>(null);
  const [ans, setAns] = useState(0);
  const [angle, setAngle] = useState<AngleMode>('deg');
  const [pos, setPos] = useState(() => ({ x: Math.max(16, window.innerWidth - 340), y: 90 }));
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const justEvaluated = useRef(false);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      setPos({
        x: Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 120),
        y: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 60),
      });
    };
    const up = () => (drag.current = null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const run = () => {
    if (!expr.trim()) return;
    try {
      const v = evaluate(expr, { ans, angle });
      const text = formatResult(v);
      setResult(text === 'Math error' ? { text: errText(text), err: true } : { text });
      if (Number.isFinite(v)) setAns(v);
      justEvaluated.current = true;
    } catch (e) {
      setResult({ text: errText((e as Error).message), err: true });
    }
  };

  const press = (k: Key) => {
    if (k.action === 'eq') return run();
    if (k.action === 'ac') {
      setExpr('');
      setResult(null);
      justEvaluated.current = false;
      return inputRef.current?.focus();
    }
    if (k.action === 'del') {
      setExpr((x) => x.slice(0, -1));
      justEvaluated.current = false;
      return inputRef.current?.focus();
    }
    const ins = k.insert ?? '';
    // After "=", typing an operator continues from Ans; typing a number starts fresh.
    // Read and reset the ref outside the state updater: updaters must be pure (StrictMode runs them twice).
    const fresh = justEvaluated.current;
    justEvaluated.current = false;
    setExpr((x) => (fresh ? (/^[+×÷−^!]/.test(ins) ? 'Ans' + ins : ins) : x + ins));
    inputRef.current?.focus();
  };

  return (
    <div className="calc" style={{ left: pos.x, top: pos.y }} role="dialog" aria-label={t('calc.title')} data-testid="calculator">
      <div
        className="calc-head"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).tagName === 'BUTTON') return;
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
      >
        <span style={{ flex: 1 }}>{t('calc.title')}</span>
        <button onClick={onClose} aria-label={t('calc.close')}>
          ×
        </button>
      </div>
      <div className="calc-screen">
        <input
          ref={inputRef}
          className="calc-expr"
          aria-label={t('calc.input')}
          data-testid="calc-input"
          value={expr}
          onChange={(e) => {
            justEvaluated.current = false;
            setExpr(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              run();
            } else if (e.key === 'Escape') onClose();
          }}
        />
        <div className={result?.err ? 'calc-result err' : 'calc-result'} data-testid="calc-result">
          {result?.text ?? ''}
        </div>
      </div>
      <div className="calc-mode">
        {t('calc.angle')}
        <button className={angle === 'deg' ? 'btn small active' : 'btn small'} onClick={() => setAngle('deg')}>
          DEG
        </button>
        <button className={angle === 'rad' ? 'btn small active' : 'btn small'} onClick={() => setAngle('rad')}>
          RAD
        </button>
      </div>
      <div className="calc-keys">
        {KEYS.map((k) => (
          <button key={k.label} className={k.cls} title={k.title && t(k.title)} onClick={() => press(k)}>
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
