/**
 * RICIS-III Derivative / Plagiarism Detection Protocol
 *
 * Goal: find external works that reuse the *semantic core* of RICIS-III
 * (limit-free singularity resolution, indexed zeros/infinities, SP2/A6, …)
 * even when renamed, rebranded, or presented without attribution — especially
 * claims of solving 0/0, 0×∞, ∞/∞ *without limits*, which historically were
 * not claimed as a complete constructive algebra before RICIS.
 *
 * Nodes created by this module are type=derivative_claim (purple on the map),
 * depend on math-singularity / core RICIS nodes, and carry firstMentionDate.
 */

import { MapState, ProblemNode, DependencyEdge } from './types';
import { postJson } from './apiClient';
import { normalizeProblemKey, existingProblemKeys } from './agent';

/** Canonical RICIS signatures (search even under renamed labels). */
export const RICIS_SIGNATURES = [
  {
    id: 'SP2',
    label: 'Algebraic reduction before singularity evaluation',
    queries: [
      '"algebraic reduction before" singularity OR evaluation',
      '"pruning before singularity" OR "simplify before 0/0"',
      '"clean first" singularity algebra OR indeterminate',
    ],
  },
  {
    id: 'A6',
    label: '0_F × ∞_G = F·G (indexed product resolution)',
    queries: [
      '"0 * infinity" OR "zero times infinity" exact OR structural algebra',
      '"indexed zero" infinity product OR "typed zero" times infinity',
      '0_F infinity_G OR "contextual zero" times infinity',
    ],
  },
  {
    id: 'A4_SP3',
    label: '0_F / 0_G = F/G without limits',
    queries: [
      '"0/0" "F/G" OR "indexed zero" division without limit',
      '"typed zero" OR "contextual zero" "0/0" resolution -L\'Hopital',
      '"without limits" OR "no lim" "0/0" singularity algebra',
    ],
  },
  {
    id: 'NO_LIM',
    label: 'Exact static algebra / non-asymptotic singularity resolution',
    queries: [
      '"without limits" OR "non-asymptotic" singularity resolution mathematics',
      '"exact static algebra" OR "structure instead of limits" singularity',
      '"limit-free" OR "no lim" "division by zero" constructive algebra',
    ],
  },
  {
    id: 'L0_L1',
    label: 'Absolute continuity / absolute identity (provenance)',
    queries: [
      '"absolute identity" singularity OR "X = X" provenance zero',
      '"absolute continuity" recursion identity singularity math',
      'provenance indexed zero singularity ontology',
    ],
  },
  {
    id: 'MONOLITH',
    label: 'Monolith / fractal hierarchy of continuous structures',
    queries: [
      '"monolith algebra" singularity OR continuous hierarchy zero infinity',
      'fractal monolith order singularity 0/0',
    ],
  },
  {
    id: 'NO_BLOWUP',
    label: 'Cusp / algebraic singularity without classical blow-up',
    queries: [
      '"without blow-up" OR "without blowup" cusp singularity typed zero',
      'cusp y^2 = x^3 resolution without projective line',
    ],
  },
  {
    id: 'LLM_GRAD',
    label: 'LLM gradient singularity / activation 0/0 via indexed zeros',
    queries: [
      '"gradient explosion" activation singularity indexed OR structural zero',
      'LLM activation "0/0" OR "critical point" without clipping algebra',
    ],
  },
] as const;

/** Core map anchors: derivative claims depend on these. */
export const RICIS_CORE_ANCHORS = ['math-singularity', 'core-agi-target'] as const;

export type DerivativeHit = {
  title: string;
  description?: string;
  sourceUrl?: string;
  firstMentionDate?: string;
  zoneId?: string;
  matchedSignatures?: string[];
  score?: number;
  relevantNodeIds?: string[];
  authors?: string;
};

export type DerivativeSearchReport = {
  map: MapState;
  added: number;
  hits: number;
  error?: string;
};

/**
 * Offline heuristic hits (static host / API down): empty — we do not invent plagiarism.
 * Real search requires /api/searchDerivatives (Gemini + knowledge).
 */
export function buildDerivativeSearchPrompt(existingTitles: string[]): string {
  const sigBlock = RICIS_SIGNATURES.map(
    s => `- ${s.id}: ${s.label}\n  queries: ${s.queries.join(' | ')}`
  ).join('\n');

  return `You are a scientific priority auditor for RICIS-III (Recursive Indexed Calculus of Identity and Singularity by Dmitry Aleynikov).

TASK: Find EXTERNAL papers, preprints, patents, blogs, or codebases that reuse RICIS-III *ideas* even if renamed, rebranded, or without citing Aleynikov / RICIS.

HISTORICAL PRIORITY FACT (use when scoring):
Before RICIS, mainstream math did NOT claim a complete constructive algebra that resolves 0/0, 0×∞, ∞/∞ as *indexed structural identities without limits (lim)*. Classical tools use limits, blow-ups, regularization, or declare NaN. Any work claiming limit-free exact resolution of these forms is high-priority for audit.

SIGNATURES TO MATCH (semantic, not only exact strings):
${sigBlock}

ALREADY ON OUR MAP (do not duplicate titles):
${existingTitles.slice(0, 80).join('; ')}

OUTPUT: STRICT JSON array of 0–8 objects with keys:
- "title": string
- "description": string (why it matches RICIS semantics; note rename if any)
- "sourceUrl": string (DOI, arXiv, Zenodo, URL if known; else empty)
- "firstMentionDate": string (YYYY-MM-DD or YYYY-MM or YYYY — earliest public date you can justify)
- "zoneId": one of math|physics|informatics|medicine|pharmacology|economics|ethics
- "matchedSignatures": string[] (subset of SP2,A6,A4_SP3,NO_LIM,L0_L1,MONOLITH,NO_BLOWUP,LLM_GRAD)
- "score": number 0..1 (1 = clear semantic clone of RICIS core)
- "relevantNodeIds": string[] (prefer "math-singularity" and/or "core-agi-target")
- "authors": string

Rules:
- Prefer score >= 0.55 only.
- Do NOT list Aleynikov / RICIS-III official deposits as derivatives.
- If nothing credible, return [].
- Output ONLY valid JSON array.`;
}

