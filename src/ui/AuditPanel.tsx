import React, { useState } from 'react';
import { useMapStore } from '../store/mapStore';

/** Sidebar controls: audit missing targets + agent fill. */
export const AuditPanel: React.FC = () => {
  const map = useMapStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleAudit = async () => {
    setBusy(true);
    setMsg('Аудит: обход дерева, поиск узлов без целевой функции…');
    try {
      const r = await map.runAuditMissingTargets();
      setMsg(
        'Аудит: без целевой ' +
          r.missingCount +
          ', переведены в жёлтый (partial): ' +
          r.demoted +
          '.'
      );
    } catch (e: any) {
      setMsg('Аудит ошибка: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleFill = async () => {
    setBusy(true);
    setMsg('Агент заполняет целевые функции (поиск формулировок)…');
    try {
      const r = await map.runFillMissingTargets();
      const errTail = r.errors?.length
        ? ' Ошибки: ' + r.errors.slice(0, 3).join('; ')
        : '';
      setMsg(
        'Заполнено целевых: ' + r.filled + ', сбоев: ' + r.failed + '.' + errTail
      );
    } catch (e: any) {
      setMsg('Заполнение ошибка: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 space-y-1">
      <button
        type="button"
        onClick={() => void handleAudit()}
        disabled={busy}
        className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-amber-800/50 bg-amber-950/30 text-amber-300 disabled:opacity-50"
      >
        Аудит: без целевой → жёлтые
      </button>
      <button
        type="button"
        onClick={() => void handleFill()}
        disabled={busy}
        className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-amber-700/50 bg-amber-950/40 text-amber-200 disabled:opacity-50"
      >
        Агент: заполнить целевые функции
      </button>
      {msg && <p className="text-[10px] text-amber-300/90 mt-1 leading-snug">{msg}</p>}
    </div>
  );
};
