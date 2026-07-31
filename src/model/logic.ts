import { MapState, Axiom, ProblemNode, DependencyEdge, Proof, ProofStep } from './types';
import { KNOWN_SINGULARITY_PROBLEMS } from './initialMap';
import { catalogExhausted, applyAgentDiscoveries } from './agent';

export function generateProof(node: ProblemNode): Proof {
  const latexSteps: string[] = [];
  latexSteps.push('\\section*{RICIS-III Proof: ' + node.title + '}');
  latexSteps.push('\\textbf{Target Function:} $' + node.targetFunction + '$');

  const steps: ProofStep[] = [
    { phase: -1, name: 'L1_IDENTITY', action: 'Verify identity and types', expression: 'T(' + node.targetFunction + ')' },
    { phase: 0.5, name: 'SEMANTIC INDEXING (SP4)', action: 'Index singularities by parent expression', expression: '0_{' + node.targetFunction + '}' },
    { phase: 1, name: 'SAFETY CHECK (SP2)', action: 'Algebraic reduction before singularity evaluation', expression: 'Reduced(' + node.targetFunction + ')' },
    { phase: 2, name: 'RICIS transforms', action: 'Apply A6 (General) and A4', expression: '0_F x infinity_G = F * G' },
    { phase: 6, name: 'L1 verification', action: 'Final consistency check', expression: 'Result equiv Result' }
  ];

  steps.forEach(s => {
    latexSteps.push('\\subsection*{Phase ' + s.phase + ': ' + s.name + '}');
    latexSteps.push('Action: ' + s.action);
    latexSteps.push('$$ ' + s.expression + ' $$');
  });

  const finalResult = 'Axiom Extracted: ' + node.id + '_resolved';
  latexSteps.push('\\textbf{Final Result:} ' + finalResult);

  return {
    nodeId: node.id,
    targetFunction: node.targetFunction,
    steps,
    finalResult,
    latex: latexSteps.join('\n\n')
  };
}

export function expandFractal(map: MapState, solvedNodeId: string): MapState {
  const solved = map.nodes.find(n => n.id === solvedNodeId);
  if (!solved) return map;

  const existingIds = new Set(map.nodes.map(n => n.id));
  const alreadyDependent = new Set(solved.dependentIds);

  const catalogDependents = KNOWN_SINGULARITY_PROBLEMS.filter(
    p =>
      p.dependencyIds.includes(solvedNodeId) &&
      !existingIds.has(p.id) &&
      !alreadyDependent.has(p.id)
  );

  const sameZoneCandidates = KNOWN_SINGULARITY_PROBLEMS.filter(
    p =>
      !existingIds.has(p.id) &&
      !catalogDependents.some(c => c.id === p.id) &&
      p.zoneIds.some(z => solved.zoneIds.includes(z)) &&
      p.id !== solvedNodeId
  );

  const MAX_NEW = 2;
  const pickedFromCatalog: ProblemNode[] = [];

  for (const p of catalogDependents) {
    if (pickedFromCatalog.length >= MAX_NEW) break;
    pickedFromCatalog.push(p);
  }
  for (const p of sameZoneCandidates) {
    if (pickedFromCatalog.length >= MAX_NEW) break;
    pickedFromCatalog.push(p);
  }

  const newNodes: ProblemNode[] = [];
  const stamp = Date.now();

  for (let i = 0; i < pickedFromCatalog.length; i++) {
    const src = pickedFromCatalog[i];
    newNodes.push({
      ...src,
      economic: { ...src.economic },
      zoneIds: [...src.zoneIds],
      dependencyIds: Array.from(new Set([...(src.dependencyIds || []), solvedNodeId])),
      dependentIds: [],
      fractalDepth: solved.fractalDepth + 1,
      state: 'unresolved',
      type: src.type === 'core_singularity' ? 'scientific_task' : src.type,
    });
  }

  if (newNodes.length === 0 && catalogExhausted(map)) {
    return applyAgentDiscoveries(map, solvedNodeId, MAX_NEW);
  }

  while (newNodes.length < MAX_NEW) {
    const i = newNodes.length + 1;
    const branchLabel =
      i === 1
        ? 'Уточнение: ' + solved.title
        : 'Связанная задача: ' + solved.title + ' (ветвь ' + i + ')';
    newNodes.push({
      id: solvedNodeId + '-branch-' + i + '-' + stamp,
      title: branchLabel,
      description: 'Фрактальное уточнение задачи «' + solved.title + '».',
      state: 'unresolved',
      type: 'derived_problem',
      targetFunction: 'Refine(' + solved.targetFunction + ', ' + i + ')',
      zoneIds: [...solved.zoneIds],
      dependencyIds: [solvedNodeId],
      dependentIds: [],
      fractalDepth: solved.fractalDepth + 1,
      economic: {
        costUnresolved: Math.round(solved.economic.costUnresolved * 0.5),
        costToSolve: Math.round(solved.economic.costToSolve * 0.3),
        marketGain: Math.round(solved.economic.marketGain * 0.4),
        riskLoss: Math.round(solved.economic.riskLoss * 0.5),
      },
      rewardClass: solved.rewardClass,
      singularityHint: solved.singularityHint
        ? 'Уточнение: ' + solved.singularityHint
        : undefined,
    });
  }

  const newEdges: DependencyEdge[] = newNodes.map(n => ({
    id: 'edge-' + solvedNodeId + '-' + n.id,
    fromId: solvedNodeId,
    toId: n.id,
    strength: 0.7,
    stateColor: 'red' as const,
    economicInfluence: 0.5,
  }));

  const childIds = newNodes.map(n => n.id);
  const nodesWithParent = map.nodes.map(n =>
    n.id === solvedNodeId
      ? { ...n, dependentIds: [...n.dependentIds, ...childIds] }
      : n
  );

  return {
    ...map,
    nodes: [...nodesWithParent, ...newNodes],
    edges: [...map.edges, ...newEdges],
  };
}

export function solveNodeLogic(map: MapState, nodeId: string): MapState {
  const node = map.nodes.find(n => n.id === nodeId);
  if (!node || node.state === 'resolved') return map;

  const updatedNode = { ...node, state: 'resolved' as const };

  const updatedNodes = map.nodes.map(n => {
    if (n.id === nodeId) return updatedNode;
    if (node.dependentIds.includes(n.id)) {
      return {
        ...n,
        economic: {
          ...n.economic,
          costUnresolved: n.economic.costUnresolved * 0.8,
          riskLoss: n.economic.riskLoss * 0.8,
        }
      };
    }
    return n;
  });

  const axiom: Axiom = {
    id: 'ax-' + node.id + '-' + Date.now(),
    sourceNodeId: node.id,
    formalStatement: 'Axiom(' + node.targetFunction + ')',
    usedByNodeIds: []
  };

  const updatedEdges = map.edges.map(e =>
    e.fromId === node.id ? { ...e, stateColor: 'green' as const } : e
  );

  const proof = generateProof(node);

  const newMap = {
    ...map,
    nodes: updatedNodes,
    edges: updatedEdges,
    axioms: [...map.axioms, axiom],
    proofs: { ...map.proofs, [nodeId]: proof }
  };

  return expandFractal(newMap, node.id);
}
