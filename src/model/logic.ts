import { MapState, Axiom, ProblemNode, DependencyEdge, Proof, ProofStep } from './types';

export function generateProof(node: ProblemNode): Proof {
  const latexSteps: string[] = [];
  latexSteps.push(`\\section*{RICIS-III Proof: ${node.title}}`);
  latexSteps.push(`\\textbf{Target Function:} $${node.targetFunction}$`);
  
  const steps: ProofStep[] = [
    { phase: -1, name: "L1_IDENTITY", action: "Verify identity and types", expression: `T(${node.targetFunction}) \\equiv \\text{Valid}` },
    { phase: 0.5, name: "SEMANTIC INDEXING (SP4)", action: "Index singularities by parent expression", expression: `0_{\\{${node.targetFunction}\\}}` },
    { phase: 1, name: "SAFETY CHECK (SP2)", action: "Algebraic reduction before singularity evaluation", expression: `\\text{Reduced}(${node.targetFunction})` },
    { phase: 2, name: "RICIS transforms", action: "Apply A6 (General) and A4", expression: `0_F \\times \\infty_G = F \\cdot G` },
    { phase: 6, name: "L1 verification", action: "Final consistency check", expression: `\\text{Result} \\equiv \\text{Result}` }
  ];

  steps.forEach(s => {
    latexSteps.push(`\\subsection*{Phase ${s.phase}: ${s.name}}`);
    latexSteps.push(`\\text{Action:} ${s.action} \\\\`);
    latexSteps.push(`$$ ${s.expression} $$`);
  });

  const finalResult = `Axiom Extracted: ${node.id}_resolved`;
  latexSteps.push(`\\textbf{Final Result:} ${finalResult}`);

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

  const newNodes: ProblemNode[] = [1, 2].map(i => ({
    id: `${solvedNodeId}-child-${i}-${Date.now()}`,
    title: `Зависимая проблема ${i}`,
    description: `Порождённая от узла ${solvedNodeId}`,
    state: 'unresolved',
    type: 'derived_problem',
    targetFunction: `DerivedTarget(${solved.targetFunction}, ${i})`,
    zoneIds: solved.zoneIds,
    dependencyIds: [solvedNodeId],
    dependentIds: [],
    fractalDepth: solved.fractalDepth + 1,
    economic: {
      costUnresolved: solved.economic.costUnresolved * 0.5,
      costToSolve: solved.economic.costToSolve * 0.3,
      marketGain: solved.economic.marketGain * 0.4,
      riskLoss: solved.economic.riskLoss * 0.5
    }
  }));

  const newEdges: DependencyEdge[] = newNodes.map(n => ({
    id: `edge-${solvedNodeId}-${n.id}`,
    fromId: solvedNodeId,
    toId: n.id,
    strength: 0.7,
    stateColor: 'red',
    economicInfluence: 0.5
  }));

  return {
    ...map,
    nodes: [...map.nodes, ...newNodes],
    edges: [...map.edges, ...newEdges]
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
    id: `ax-${node.id}-${Date.now()}`,
    sourceNodeId: node.id,
    formalStatement: `Axiom(${node.targetFunction})`,
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
