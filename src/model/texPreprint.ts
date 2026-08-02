import { MapState, ProblemNode, Proof, Axiom } from './types';
import { isRicisCore } from './access';
import { APP_VERSION, APP_BUILD_LABEL } from '../version';

/** Preprint bridge mode. */
export type TexBridgeMode =
  /** RICIS only: SP2/SP3/SP4/A1-A6, no classical lim / L'Hopital. */
  | 'ricis_pure'
  /** RICIS + classical bridges: classical intermediate with re-index provenance. */
  | 'classical_bridges';

export type TexPreprintOptions = {
  mode: TexBridgeMode;
  rootId?: string;
};

function escLatex(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}$&#_^%~])/g, '\\$1')
    .replace(/\n/g, ' ');
}

function parentsOf(node: ProblemNode, map: MapState): string[] {
  const fromDeps = node.dependencyIds || [];
  const fromEdges = map.edges.filter(e => e.toId === node.id).map(e => e.fromId);
  return Array.from(new Set([...fromDeps, ...fromEdges]));
}

/** Expand to roots: all ancestors of selectedId + self, topological order roots first. */
export function expandToRoot(map: MapState, selectedId: string): ProblemNode[] {
  const byId = new Map(map.nodes.map(n => [n.id, n]));
  if (!byId.has(selectedId)) return [];

  const needed = new Set<string>();
  const stack = [selectedId];
  while (stack.length) {
    const id = stack.pop()!;
    if (needed.has(id)) continue;
    needed.add(id);
    const n = byId.get(id);
    if (!n) continue;
    for (const p of parentsOf(n, map)) stack.push(p);
  }

  const indeg = new Map<string, number>();
  for (const id of needed) indeg.set(id, 0);
  for (const id of needed) {
    const n = byId.get(id)!;
    for (const p of parentsOf(n, map)) {
      if (needed.has(p)) indeg.set(id, (indeg.get(id) || 0) + 1);
    }
  }
  const queue = [...needed].filter(id => (indeg.get(id) || 0) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const n of map.nodes) {
      if (!needed.has(n.id)) continue;
      if (parentsOf(n, map).includes(id)) {
        const d = (indeg.get(n.id) || 1) - 1;
        indeg.set(n.id, d);
        if (d === 0) queue.push(n.id);
      }
    }
  }
  for (const id of needed) {
    if (!order.includes(id)) order.push(id);
  }
  return order.map(id => byId.get(id)!).filter(Boolean);
}

function modeTitle(mode: TexBridgeMode): string {
  return mode === 'ricis_pure'
    ? 'RICIS-pure (no classical limits)'
    : 'RICIS + classical bridges (lim / intermediate classical layer with provenance)';
}

function modeAbstract(mode: TexBridgeMode): string {
  if (mode === 'ricis_pure') {
    return (
      'This preprint expands the selected singularity node to the graph roots along dependency edges. ' +
      'All reductions follow RICIS-III only: L0/L1, SP2 (algebra before axioms), SP3 (indexed zeros), SP4 (semantic indexing), A1--A6. ' +
      'Classical limit processes and L\'Hopital-type bridges are excluded.'
    );
  }
  return (
    'This preprint expands the selected singularity node to the graph roots. ' +
    'Primary reductions follow RICIS-III (L0/L1, SP2--SP4, A1--A6). ' +
    'Where a classical intermediate step is used as a bridge (e.g. lim, series), it is marked explicitly as a classical bridge and must preserve provenance back to indexed zeros $0_F$ / infinities $\\infty_F$.'
  );
}

