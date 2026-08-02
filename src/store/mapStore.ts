import { create } from 'zustand';
import { MapState } from '../model/types';
import { initialMap } from '../model/initialMap';
import { solveNodeLogic } from '../model/logic';
import { applyAgentDiscoveries, catalogExhausted, remainingCatalogCount } from '../model/agent';
import { isNodeAvailable } from '../model/access';
import {
  hydrateInitialState,
  saveMapToDb,
  clearMapDb,
  exportMapJson,
  importMapJson,
  resetMapWithZenodoSeed,
} from '../model/persistence';

interface MapStore extends MapState {
  hydrated: boolean;
  solveNode: (nodeId: string) => Promise<void>;
  getLatexProof: (nodeId: string) => string | null;
  hydrate: () => Promise<void>;
  saveNow: () => Promise<boolean>;
  resetMap: () => Promise<void>;
  downloadJson: () => void;
  loadFromJson: (text: string) => Promise<boolean>;
  runAgentDiscovery: (anchorNodeId?: string) => number;
  catalogRemaining: () => number;
  isCatalogExhausted: () => boolean;
  /** Ручное добавление узла по целевой функции (targetFunction). */
  addManualNode: (input: {
    title: string;
    targetFunction: string;
    description?: string;
    zoneId?: string;
    singularityHint?: string;
  }) => string | null;
}

function emptyState(): MapState {
  return {
    nodes: initialMap.nodes.map(n => ({ ...n, economic: { ...n.economic } })),
    edges: initialMap.edges.map(e => ({ ...e })),
    zones: initialMap.zones.map(z => ({
      ...z,
      nodeIds: [...z.nodeIds],
      economicProfile: { ...z.economicProfile },
    })),
    axioms: [...initialMap.axioms],
    proofs: { ...initialMap.proofs },
  };
}

export const useMapStore = create<MapStore>((set, get) => ({
  ...emptyState(),
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const state = await hydrateInitialState();
    set({ ...state, hydrated: true });
  },

  solveNode: async (nodeId: string) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || node.state === 'resolved' || state.proofs[nodeId]) {
      return;
    }
    if (!isNodeAvailable(node, state)) return;
    const newState = await solveNodeLogic(state, nodeId);
    set(newState);
    void saveMapToDb(newState);
  },

  getLatexProof: (nodeId: string) => {
    return get().proofs[nodeId]?.latex || null;
  },

  saveNow: async () => {
    return saveMapToDb(get());
  },

  resetMap: async () => {
    const state = await resetMapWithZenodoSeed();
    set({ ...state, hydrated: true });
  },

  downloadJson: () => {
    const json = exportMapJson(get());
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ricis3-map-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  loadFromJson: async (text: string) => {
    const loaded = await importMapJson(text);
    if (!loaded) return false;
    set({ ...loaded, hydrated: true });
    return true;
  },

  catalogRemaining: () => remainingCatalogCount(get()),

  isCatalogExhausted: () => catalogExhausted(get()),

  runAgentDiscovery: (anchorNodeId?: string) => {
    const state = get();
    const anchor =
      anchorNodeId ||
      state.nodes.find(n => n.id === 'core-agi-target')?.id ||
      state.nodes.find(n => n.state === 'resolved')?.id ||
      state.nodes[0]?.id;
    if (!anchor) return 0;
    const before = state.nodes.length;
    const next = applyAgentDiscoveries(state, anchor, 2);
    const added = next.nodes.length - before;
    if (added > 0) {
      set(next);
      void saveMapToDb(next);
    }
    return added;
  },

  addManualNode: (input) => {
    const title = (input.title || '').trim();
    const targetFunction = (input.targetFunction || '').trim();
    if (!title || !targetFunction) return null;

    const state = get();
    const baseId =
      'manual-' +
      targetFunction
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
    let id = baseId || 'manual-node';
    let n = 1;
    while (state.nodes.some(nd => nd.id === id)) {
      id = baseId + '-' + n;
      n += 1;
    }

    const zoneId =
      input.zoneId && state.zones.some(z => z.id === input.zoneId)
        ? input.zoneId
        : state.zones.find(z => z.id === 'math')?.id || state.zones[0]?.id || 'math';

    const description =
      (input.description || '').trim() ||
      'Пользовательская сингулярность. Целевая функция: ' +
        targetFunction +
        '. Решение через RICIS-III: SP2 → SP4 → A4/A5/A6 (0_F/0_G = F/G, 0_F×∞_G = F·G).';

    const node = {
      id,
      title,
      description,
      state: 'unresolved' as const,
      type: 'scientific_task' as const,
      targetFunction,
      zoneIds: [zoneId],
      dependencyIds: [] as string[],
      dependentIds: [] as string[],
      fractalDepth: 1,
      economic: {
        costUnresolved: 1_000_000,
        costToSolve: 50_000,
        marketGain: 2_000_000,
        riskLoss: 500_000,
      },
      rewardClass: 'reputation' as const,
      singularityHint: input.singularityHint || targetFunction,
      ricisSolvable: true,
    };

    const zones = state.zones.map(z =>
      z.id === zoneId ? { ...z, nodeIds: [...z.nodeIds, id] } : z
    );
    const next = {
      nodes: [...state.nodes, node],
      edges: state.edges,
      zones,
      axioms: state.axioms,
      proofs: state.proofs,
    };
    set(next);
    void saveMapToDb(next);
    return id;
  },
}));
