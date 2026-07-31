import { MapState, ProblemNode, DependencyEdge } from './types';
import { KNOWN_SINGULARITY_PROBLEMS } from './initialMap';

const DISCOVERY_TEMPLATES: Array<{
  titleSuffix: string;
  description: string;
  targetPrefix: string;
  singularityHint: string;
}> = [
  {
    titleSuffix: 'формализация граничных условий',
    description: 'Агент обнаружил недостающие граничные условия постановки; требуется формализация.',
    targetPrefix: 'BoundaryFormalize',
    singularityHint: 'разрыв области определения на границе',
  },
  {
    titleSuffix: 'устранение скрытой сингулярности',
    description: 'Обнаружена скрытая точка расходимости, блокирующая композицию решений.',
    targetPrefix: 'ResolveHiddenSingularity',
    singularityHint: 'скрытый 0/0 при композиции',
  },
  {
    titleSuffix: 'метрика устойчивости решения',
    description: 'Нужна метрика устойчивости, иначе решение не переносится на соседние задачи.',
    targetPrefix: 'StabilityMetric',
    singularityHint: 'неустойчивость при ε-возмущении',
  },
  {
    titleSuffix: 'сведение к RICIS-ядру',
    description: 'Агент предлагает сведение к уже решённым аксиомам ядра RICIS-III.',
    targetPrefix: 'ReduceToRicisCore',
    singularityHint: 'разрыв редукции к ядру',
  },
  {
    titleSuffix: 'экономическая валидация',
    description: 'Оценка cost/gain расходится; требуется согласованная экономическая модель.',
    targetPrefix: 'EconomicValidate',
    singularityHint: 'расхождение costUnresolved и marketGain',
  },
];

export function catalogExhausted(map: MapState): boolean {
  const onMap = new Set(map.nodes.map(n => n.id));
  return KNOWN_SINGULARITY_PROBLEMS.every(p => onMap.has(p.id));
}

export function remainingCatalogCount(map: MapState): number {
  const onMap = new Set(map.nodes.map(n => n.id));
  return KNOWN_SINGULARITY_PROBLEMS.filter(p => !onMap.has(p.id)).length;
}

export function discoverNewProblems(
  map: MapState,
  anchorNodeId: string,
  maxNew = 2
): { nodes: ProblemNode[]; edges: DependencyEdge[] } {
  const anchor = map.nodes.find(n => n.id === anchorNodeId);
  if (!anchor) return { nodes: [], edges: [] };

  const stamp = Date.now();
  const existing = new Set(map.nodes.map(n => n.id));
  const nodes: ProblemNode[] = [];
  const edges: DependencyEdge[] = [];

  for (let i = 0; i < maxNew; i++) {
    const tpl = DISCOVERY_TEMPLATES[(stamp + i) % DISCOVERY_TEMPLATES.length];
    const id = `agent-${anchorNodeId}-${stamp}-${i}`;
    if (existing.has(id)) continue;

    const node: ProblemNode = {
      id,
      title: `${anchor.title}: ${tpl.titleSuffix}`,
      description: `${tpl.description} Источник: «${anchor.title}». Сгенерировано ИИ-агентом расширения карты.`,
      state: 'unresolved',
      type: 'derived_problem',
      targetFunction: `${tpl.targetPrefix}(${anchor.targetFunction})`,
      zoneIds: [...anchor.zoneIds],
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
      singularityHint: tpl.singularityHint,
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

export function applyAgentDiscoveries(map: MapState, anchorNodeId: string, maxNew = 2): MapState {
  const { nodes, edges } = discoverNewProblems(map, anchorNodeId, maxNew);
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
