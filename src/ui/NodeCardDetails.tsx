import React from 'react';
import type { ProblemNode } from '../model/types';

/** Render free text with clickable http(s) links. */
export function renderTextWithLinks(text: string) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      const cleaned = part.replace(/[)\],.;:]+$/g, '');
      const trailing = part.slice(cleaned.length);
      return (
        <span key={i}>
          <a
            href={cleaned}
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
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return null;
  return m[0].replace(/[)\],.;:]+$/g, '');
}

function formatCurrency(val?: number) {
  if (val === undefined || val === null) return '';
  if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
  return '$' + val.toLocaleString();
}

type Props = {
  node: ProblemNode;
  isExpanded: boolean;
};

/** Expanded node card body: description, target, hint, source link, meta, economics. */
export const NodeCardDetails: React.FC<Props> = ({ node, isExpanded }) => {
  const src = extractSourceUrl(node.description) || extractSourceUrl(node.singularityHint);

  return (
    <>
      <div className="mb-3">
        <p className="text-[9px] font-bold uppercase text-gray-500 tracking-wider mb-1">Описание</p>
        <p className={`text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap ${!isExpanded && 'line-clamp-6'}`}>
          {renderTextWithLinks(node.description)}
        </p>
      </div>

      <div className="mb-3">
        <p className="text-[9px] font-bold uppercase text-gray-500 tracking-wider mb-1">Целевая функция</p>
        <code className="block text-[10px] bg-black p-2 rounded border border-gray-800 font-mono text-cyan-200 break-all whitespace-pre-wrap">
          {node.targetFunction || '—'}
        </code>
      </div>

      {node.singularityHint && (
        <div className="mb-3 p-2 bg-purple-950/20 border border-purple-900/40 rounded-md">
          <p className="text-[9px] font-bold uppercase text-purple-400/90 tracking-wider mb-1">Подсказка о сингулярности</p>
          <p className="text-[10px] text-purple-200/80 leading-relaxed whitespace-pre-wrap">
            {renderTextWithLinks(node.singularityHint)}
          </p>
        </div>
      )}

      {src && (
        <div className="mb-3 p-2 bg-cyan-950/20 border border-cyan-900/40 rounded-md">
          <p className="text-[9px] font-bold uppercase text-cyan-500/90 tracking-wider mb-1">Источник / ссылка</p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-cyan-300 hover:text-cyan-200 hover:underline break-all"
            onClick={e => e.stopPropagation()}
          >
            {src}
          </a>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="p-2 rounded border border-neutral-800 bg-neutral-950/50">
          <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Тип</p>
          <p className="text-gray-300 font-mono">{node.type || '—'}</p>
        </div>
        <div className="p-2 rounded border border-neutral-800 bg-neutral-950/50">
          <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Глубина</p>
          <p className="text-gray-300 font-mono">{node.fractalDepth ?? '—'}</p>
        </div>
        {(node.rewardClass || node.prizeNote) && (
          <>
            <div className="p-2 rounded border border-neutral-800 bg-neutral-950/50">
              <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Класс награды</p>
              <p className="text-gray-300 font-mono">{node.rewardClass || '—'}</p>
            </div>
            <div className="p-2 rounded border border-neutral-800 bg-neutral-950/50">
              <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Примечание</p>
              <p className="text-gray-300 leading-snug">{node.prizeNote || '—'}</p>
            </div>
          </>
        )}
      </div>

      {node.economic && (
        <div className="mb-3 p-2 rounded border border-emerald-900/40 bg-emerald-950/15">
          <p className="text-[9px] font-bold uppercase text-emerald-500/90 tracking-wider mb-2">Экономика</p>
          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
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
    </>
  );
};
