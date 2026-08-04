import React, { useState } from 'react';
import { useMapStore } from '../store/mapStore';
import { ProblemNode } from '../model/types';

export function AddNodeModal({ onClose, parentId }: { onClose: () => void; parentId?: string }) {
  const map = useMapStore();
  
  const [title, setTitle] = useState('');
  const [targetFunction, setTargetFunction] = useState('');
  const [description, setDescription] = useState('');
  const [hint, setHint] = useState('');
  const [link, setLink] = useState('');
  const [zoneId, setZoneId] = useState(map.zones.length > 0 ? map.zones[0].id : 'math');
  const [newZoneName, setNewZoneName] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAI = async () => {
    if (!title && !targetFunction) {
      setErrorMsg("Введите хотя бы название или функцию!");
      return;
    }
    setErrorMsg('');
    setLoadingAI(true);
    try {
      const res = await fetch('/api/aiAssistantNode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, targetFunction })
      });
      const data = await res.json();
      if (data.title && !title) setTitle(data.title);
      if (data.normalizedFunction) setTargetFunction(data.normalizedFunction);
      if (data.description) setDescription(data.description);
      if (data.hint) setHint(data.hint);
      if (data.link) setLink(data.link);
    } catch (e) {
      console.error(e);
      setErrorMsg('Ошибка при запросе к ИИ');
    }
    setLoadingAI(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    
    const normalizedLink = link.trim()
      ? (/^https?:\/\//i.test(link.trim())
          ? link.trim()
          : 'https://' + link.trim().replace(/^\/+/, ''))
      : undefined;

    const node: ProblemNode = {
      id: 'custom-node-' + Date.now(),
      title,
      description: description + (normalizedLink ? `\nИсточник: ${normalizedLink}` : ''),
      targetFunction: targetFunction || 'Formalize(N/A)',
      state: 'unresolved',
      type: 'scientific_task',
      zoneIds: [zoneId],
      dependencyIds: [],
      dependentIds: [],
      fractalDepth: 1,
      economic: {
        costUnresolved: 100000000,
        costToSolve: 10000000,
        marketGain: 500000000,
        riskLoss: 200000000
      },
      rewardClass: 'reputation',
      prizeNote: 'Manual addition',
      singularityHint: hint || 'Неизвестно',
      sourceUrl: normalizedLink,
    };

    await map.addCustomNode(node, parentId, zoneId === 'NEW_ZONE' ? newZoneName : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#050505] border border-cyan-800/60 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_40px_rgba(34,211,238,0.15)] text-gray-300">
        <h2 className="text-xl font-bold text-cyan-400 mb-4 uppercase tracking-widest">
          {parentId ? 'Добавить зависимую ноду' : 'Новая научная проблема (Нода)'}
        </h2>
        {parentId && (
          <p className="text-xs text-gray-500 mb-4">
            Будет создана как зависимая от: <span className="text-cyan-300">{map.nodes.find(n => n.id === parentId)?.title}</span>
          </p>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Название проблемы</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-neutral-700 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none" placeholder="Например: Гладкое решение уравнений Навье-Стокса" />
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Целевая функция / Формула</label>
              <input value={targetFunction} onChange={e => setTargetFunction(e.target.value)} className="w-full bg-black border border-neutral-700 rounded p-2 text-sm font-mono text-cyan-200 focus:border-cyan-500 outline-none" placeholder="lim_{x \\to 0} F(x) = \\infty" />
            </div>
            <button type="button" onClick={handleAI} disabled={loadingAI} className="px-4 py-2 bg-violet-900/50 border border-violet-700 hover:bg-violet-800/60 text-violet-200 rounded font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-colors">
              {loadingAI ? 'Загрузка...' : 'Поиск ИИ 🪄'}
            </button>
          </div>
          {errorMsg && <p className="text-red-400 text-[10px] col-span-2">{errorMsg}</p>}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Научная зона</label>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)} className="w-full bg-black border border-neutral-700 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none">
              {map.zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
              <option value="NEW_ZONE">+ Добавить новую зону</option>
            </select>
          </div>

          {zoneId === 'NEW_ZONE' && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Название новой зоны</label>
              <input required value={newZoneName} onChange={e => setNewZoneName(e.target.value)} className="w-full bg-black border border-neutral-700 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none" placeholder="Например: Квантовая биология" />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-black border border-neutral-700 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none" placeholder="Научное описание проблемы..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Подсказка о сингулярности</label>
            <input value={hint} onChange={e => setHint(e.target.value)} className="w-full bg-black border border-neutral-700 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none" placeholder="Где возникает расходимость или деление на ноль?" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ссылка (Wiki / Источник)</label>
            <input value={link} onChange={e => setLink(e.target.value)} className="w-full bg-black border border-neutral-700 rounded p-2 text-sm text-blue-300 focus:border-cyan-500 outline-none" placeholder="https://ru.wikipedia.org/wiki/..." />
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-neutral-800">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-neutral-600 rounded text-gray-400 hover:text-white hover:border-gray-400 text-xs font-bold uppercase">
              Отмена
            </button>
            <button type="submit" className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold uppercase tracking-wider">
              Сохранить Ноду
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
