const fs = require('fs');

let code = `import { MapState, ProblemNode, DependencyEdge } from './types';

const KNOWN_SINGULARITY_PROBLEMS: Array<{ id: string }> = [];

export function catalogExhausted(map: MapState): boolean {
  return true;
}

export function remainingCatalogCount(map: MapState): number {
  return 0;
}

export async function discoverNewProblems(
  map: MapState,
  anchorNodeId: string,
  maxNew = 2
): Promise<{ nodes: ProblemNode[]; edges: DependencyEdge[] }> {
  const anchor = map.nodes.find(n => n.id === anchorNodeId);
  if (!anchor) return { nodes: [], edges: [] };

  const existingTitles = map.nodes.map(n => n.title);

  let fetchedTasks: any[] = [];
  try {
    const res = await fetch('/api/discoverTasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentNode: anchor,
        existingTitles
      })
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

  for (let i = 0; i < Math.min(maxNew, fetchedTasks.length); i++) {
    const task = fetchedTasks[i];
    const id = \`agent-\${anchorNodeId}-\${stamp}-\${i}\`;
    const node: ProblemNode = {
      id,
      title: task.title || \`\${anchor.title}: Обобщение\`,
      description: task.description || \`Задача логически следует из «\${anchor.title}».\`,
      state: 'unresolved',
      type: task.type || 'scientific_task',
      targetFunction: task.targetFunction || \`f(\${anchor.targetFunction})\`,
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
      prizeNote: 'Открытие агента карты',
      singularityHint: task.singularityHint || 'скрытая сингулярность',
    };
    nodes.push(node);
    edges.push({
      id: \`edge-\${anchorNodeId}-\${id}\`,
      fromId: anchorNodeId,
      toId: id,
      strength: 0.65,
      stateColor: 'red',
      economicInfluence: 0.4,
    });
  }

  return { nodes, edges };
}

export async function applyAgentDiscoveries(map: MapState, anchorNodeId: string, maxNew = 2): Promise<MapState> {
  const { nodes, edges } = await discoverNewProblems(map, anchorNodeId, maxNew);
  if (nodes.length === 0) return map;

  const childIds = nodes.map(n => n.id);
  const updatedNodes = map.nodes.map(n =>
    n.id === anchorNodeId
      ? { ...n, dependentIds: [...n.dependentIds, ...childIds] }
      : n
  );

  return {
    ...map,
    nodes: [...updatedNodes, ...nodes],
    edges: [...map.edges, ...edges],
  };
}
`;

fs.writeFileSync('src/model/agent.ts', code);
console.log('PATCHED agent.ts');