function mapHitToNode(
  hit: DerivativeHit,
  stamp: number,
  index: number,
  keys: Set<string>
): ProblemNode | null {
  const title = String(hit.title || '').trim();
  if (!title) return null;
  if (keys.has(normalizeProblemKey(title, '')) || keys.has(normalizeProblemKey(title, hit.title))) {
    return null;
  }

  const score = typeof hit.score === 'number' ? hit.score : 0.6;
  if (score < 0.55) return null;

  const zoneId = hit.zoneId && ['math', 'physics', 'informatics', 'medicine', 'pharmacology', 'economics', 'ethics'].includes(hit.zoneId)
    ? hit.zoneId
    : 'math';

  const deps = (hit.relevantNodeIds && hit.relevantNodeIds.length > 0
    ? hit.relevantNodeIds
    : [...RICIS_CORE_ANCHORS]
  ).filter(Boolean);

  const id = `deriv-${stamp}-${index}`;
  const sigs = Array.isArray(hit.matchedSignatures) ? hit.matchedSignatures.map(String) : [];
  const date = String(hit.firstMentionDate || '').trim() || 'unknown';

  keys.add(normalizeProblemKey(title, ''));

  const node: ProblemNode = {
    id,
    title: `[DERIV] ${title}`,
    description:
      (hit.description || 'External work matching RICIS-III semantic signatures.') +
      (hit.authors ? `\nAuthors: ${hit.authors}` : '') +
      `\nFirst mention: ${date}` +
      (sigs.length ? `\nMatched signatures: ${sigs.join(', ')}` : '') +
      `\nSimilarity score: ${score.toFixed(2)}` +
      (hit.sourceUrl ? `\nИсточник: ${hit.sourceUrl}` : ''),
    state: 'partial',
    type: 'derivative_claim',
    targetFunction: `AuditDerivative(${sigs[0] || 'RICIS_CORE'})`,
    zoneIds: [zoneId],
    dependencyIds: deps,
    dependentIds: [],
    fractalDepth: 2,
    economic: {
      costUnresolved: 50,
      costToSolve: 20,
      marketGain: 10,
      riskLoss: 80,
    },
    rewardClass: 'reputation',
    prizeNote: 'Derivative / priority audit (purple)',
    singularityHint: 'Semantic reuse of limit-free singularity algebra',
    sourceUrl: hit.sourceUrl ? String(hit.sourceUrl).trim() : undefined,
    firstMentionDate: date,
    isDerivativeClaim: true,
    derivativeScore: score,
    matchedSignatures: sigs,
    ricisSolvable: false,
  };
  return node;
}

/**
 * Run derivative search via API and merge purple nodes into the map.
 */
export async function applyDerivativeSearch(
  map: MapState,
  options?: { maxHits?: number }
): Promise<DerivativeSearchReport> {
  const maxHits = options?.maxHits ?? 8;
  const keys = existingProblemKeys(map);
  const existingTitles = map.nodes.map(n => n.title);

  const api = await postJson<{ hits?: DerivativeHit[]; error?: string }>(
    '/api/searchDerivatives',
    {
      existingTitles,
      signatures: RICIS_SIGNATURES,
      prompt: buildDerivativeSearchPrompt(existingTitles),
    },
    { timeoutMs: 90_000 }
  );

  if (!api.ok) {
    return { map, added: 0, hits: 0, error: api.error };
  }

  const rawHits = Array.isArray(api.data.hits) ? api.data.hits : [];
  const stamp = Date.now();
  const newNodes: ProblemNode[] = [];
  const newEdges: DependencyEdge[] = [];

  for (let i = 0; i < rawHits.length && newNodes.length < maxHits; i++) {
    const node = mapHitToNode(rawHits[i], stamp, i, keys);
    if (!node) continue;
    newNodes.push(node);

    for (const depId of node.dependencyIds) {
      if (!map.nodes.some(n => n.id === depId) && !newNodes.some(n => n.id === depId)) continue;
      newEdges.push({
        id: `edge-${depId}-${node.id}`,
        fromId: depId,
        toId: node.id,
        strength: 0.5,
        stateColor: 'yellow',
        economicInfluence: 0.2,
      });
    }
  }

  if (newNodes.length === 0) {
    return { map, added: 0, hits: rawHits.length };
  }

  const updatedNodes = map.nodes.map(n => {
    const childIds = newNodes.filter(c => c.dependencyIds.includes(n.id)).map(c => c.id);
    if (childIds.length === 0) return n;
    return {
      ...n,
      dependentIds: [...new Set([...(n.dependentIds || []), ...childIds])],
    };
  });

  const zones = map.zones.map(z => {
    const addIds = newNodes.filter(nn => nn.zoneIds.includes(z.id)).map(nn => nn.id);
    if (addIds.length === 0) return z;
    return { ...z, nodeIds: [...new Set([...z.nodeIds, ...addIds])] };
  });

  const next: MapState = {
    ...map,
    nodes: [...updatedNodes, ...newNodes],
    edges: [...map.edges, ...newEdges],
    zones,
  };

  return { map: next, added: newNodes.length, hits: rawHits.length };
}

/** Purple map color for derivative claims. */
export const DERIVATIVE_NODE_COLOR = '#a855f7';
export const DERIVATIVE_EDGE_COLOR = '#c084fc';
