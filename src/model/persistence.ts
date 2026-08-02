import { MapState, Proof, ProblemNode, DependencyEdge, Axiom, ScienceZone } from './types';
import { initialMap } from './initialMap';
import { dbSaveMap, dbLoadMap, dbClear } from './db';
import {
  runZenodoMigrationIfEmpty,
  forceZenodoReseed,
  buildZenodoSeedState,
  ZENODO_MIGRATION_VERSION,
} from './zenodoMigration';

/** @deprecated Legacy localStorage snapshot (миграция). */
const LEGACY_KEY = 'ricis3-map-v1';

export interface PersistedSnapshot {
  version: 1;
  nodes: ProblemNode[];
  edges: DependencyEdge[];
  zones: ScienceZone[];
  axioms: Axiom[];
  proofs: Record<string, Proof>;
  savedAt: string;
}

export function toSnapshot(state: MapState): PersistedSnapshot {
  return {
    version: 1,
    nodes: state.nodes,
    edges: state.edges,
    zones: state.zones,
    axioms: state.axioms,
    proofs: state.proofs,
    savedAt: new Date().toISOString(),
  };
}

export function fromSnapshot(s: PersistedSnapshot): MapState | null {
  if (s.version !== 1) return null;
  if (!Array.isArray(s.nodes) || !Array.isArray(s.edges) || !Array.isArray(s.zones)) return null;
  return {
    nodes: s.nodes,
    edges: s.edges,
    zones: s.zones,
    axioms: Array.isArray(s.axioms) ? s.axioms : [],
    proofs: s.proofs && typeof s.proofs === 'object' ? s.proofs : {},
  };
}

function loadLegacyLocalStorage(): MapState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSnapshot;
    return fromSnapshot(parsed);
  } catch {
    return null;
  }
}

export async function hydrateInitialState(): Promise<MapState> {
  const fromDb = await dbLoadMap();
  if (fromDb && fromDb.nodes.length > 0) return fromDb;

  const legacy = loadLegacyLocalStorage();
  if (legacy && legacy.nodes.length > 0) {
    await dbSaveMap(legacy);
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
    return legacy;
  }

  try {
    const migrated = await runZenodoMigrationIfEmpty();
    if (migrated) {
      const after = await dbLoadMap();
      if (after && after.nodes.length > 0) return after;
    }
  } catch (e) {
    console.warn('Zenodo migration failed, falling back to in-memory seed', e);
  }

  return buildZenodoSeedState();
}

export async function saveMapToDb(state: MapState): Promise<boolean> {
  try {
    await dbSaveMap(state);
    return true;
  } catch (e) {
    console.error('saveMapToDb', e);
    return false;
  }
}

export async function clearMapDb(): Promise<void> {
  await dbClear();
}

export async function resetMapWithZenodoSeed(): Promise<MapState> {
  await dbClear();
  await forceZenodoReseed();
  const state = await dbLoadMap();
  if (state && state.nodes.length > 0) return state;
  return buildZenodoSeedState();
}

export function exportMapJson(state: MapState): string {
  return JSON.stringify(toSnapshot(state), null, 2);
}

export async function importMapJson(text: string): Promise<MapState | null> {
  try {
    const parsed = JSON.parse(text) as PersistedSnapshot;
    const state = fromSnapshot(parsed);
    if (!state) return null;
    await dbSaveMap(state);
    return state;
  } catch {
    return null;
  }
}

export { ZENODO_MIGRATION_VERSION, buildZenodoSeedState };
