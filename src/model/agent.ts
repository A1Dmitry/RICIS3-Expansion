import { MapState, ProblemNode, DependencyEdge } from './types';

/** Normalize for dedup: title + targetFunction. */
export function normalizeProblemKey(title: string, targetFunction?: string): string {
  const t = (title || '')
    .toLowerCase()
    .replace(/[\u00ab\u00bb\"\']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const f = (targetFunction || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
  return t + '|' + f;
}

export function existingProblemKeys(map: MapState): Set<string> {
  const keys = new Set<string>();
  for (const n of map.nodes) {
    keys.add(normalizeProblemKey(n.title, n.targetFunction));
    keys.add(normalizeProblemKey(n.title, ''));
  }
  return keys;
}

/** Children via edges (from->to) and dependentIds. */
export function getChildIds(map: MapState, nodeId: string): string[] {
  const fromEdges = map.edges.filter(e => e.fromId === nodeId).map(e => e.toId);
  const node = map.nodes.find(n => n.id === nodeId);
  const fromDeps = node?.dependentIds ?? [];
  return Array.from(new Set([...fromEdges, ...fromDeps]));
}

export function isGraphLeaf(map: MapState, nodeId: string): boolean {
  return getChildIds(map, nodeId).length === 0;
}

/** Nodes with no children — expansion frontier. Prefer resolved. */
export function nodesWithoutLeaves(map: MapState): ProblemNode[] {
  const candidates = map.nodes.filter(n => isGraphLeaf(map, n.id));
  const rank = (s: string) => (s === 'resolved' ? 0 : s === 'partial' ? 1 : 2);
  return [...candidates].sort((a, b) => {
    const dr = rank(a.state) - rank(b.state);
    if (dr !== 0) return dr;
    return b.fractalDepth - a.fractalDepth;
  });
}

/** BFS walk from roots (no dependencyIds). */
export function walkGraph(map: MapState, startIds?: string[]): string[] {
  const starts =
    startIds && startIds.length > 0
      ? startIds
      : map.nodes.filter(n => (n.dependencyIds?.length ?? 0) === 0).map(n => n.id);
  const visited = new Set<string>();
  const order: string[] = [];
  const queue = [...starts];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);
    for (const c of getChildIds(map, id)) {
      if (!visited.has(c)) queue.push(c);
    }
  }
  for (const n of map.nodes) {
    if (!visited.has(n.id)) {
      visited.add(n.id);
      order.push(n.id);
    }
  }
  return order;
}

export function catalogExhausted(map: MapState): boolean {
  return nodesWithoutLeaves(map).filter(n => n.state === 'resolved').length === 0;
}

export function remainingCatalogCount(map: MapState): number {
  return nodesWithoutLeaves(map).length;
}

function isDuplicateTask(
  task: { title?: string; targetFunction?: string },
  keys: Set<string>
): boolean {
  const k1 = normalizeProblemKey(task.title || '', task.targetFunction || '');
  const k2 = normalizeProblemKey(task.title || '', '');
  return keys.has(k1) || keys.has(k2);
}

