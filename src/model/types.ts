export type NodeState = 'unresolved' | 'partial' | 'resolved';

export interface EconomicInfo {
  costUnresolved: number;
  costToSolve: number;
  marketGain: number;
  riskLoss: number;
}

/** Класс награды / мотивации за решение. */
export type RewardClass = 'clay' | 'nobel' | 'commercial' | 'reputation';

export interface ProblemNode {
  id: string;
  title: string;
  description: string;
  state: NodeState;
  type: 'core_singularity' | 'derived_problem' | 'scientific_task';
  targetFunction: string;
  zoneIds: string[];
  dependencyIds: string[];
  dependentIds: string[];
  fractalDepth: number;
  economic: EconomicInfo;
  /** clay / nobel — высший приз; commercial — рынок; reputation — известность. */
  rewardClass?: RewardClass;
  /** Клей, Нобель, премия и т.п. */
  prizeNote?: string;
  /** Суть сингулярности в постановке задачи. */
  singularityHint?: string;
  /** Внешний источник / Wiki / DOI (кликабельная ссылка в карточке). */
  sourceUrl?: string;
  /** Уже решаема протоколом RICIS-III (ядро / готовые ветки). */
  ricisSolvable?: boolean;
}

export type EdgeColor = 'red' | 'yellow' | 'green';

export interface DependencyEdge {
  id: string;
  fromId: string;
  toId: string;
  strength: number;
  stateColor: EdgeColor;
  economicInfluence: number;
}

export interface ScienceZone {
  id: string;
  name: string;
  description: string;
  nodeIds: string[];
  economicProfile: EconomicInfo;
}

export interface Axiom {
  id: string;
  sourceNodeId: string;
  formalStatement: string;
  usedByNodeIds: string[];
}

export interface ProofStep {
  phase: number | string;
  name: string;
  action: string;
  expression: string;
}

export interface Proof {
  nodeId: string;
  targetFunction: string;
  steps: ProofStep[];
  finalResult: string;
  latex: string;
}

export interface MapState {
  nodes: ProblemNode[];
  edges: DependencyEdge[];
  zones: ScienceZone[];
  axioms: Axiom[];
  proofs: Record<string, Proof>;
}