function sectionForNode(
  node: ProblemNode,
  map: MapState,
  mode: TexBridgeMode,
  index: number
): string {
  const proof: Proof | undefined = map.proofs[node.id];
  const axioms: Axiom[] = map.axioms.filter(a => a.sourceNodeId === node.id);
  const parentTitles = parentsOf(node, map)
    .map(id => map.nodes.find(n => n.id === id)?.title || id)
    .map(escLatex);

  const lines: string[] = [];
  lines.push(`\\subsection{N${index}: ${escLatex(node.title)}}`);
  lines.push(`\\label{sec:${node.id}}`);
  lines.push(`\\textbf{ID:} \\texttt{${escLatex(node.id)}} \\quad`);
  lines.push(`\\textbf{State:} ${escLatex(node.state)} \\quad`);
  lines.push(`\\textbf{Depth:} ${node.fractalDepth}`);
  if (isRicisCore(node)) lines.push(`\\quad \\textbf{RICIS core}`);
  lines.push('');
  lines.push(`\\paragraph{Target function.}`);
  lines.push(`\\begin{quote}\\small\\texttt{${escLatex(node.targetFunction)}}\\end{quote}`);
  lines.push('');
  lines.push(`\\paragraph{Description.}`);
  lines.push(escLatex(node.description || '---'));
  if (node.singularityHint) {
    lines.push('');
    lines.push(`\\paragraph{Singularity hint.}`);
    lines.push(escLatex(node.singularityHint));
  }
  if (parentTitles.length) {
    lines.push('');
    lines.push(`\\paragraph{Dependencies (toward root).}`);
    lines.push('\\begin{itemize}');
    for (const t of parentTitles) lines.push(`  \\item ${t}`);
    lines.push('\\end{itemize}');
  }

  lines.push('');
  if (mode === 'ricis_pure') {
    lines.push('\\paragraph{Reduction mode: RICIS-pure.}');
    lines.push(
      'Apply SP2 algebraic cancellation first; then SP3 $0_F/0_G = F/G$; never replace with classical $\\lim$ without indexing.'
    );
  } else {
    lines.push('\\paragraph{Reduction mode: classical bridges allowed.}');
    lines.push(
      'If a classical intermediate (e.g. $\\lim_{x\\to a}$, L\'Hopital) is used, record it as a \\emph{bridge} and re-index the result under RICIS ($0_F$, $\\infty_F$) so provenance is not lost.'
    );
    lines.push('\\begin{align*}');
    lines.push(
      `  &\\text{Classical bridge candidate:} \\quad ${escLatex(node.targetFunction)} \\\\[0.3em]`
    );
    lines.push(
      '  &\\xrightarrow{\\text{bridge}} \\text{numerical/classical value} \\xrightarrow{\\text{re-index}} 0_F,\\ \\infty_F \\text{ under L1.}'
    );
    lines.push('\\end{align*}');
  }

  if (proof?.latex) {
    lines.push('');
    lines.push('\\paragraph{Stored formal proof (from map).}');
    lines.push('\\begin{verbatim}');
    const body = proof.latex.slice(0, 4000).replace(/\\end\\{verbatim\\}/gi, '\\end{verb atim}');
    lines.push(body);
    lines.push('\\end{verbatim}');
  } else if (proof?.steps?.length) {
    lines.push('');
    lines.push('\\paragraph{Proof steps.}');
    lines.push('\\begin{enumerate}');
    for (const st of proof.steps) {
      lines.push(
        `  \\item \\textbf{${escLatex(String(st.phase))} ${escLatex(st.name)}.} ${escLatex(st.action)}\\\\ \\texttt{${escLatex(st.expression)}}`
      );
    }
    lines.push('\\end{enumerate}');
    if (proof.finalResult) {
      lines.push(`\\textbf{Result:} \\texttt{${escLatex(proof.finalResult)}}`);
    }
  } else {
    lines.push('');
    lines.push('\\paragraph{Proof status.}');
    lines.push(
      node.state === 'resolved'
        ? 'Resolved on the map; detailed LaTeX proof not stored --- expand via RICIS pipeline offline.'
        : 'Unresolved --- section is a dependency skeleton for the preprint expansion to the root.'
    );
  }

  if (axioms.length) {
    lines.push('');
    lines.push('\\paragraph{Extracted axioms.}');
    lines.push('\\begin{itemize}');
    for (const a of axioms) {
      lines.push(`  \\item \\texttt{${escLatex(a.id)}}: ${escLatex(a.formalStatement)}`);
    }
    lines.push('\\end{itemize}');
  }

  return lines.join('\n');
}

