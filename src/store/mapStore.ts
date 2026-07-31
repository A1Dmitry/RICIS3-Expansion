import { create } from 'zustand';
import { MapState } from '../model/types';
import { initialMap } from '../model/initialMap';
import { solveNodeLogic } from '../model/logic';

interface MapStore extends MapState {
  solveNode: (nodeId: string) => void;
  getLatexProof: (nodeId: string) => string | null;
}

export const useMapStore = create<MapStore>((set, get) => ({
  ...initialMap,
  solveNode: (nodeId: string) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || node.state === 'resolved' || state.proofs[nodeId]) {
      return; 
    }
    const newState = solveNodeLogic(state, nodeId);
    set(newState);
  },
  getLatexProof: (nodeId: string) => {
    const state = get();
    return state.proofs[nodeId]?.latex || null;
  }
}));
