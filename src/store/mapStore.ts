import { create } from 'zustand';
import { MapState, ProblemNode, DependencyEdge, Zone } from '../model/types';
import { initialMap } from '../model/initialMap';
import { solveNodeLogic } from '../model/logic';
import { applyAgentDiscoveries, catalogExhausted, remainingCatalogCount } from '../model/agent';
import { auditMarkMissingTargets, fillMissingTargetFunctions } from '../model/audit';
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
  solveNode: (nodeId: string) => Promise<void>;
  getLatexProof: (nodeId: string) => string | null;
  hydrate: () => Promise<void>;
  saveNow: () => Promise<boolean>;
  resetMap: () => Promise<void>;
  downloadJson: () => void;
  loadFromJson: (text: string) => Promise<boolean>;
  runAgentDiscovery: (anchorNodeId?: string) => Promise<{ added: number; error?: string }>;
  addCustomNode: (node: ProblemNode, parentId?: string, newZoneName?: string) => Promise<void>;
  catalogRemaining: () => number;
  isCatalogExhausted: () => boolean;
  runAuditMissingTargets: () => Promise<{ missingCount: number; demoted: number; missingIds: string[] }>;
  runFillMissingTargets: () => Promise<{ filled: number; failed: number; errors: string[]; filledIds: string[] }>;
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

  addCustomNode: async (node, parentId, newZoneName) => {
    const state = get();
    let newZones = [...state.zones];
    let zoneId = node.zoneIds[0] || 'math';

    if (newZoneName) {
      const existingZone = newZones.find(z => z.name.toLowerCase() === newZoneName.toLowerCase());
      if (existingZone) {
        zoneId = existingZone.id;
        node.zoneIds = [zoneId];
      } else {
        zoneId = 'zone-' + Date.now();
        node.zoneIds = [zoneId];
        newZones.push({
          id: zoneId,
          name: newZoneName,
          baseColor: '#00ff00',
          nodeIds: [],
          economicProfile: {
            marketSize: 100000000,
            monopolyRisk: 0.5,
          },
        } as any);
      }
    }

    const updatedZones = newZones.map(z =>
      z.id === zoneId ? { ...z, nodeIds: [...z.nodeIds, node.id] } : z
    );

    let newEdges = [...state.edges];
    let updatedNodes = [...state.nodes];

    if (parentId) {
      const parent = updatedNodes.find(n => n.id === parentId);
      if (parent) {
        parent.dependentIds = [...new Set([...parent.dependentIds, node.id])];
        node.dependencyIds = [...new Set([...node.dependencyIds, parentId])];
        node.fractalDepth = parent.fractalDepth + 1;
        newEdges.push({
          id: `edge-${parentId}-${node.id}`,
          fromId: parentId,
          toId: node.id,
          strength: 0.8,
          stateColor: 'red',
          economicInfluence: 0.5,
        });
      }
    }

    updatedNodes.push(node);

    const newState = {
      ...state,
      nodes: updatedNodes,
      edges: newEdges,
      zones: updatedZones,
    };

    set(newState);
    void saveMapToDb(newState);
  },

  runAgentDiscovery: async (anchorNodeId?: string) => {
    const state = get();
    const report = await applyAgentDiscoveries(state, anchorNodeId, 2, 6);
    if (report.added > 0) {
      set(report.map);
      void saveMapToDb(report.map);
    }
    return { added: report.added, error: report.error };
  },

  runAuditMissingTargets: async () => {
    const state = get();
    const report = auditMarkMissingTargets(state);
    set({ ...report.map, hydrated: true });
    void saveMapToDb(report.map);
    return {
      missingCount: report.missingCount,
      demoted: report.demotedIds.length,
      missingIds: report.missingIds,
    };
  },

  runFillMissingTargets: async () => {
    const state = get();
    const result = await fillMissingTargetFunctions(state, { maxNodes: 40, delayMs: 350 });
    set({ ...result.map, hydrated: true });
    void saveMapToDb(result.map);
    return {
      filled: result.filled,
      failed: result.failed,
      errors: result.errors,
      filledIds: result.filledIds,
    };
  },
}));