/** Full preprint: selected -> expand to roots, 2 bridge modes. */
export function buildTexPreprint(
  map: MapState,
  selectedId: string,
  options: TexPreprintOptions
): string {
  const mode = options.mode;
  const chain = expandToRoot(map, selectedId);
  const selected = map.nodes.find(n => n.id === selectedId);
  const title = selected?.title || selectedId;
  const date = new Date().toISOString().slice(0, 10);

  const roots = chain.filter(n => parentsOf(n, map).length === 0);
  const rootNote =
    roots.length > 0
      ? roots.map(r => r.title).join('; ')
      : 'graph roots (no dependencyIds)';

  const header = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=2.2cm]{geometry}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{lmodern}

\\title{RICIS-III Preprint Expansion\\\\
\\large ${escLatex(title)}}
\\author{Generated by RICIS3-Expansion ${escLatex(APP_BUILD_LABEL)}}
\\date{${date}}

\\begin{document}
\\maketitle

\\begin{abstract}
${modeAbstract(mode)}
Selected node: \\textbf{${escLatex(title)}} (\\texttt{${escLatex(selectedId)}}).
Chain length: ${chain.length} nodes to root(s): ${escLatex(rootNote)}.
Mode: \\emph{${escLatex(modeTitle(mode))}}.
\\end{abstract}

\\tableofcontents
\\newpage

\\section{Meta}
\\begin{itemize}
  \\item Application: RICIS-III Singularity Map
  \\item Version: ${escLatex(APP_VERSION)}
  \\item Bridge mode: ${escLatex(mode)}
  \\item Expansion: dependency closure to graph roots (edges + dependencyIds)
\\end{itemize}

\\section{Bridge policy}
`;

  const policy =
    mode === 'ricis_pure'
      ? `In \\textbf{ricis\\_pure} mode every singularity is handled by indexed zeros and infinities.
Classical $\\lim$ is not a proof step. Identity L1 and continuity L0 are laws, not numerical checks.
`
      : `In \\textbf{classical\\_bridges} mode a classical intermediate may appear only as an explicit bridge:
\\begin{enumerate}
  \\item State the classical step (limit, series, L'Hopital, blow-up).
  \\item Re-index the outcome under RICIS ($0_F$, $\\infty_F$) with provenance string.
  \\item Continue with SP2--SP4 so the bridge cannot erase identity.
\\end{enumerate}
`;

  const sections = chain
    .map((n, i) => sectionForNode(n, map, mode, i + 1))
    .join('\n\n');

  const closing = `
\\section{Closure}
The expansion above lists every ancestor of the selected node up to the graph root(s).
Downstream dependents are omitted; regenerate from a child node to include a longer branch.

\\noindent\\footnotesize
Generated automatically. DOI seed: 10.5281/zenodo.18116204 (RICIS formal core).
\\end{document}
`;

  return (
    header +
    policy +
    '\n\\section{Expanded dependency chain (root $\\rightarrow$ selected)}\n\n' +
    sections +
    closing
  );
}

/** Download .tex in the browser. */
export function downloadTexPreprint(
  map: MapState,
  selectedId: string,
  options: TexPreprintOptions
): { filename: string; nodeCount: number } {
  const tex = buildTexPreprint(map, selectedId, options);
  const chain = expandToRoot(map, selectedId);
  const modeTag = options.mode === 'ricis_pure' ? 'ricis' : 'classical';
  const filename = `ricis3-preprint-${selectedId.slice(0, 24)}-${modeTag}-${new Date()
    .toISOString()
    .slice(0, 10)}.tex`;
  const blob = new Blob([tex], { type: 'application/x-tex;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { filename, nodeCount: chain.length };
}
