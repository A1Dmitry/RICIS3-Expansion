import React from 'react';
import type { ProblemNode } from '../model/types';

/** Normalize URL: add https:// if scheme is missing (www. or domain-like). */
function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^(www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(t)) return 'https://' + t;
  return t;
}

/** Render free text with clickable http(s) / www links. */
export function renderTextWithLinks(text: string) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const cleaned = part.replace(/[)\],.;:!?]+$/g, '');
      const trailing = part.slice(cleaned.length);
      const href = normalizeUrl(cleaned);
      return (
        <span key={i}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 hover:underline break-all"
            onClick={e => e.stopPropagation()}
          >
            {cleaned}
          </a>
          {trailing}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function extractSourceUrl(text?: string): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/i);
  if (!m) return null;
  return m[0].replace(/[)\],.;:!?]+$/g, '');
}

function formatCurrency(val?: number) {
  if (val === undefined || val === null) return '';
  if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
  return '$' + val.toLocaleString();
}

const TYPE_LABELS: Record<string, string> = {
  core_singularity: 'Ядро / сингулярность',
  derived_problem: 'Производная задача',
  scientific_task: 'Научная задача',
};

type Props = {
  node: ProblemNode;
  isExpanded: boolean;
};

/**
 * Expanded node card body:
 * description (with links), targetFunction, singularityHint,
 * dedicated source link, meta grid, economics.
 */
export const NodeCardDetails: React.FC<Props> = ({ node, isExpanded }) => {
  const fromFields =
    node.sourceUrl ||
    extractSourceUrl(node.description) ||
    extractSourceUrl(node.singularityHint) ||
    null;
  const src = fromFields ? normalizeUrl(fromFields) : null;
  const srcDisplay = fromFields || src;

  return (
    <div className={`space-y-3 ${isExpanded ? 'text-[12px]' : 'text-[11px]'}`}>
      <div>
        <p className="text-[9px] font-bold uppercase text-gray-500 tracking-wider mb-1">Описание</p>
        <p
          className={`text-gray-300 leading-relaxed whitespace-pre-wrap ${
            !isExpanded ? 'line-clamp-5' : ''
          }`}
        >
          {renderTextWithLinks(node.description || '—')}
        </p>
      </div>

      <div>
        <p className="text-[9px] font-bold uppercase text-gray-500 tracking-wider mb-1">Целевая функция</p>
        <code
          className={`block font-mono text-cyan-200 bg-black/80 p-2.5 rounded border border-gray-800 break-all whitespace-pre-wrap ${
            isExpanded ? 'text-[11px]' : 'text-[10px]'
          }`}
        >
          {node.targetFunction || '—'}
        </code>
      </div>

      {node.singularityHint && (
        <div className="p-2.5 bg-purple-950/25 border border-purple-900/50 rounded-md">
          <p className="text-[9px] font-bold uppercase text-purple-400/90 tracking-wider mb-1">
            Подсказка о сингулярности
          </p>
          <p className="text-purple-100/85 leading-relaxed whitespace-pre-wrap">
            {renderTextWithLinks(node.singularityHint)}
          </p>
        </div>
      )}

      {src && (
        <div className="p-2.5 bg-cyan-950/25 border border-cyan-800/50 rounded-md">
          <p className="text-[9px] font-bold uppercase text-cyan-500/90 tracking-wider mb-1.5">
            Источник / ссылка
          </p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1.5 text-cyan-300 hover:text-cyan-100 hover:underline break-all font-medium"
            onClick={e => e.stopPropagation()}
          >
            <span className="shrink-0 mt-0.5 text-cyan-500" aria-hidden>
              ↗
            </span>
            <span className="break-all">{srcDisplay}</span>
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded border border-neutral-800 bg-neutral-950/60">
          <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Тип</p>
          <p className="text-gray-200 font-mono text-[10px]">
            {TYPE_LABELS[node.type] || node.type || '—'}
          </p>
        </div>
        <div className="p-2 rounded border border-neutral-800 bg-neutral-950/60">
          <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Глубина</p>
          <p className="text-gray-200 font-mono text-[10px]">{node.fractalDepth ?? '—'}</p>
        </div>
        <div className="p-2 rounded border border-neutral-800 bg-neutral-950/60">
          <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Класс награды</p>
          <p className="text-gray-200 font-mono text-[10px]">{node.rewardClass || '—'}</p>
        </div>
        <div className="p-2 rounded border border-neutral-800 bg-neutral-950/60">
          <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Примечание</p>
          <p className="text-gray-200 leading-snug text-[10px]">{node.prizeNote || '—'}</p>
        </div>
      </div>

      {node.economic && (
        <div className="p-2.5 rounded border border-emerald-900/45 bg-emerald-950/20">
          <p className="text-[9px] font-bold uppercase text-emerald-500/90 tracking-wider mb-2">
            Экономика
          </p>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Оценка рынка</span>
              <span className="text-emerald-300">{formatCurrency(node.economic.marketGain) || '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Стоимость решения</span>
              <span className="text-amber-200/90">{formatCurrency(node.economic.costToSolve) || '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Убыток нерешения</span>
              <span className="text-red-300/90">{formatCurrency(node.economic.costUnresolved) || '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Риск-потери</span>
              <span className="text-orange-300/90">{formatCurrency(node.economic.riskLoss) || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {node.ricisSolvable && (
        <div className="text-[10px] text-cyan-400/90 border border-cyan-800/40 bg-cyan-950/20 rounded px-2 py-1.5">
          Решаема протоколом RICIS-III
        </div>
      )}
    </div>
  );
};
