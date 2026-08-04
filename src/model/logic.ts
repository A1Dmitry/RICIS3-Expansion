import { MapState, Axiom, ProblemNode, DependencyEdge, Proof, ProofStep } from './types';
import {
  buildStructuralProofLatex,
  isErrorProofLatex,
  repairAgentLatex,
} from './latexGuard';

import { KNOWN_SINGULARITY_PROBLEMS } from './catalog';

export async function generateProof(node: ProblemNode, allAxioms: Axiom[]): Promise<Proof> {
  const steps: ProofStep[] = [
    { phase: -1, name: 'L1_IDENTITY', action: 'Verify identity and types', expression: 'T(' + node.targetFunction + ')' },
    { phase: 0.5, name: 'SEMANTIC INDEXING (SP4)', action: 'Index singularities by parent expression', expression: '0_{E}' },
    { phase: 1, name: 'SAFETY CHECK (SP2)', action: 'Algebraic reduction before singularity evaluation', expression: 'Reduced(E)' },
    { phase: 2, name: 'RICIS transforms', action: 'Apply A6 (General) and network axioms', expression: '0_F * infinity_G = F * G' },
    { phase: 6, name: 'L1 verification', action: 'Final consistency check', expression: 'Result = Result' },
  ];

  const fallback = buildStructuralProofLatex(
    node.title,
    node.targetFunction,
    node.id,
    steps
  );

  let latex = fallback;
  try {
    const { postJson } = await import('./apiClient');
    const api = await postJson<{ proofLatex?: string }>('/api/generateProof', {
      title: node.title,
      targetFunction: node.targetFunction,
      axioms: allAxioms,
    });
    if (api.ok) {
      const raw = typeof api.data.proofLatex === 'string' ? api.data.proofLatex : '';
      if (raw && !isErrorProofLatex(raw)) {
        const repaired = repairAgentLatex(raw);
        latex = repaired && !isErrorProofLatex(repaired) ? repaired : fallback;
      }
    }
    // On static host or API error: keep structural fallback (no HTML dump).
  } catch {
    latex = fallback;
  }

  const finalResult = 'Axiom Extracted: ' + node.id + '_resolved';
  return {
    nodeId: node.id,
    targetFunction: node.targetFunction,
    steps,
    finalResult,
    latex,
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

  if (newNodes.length === 0) {
    return map;
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

export async function solveNodeLogic(map: MapState, nodeId: string): Promise<MapState> {
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
        },
      };
    }
    return n;
  });

  const axiom: Axiom = {
    id: 'ax-' + node.id + '-' + Date.now(),
    sourceNodeId: node.id,
    formalStatement: 'Axiom(' + node.targetFunction + ')',
    usedByNodeIds: [],
  };

  const nodeState = (id: string) =>
    id === nodeId
      ? 'resolved'
      : updatedNodes.find(n => n.id === id)?.state ?? 'unresolved';
  const updatedEdges = map.edges.map(e => {
    const bothResolved =
      nodeState(e.fromId) === 'resolved' && nodeState(e.toId) === 'resolved';
    if (bothResolved) return { ...e, stateColor: 'green' as const };
    if (e.fromId === nodeId || e.toId === nodeId) {
      return { ...e, stateColor: 'yellow' as const };
    }
    return e;
  });

  const proof = await generateProof(node, map.axioms);

  const newMap = {
    ...map,
    nodes: updatedNodes,
    edges: updatedEdges,
    axioms: [...map.axioms, axiom],
    proofs: { ...map.proofs, [nodeId]: proof },
  };

  return expandFractal(newMap, node.id);
}
