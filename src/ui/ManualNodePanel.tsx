import React from 'react';

type Props = {
  manualTitle: string;
  setManualTitle: (v: string) => void;
  manualTf: string;
  setManualTf: (v: string) => void;
  manualDesc: string;
  setManualDesc: (v: string) => void;
  manualZone: string;
  setManualZone: (v: string) => void;
  zones: { id: string; name: string }[];
  showManualHelp: boolean;
  setShowManualHelp: (fn: (v: boolean) => boolean) => void;
  manualMsg: string | null;
  onAdd: () => void;
  onExample: (kind: '00' | '0inf' | 'infinf') => void;
};

export function ManualNodePanel(p: Props) {
  return (
    <section>
      <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-2">
        Добавить узел вручную
      </h3>
      <p className="text-[9px] text-gray-500 mb-2 leading-snug">
        Запишите <span className="text-cyan-400">целевую функцию</span> сингулярности
        (0/0, 0·∞, ∞/∞ и др.). Узел появится на карте в выбранной зоне.
      </p>
      <div className="space-y-1.5">
        <input
          type="text"
          value={p.manualTitle}
          onChange={e => p.setManualTitle(e.target.value)}
          placeholder="Название узла"
          className="w-full px-2 py-1.5 text-[11px] rounded border border-neutral-700 bg-black text-gray-200 placeholder:text-gray-600"
        />
        <input
          type="text"
          value={p.manualTf}
          onChange={e => p.setManualTf(e.target.value)}
          placeholder="Целевая функция, напр. 0/0 ~ lim (sin x)/x"
          className="w-full px-2 py-1.5 text-[11px] rounded border border-neutral-700 bg-black text-cyan-200 font-mono placeholder:text-gray-600"
        />
        <textarea
          value={p.manualDesc}
          onChange={e => p.setManualDesc(e.target.value)}
          placeholder="Описание (необязательно)"
          rows={3}
          className="w-full px-2 py-1.5 text-[10px] rounded border border-neutral-700 bg-black text-gray-300 placeholder:text-gray-600 resize-y"
        />
        <select
          value={p.manualZone}
          onChange={e => p.setManualZone(e.target.value)}
          className="w-full px-2 py-1.5 text-[11px] rounded border border-neutral-700 bg-black text-gray-200"
        >
          {p.zones.map(z => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => p.onExample('00')} className="px-1.5 py-0.5 text-[9px] rounded border border-cyan-900/60 text-cyan-400 hover:bg-cyan-950/40">пример 0/0</button>
          <button type="button" onClick={() => p.onExample('0inf')} className="px-1.5 py-0.5 text-[9px] rounded border border-amber-900/60 text-amber-400 hover:bg-amber-950/40">пример 0·∞</button>
          <button type="button" onClick={() => p.onExample('infinf')} className="px-1.5 py-0.5 text-[9px] rounded border border-violet-900/60 text-violet-400 hover:bg-violet-950/40">пример ∞/∞</button>
        </div>
        <button
          type="button"
          onClick={p.onAdd}
          className="w-full py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-700/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40"
        >
          Добавить на карту
        </button>
        <button
          type="button"
          onClick={() => p.setShowManualHelp(v => !v)}
          className="w-full text-left text-[9px] text-gray-500 hover:text-gray-300"
        >
          {p.showManualHelp ? '▾ Скрыть инструкцию' : '▸ Как добавить (инструкция)'}
        </button>
        {p.showManualHelp && (
          <div className="text-[9px] text-gray-400 leading-relaxed border border-neutral-800 rounded p-2 bg-neutral-950/80 space-y-1.5">
            <p className="text-cyan-500 font-semibold">Как вручную добавить сингулярность</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Введите <b>название</b> (коротко, по смыслу задачи).</li>
              <li>В <b>целевую функцию</b> запишите выражение с неопределённостью, например:
                <code className="block mt-0.5 text-cyan-300 font-mono">0/0 ~ lim (sin x)/x</code>
                <code className="block text-amber-300 font-mono">0*∞ ~ lim x·ln x (x→0+)</code>
                <code className="block text-violet-300 font-mono">∞/∞ ~ lim (2x)/(x+1)</code>
              </li>
              <li>Описание — зачем задача и какой закон RICIS (SP2/SP3/A6) ожидается.</li>
              <li>Выберите зону (обычно Mathematics) → «Добавить на карту».</li>
              <li>Выберите узел на карте или в списке → «Execute RICIS Solution».</li>
            </ol>
            <p className="text-gray-500">
              Типовая средняя сложность: неопределённости 0/0, 0·∞, ∞/∞.
              Кнопки «пример …» подставляют готовые формулировки.
            </p>
          </div>
        )}
        {p.manualMsg && <p className="text-[10px] text-emerald-400">{p.manualMsg}</p>}
      </div>
    </section>
  );
}
