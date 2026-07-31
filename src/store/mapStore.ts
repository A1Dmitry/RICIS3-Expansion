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
} from '../model/persistence';

interface MapStore extends MapState {
  hydrated: boolean;
  solveNode: (nodeId: string) => void;
  getLatexProof: (nodeId: string) => string | null;
  hydrate: () => Promise<void>;
  saveNow: () => Promise<boolean>;
  resetMap: () => Promise<void>;
  downloadJson: () => void;
  loadFromJson: (text: string) => Promise<boolean>;
  runAgentDiscovery: (anchorNodeId?: string) => number;
  catalogRemaining: () => number;
  isCatalogExhausted: () => boolean;
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

  solveNode: (nodeId: string) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || node.state === 'resolved' || state.proofs[nodeId]) {
      return;
    }
    if (!isNodeAvailable(node, state)) return;
    const newState = solveNodeLogic(state, nodeId);
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
    await clearMapDb();
    set({ ...emptyState(), hydrated: true });
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
}));