export async function discoverNewProblems(
  map: MapState,
  anchorNodeId: string,
  maxNew = 2,
  extraKeys?: Set<string>
): Promise<{ nodes: ProblemNode[]; edges: DependencyEdge[] }> {
  const anchor = map.nodes.find(n => n.id === anchorNodeId);
  if (!anchor) return { nodes: [], edges: [] };

  const keys = extraKeys ?? existingProblemKeys(map);
  const existingTitles = map.nodes.map(n => n.title);

  let fetchedTasks: Array<{
    title?: string;
    description?: string;
    targetFunction?: string;
    singularityHint?: string;
    zoneId?: string;
    type?: string;
  }> = [];

  try {
    const res = await fetch('/api/discoverTasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentNode: anchor, existingTitles }),
    });
    const data = await res.json();
    if (data.tasks && Array.isArray(data.tasks)) {
      fetchedTasks = data.tasks;
    }
  } catch (e) {
    console.error('Failed to discover tasks via API', e);
  }

  const nodes: ProblemNode[] = [];
  const edges: DependencyEdge[] = [];
  const stamp = Date.now();

  for (let i = 0; i < fetchedTasks.length && nodes.length < maxNew; i++) {
    const task = fetchedTasks[i];
    if (!task?.title) continue;
    if (isDuplicateTask(task, keys)) continue;

    const id = `agent-${anchorNodeId}-${stamp}-${i}`;
    const title = String(task.title).trim();
    const targetFunction = String(
      task.targetFunction || `f(${anchor.targetFunction})`
    ).trim();

    keys.add(normalizeProblemKey(title, targetFunction));
    keys.add(normalizeProblemKey(title, ''));

    const node: ProblemNode = {
      id,
      title,
      description:
        task.description ||
        `Derived from "${anchor.title}" (graph walk, node without leaves).`,
      state: 'unresolved',
      type: (task.type as ProblemNode['type']) || 'scientific_task',
      targetFunction,
      zoneIds: task.zoneId ? [task.zoneId] : [...anchor.zoneIds],
      dependencyIds: [anchorNodeId],
      dependentIds: [],
      fractalDepth: anchor.fractalDepth + 1,
      economic: {
        costUnresolved: Math.round(anchor.economic.costUnresolved * 0.45),
        costToSolve: Math.round(anchor.economic.costToSolve * 0.35),
        marketGain: Math.round(anchor.economic.marketGain * 0.4),
        riskLoss: Math.round(anchor.economic.riskLoss * 0.45),
      },
      rewardClass: 'reputation',
      prizeNote: 'Agent discovery (graph walk)',
      singularityHint: task.singularityHint || 'hidden singularity',
    };
    nodes.push(node);
    edges.push({
      id: `edge-${anchorNodeId}-${id}`,
      fromId: anchorNodeId,
      toId: id,
      strength: 0.65,
      stateColor: 'red',
      economicInfluence: 0.4,
    });
  }

  return { nodes, edges };
}

export type DiscoveryReport = {
  map: MapState;
  added: number;
  expandedAnchors: string[];
  skippedDuplicates: number;
  frontierSize: number;
};

/**
 * Full pass:
 * 1) walkGraph order
 * 2) nodesWithoutLeaves as anchors
 * 3) discover + dedup per anchor
 * 4) merge into map
 */
export async function applyAgentDiscoveries(
  map: MapState,
  anchorNodeId?: string,
  maxNewPerAnchor = 2,
  maxAnchors = 6
): Promise<DiscoveryReport> {
  const keys = existingProblemKeys(map);
  const frontier = nodesWithoutLeaves(map);

  let anchors: ProblemNode[] = [];
  if (anchorNodeId) {
    const explicit = map.nodes.find(n => n.id === anchorNodeId);
    if (explicit) anchors.push(explicit);
  }
  for (const n of frontier) {
    if (!anchors.some(a => a.id === n.id)) anchors.push(n);
  }
  anchors = anchors.slice(0, maxAnchors);

  let working: MapState = map;
  let added = 0;
  const expandedAnchors: string[] = [];
  let skippedDuplicates = 0;

  const walkOrder = walkGraph(working);
  anchors.sort((a, b) => walkOrder.indexOf(a.id) - walkOrder.indexOf(b.id));

  for (const anchor of anchors) {
    const beforeKeys = keys.size;
    const { nodes, edges } = await discoverNewProblems(
      working,
      anchor.id,
      maxNewPerAnchor,
      keys
    );
    if (nodes.length === 0) {
      skippedDuplicates += beforeKeys === keys.size ? 1 : 0;
      continue;
    }

    const childIds = nodes.map(n => n.id);
    const updatedNodes = working.nodes.map(n =>
      n.id === anchor.id
        ? { ...n, dependentIds: [...new Set([...n.dependentIds, ...childIds])] }
        : n
    );
    const zones = working.zones.map(z => {
      const addIds = nodes.filter(nn => nn.zoneIds.includes(z.id)).map(nn => nn.id);
      if (addIds.length === 0) return z;
      return { ...z, nodeIds: [...new Set([...z.nodeIds, ...addIds])] };
    });

    working = {
      ...working,
      nodes: [...updatedNodes, ...nodes],
      edges: [...working.edges, ...edges],
      zones,
    };
    added += nodes.length;
    expandedAnchors.push(anchor.id);
  }

  return {
    map: working,
    added,
    expandedAnchors,
    skippedDuplicates,
    frontierSize: nodesWithoutLeaves(map).length,
  };
}
