import React, { useState, useEffect } from 'react';
import { useMapStore } from '../store/mapStore';
import { dbGetMigrationState } from '../model/db';
import { MigrationAuditReport } from '../model/migrationAudit';

/** Sidebar controls: DB Migration Audit + audit missing targets + agent fill + derivative search. */
export const AuditPanel: React.FC = () => {
  const map = useMapStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [migrationInfo, setMigrationInfo] = useState<{ version: number; report?: MigrationAuditReport } | null>(null);

  useEffect(() => {
    void dbGetMigrationState().then(st => {
      if (st) setMigrationInfo(st as any);
    });
  }, [map.nodes.length]);

  const handleMigrationAudit = async () => {
    setBusy(true);
    setMsg('Запуск разовой миграции v3: переоценка монетизации и связей...');
    try {
      const report = await map.runAuditMigration(true);
      setMigrationInfo({ version: report.dbVersion, report });
      setMsg(
        `Миграция v${report.dbVersion} завершена! Узлов аудировано: ${report.totalNodesAudited}. ` +
        `Монетизация переоценена: ${report.economicReevaluated} узлов. ` +
        `Исправлено названий: ${report.titlesFixed}, восстановлено связей: ${report.connectionsFixed} ` +
        `(сирот: ${report.orphanNodesReconnected}), ребер перестроено: ${report.edgesRebuilt}.`
      );
    } catch (e: any) {
      setMsg('Миграция БД ошибка: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

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

  const handleDerivatives = async () => {
    setBusy(true);
    setMsg(
      'Поиск производных / переименованных реализаций RICIS (SP2, A6, 0_F/0_G, no lim)…'
    );
    try {
      const r = await map.runDerivativeSearch();
      if (r.error) {
        setMsg('Поиск производных: ' + r.error);
      } else {
        setMsg(
          'Производные (фиолетовые): добавлено ' +
            r.added +
            ' из ' +
            r.hits +
            ' кандидатов. В карточке — дата первого упоминания и связи с math-singularity.'
        );
      }
    } catch (e: any) {
      setMsg('Поиск производных ошибка: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-1.5 border-t border-cyan-900/40 pt-2">
      <div className="flex items-center justify-between text-[10px] text-cyan-400 font-mono mb-1">
        <span>Статус БД: <strong className="text-emerald-400">v{migrationInfo?.version || 3}</strong></span>
        {migrationInfo?.version && migrationInfo.version >= 3 ? (
          <span className="text-[9px] text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">v3 Монетизация переоценена</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void handleMigrationAudit()}
        disabled={busy}
        className="w-full text-left px-2.5 py-2 text-[11px] font-semibold rounded border border-emerald-600/60 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/50 hover:border-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
      >
        🔄 Миграция v3: Переоценка монетизации всех узлов
      </button>

      <button
        type="button"
        onClick={() => void handleAudit()}
        disabled={busy}
        className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-amber-800/50 bg-amber-950/30 text-amber-300 disabled:opacity-50 hover:bg-amber-900/30"
      >
        Аудит: без целевой → жёлтые
      </button>
      <button
        type="button"
        onClick={() => void handleFill()}
        disabled={busy}
        className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-amber-700/50 bg-amber-950/40 text-amber-200 disabled:opacity-50 hover:bg-amber-900/40"
      >
        Агент: заполнить целевые функции
      </button>
      <button
        type="button"
        onClick={() => void handleDerivatives()}
        disabled={busy}
        className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-violet-700/60 bg-violet-950/40 text-violet-200 disabled:opacity-50 hover:bg-violet-900/40"
      >
        Поиск производных RICIS → фиолетовые
      </button>
      {msg && <p className="text-[10px] text-cyan-200 bg-cyan-950/60 p-2 rounded border border-cyan-800/50 mt-1 leading-snug">{msg}</p>}
    </div>
  );
};
