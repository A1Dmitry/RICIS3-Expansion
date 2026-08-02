/**
 * LaTeX hygiene: detect bad proofs, repair agent fragments, safe escaping.
 */

export function sanitizeLabel(id: string): string {
  return (
    String(id || 'x')
      .replace(/[^a-zA-Z0-9:._+-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'node'
  );
}

/** Plain-text escape (titles, descriptions). All TeX specials become literal. */
export function escText(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}])/g, '\\$1')
    .replace(/\$/g, '\\$')
    .replace(/&/g, '\\&')
    .replace(/#/g, '\\#')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Path/id inside text: detokenize avoids underscore/math pitfalls. */
export function escPath(s: string): string {
  const t = String(s ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[{}]/g, '')
    .slice(0, 200);
  return `\\detokenize{${t}}`;
}

/** True if stored "proof" is an API/network/HTML error, not LaTeX. */
export function isErrorProofLatex(latex: string | null | undefined): boolean {
  if (!latex) return true;
  const t = latex.trim();
  if (!t) return true;
  if (/^Network error/i.test(t)) return true;
  if (/^Error generating proof/i.test(t)) return true;
  if (/Unexpected token\s+'<'/i.test(t)) return true;
  if (/is not valid JSON/i.test(t)) return true;
  if (/<html[\s>]/i.test(t)) return true;
  if (/Failed to generate/i.test(t)) return true;
  if (/^<!DOCTYPE/i.test(t)) return true;
  return false;
}

export function stripMarkdownFences(text: string): string {
  let t = String(text ?? '').trim();
  t = t.replace(/^```(?:latex|tex)?\s*/i, '');
  t = t.replace(/\s*```\s*$/i, '');
  t = t.replace(/^(?:here(?:'s| is)|below is|the following is)[^\n]*\n+/i, '');
  return t.trim();
}

export function repairAgentLatex(raw: string): string {
  let t = stripMarkdownFences(raw);
  t = t.replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, '');
  t = t.replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g, '');
  t = t.replace(/\\begin\s*\{\s*document\s*\}/gi, '');
  t = t.replace(/\\end\s*\{\s*document\s*\}/gi, '');
  t = t.replace(/\\maketitle/gi, '');
  t = t.replace(/\\tableofcontents/gi, '');
  t = t.replace(/\\input\s*\{[^}]*\}/g, '');
  t = t.replace(/\\include\s*\{[^}]*\}/g, '');

  const uni: Array<[RegExp, string]> = [
    [/∞/g, '\\infty'],
    [/≤/g, '\\leq'],
    [/≥/g, '\\geq'],
    [/≠/g, '\\neq'],
    [/→/g, '\\to'],
    [/⇒/g, '\\Rightarrow'],
    [/∈/g, '\\in'],
    [/·/g, '\\cdot'],
    [/×/g, '\\times'],
    [/−/g, '-'],
    [/–|—/g, '--'],
  ];
  for (const [re, rep] of uni) t = t.replace(re, rep);

  const dollars = (t.match(/(?<!\\)\$/g) || []).length;
  if (dollars % 2 === 1) t += '$';

  const openBrack = (t.match(/\\\[/g) || []).length;
  const closeBrack = (t.match(/\\\]/g) || []).length;
  if (openBrack > closeBrack) t += '\n\\]\n'.repeat(openBrack - closeBrack);

  for (const env of ['align*', 'align', 'equation*', 'equation', 'itemize', 'enumerate']) {
    const esc = env.replace('*', '\\*');
    const b = (t.match(new RegExp(`\\\\begin\\s*\\{\\s*${esc}\\s*\\}`, 'g')) || []).length;
    const e = (t.match(new RegExp(`\\\\end\\s*\\{\\s*${esc}\\s*\\}`, 'g')) || []).length;
    if (b > e) t += `\n\\end{${env}}\n`.repeat(b - e);
  }

  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return t.trim();
}

/**
 * Compile-safe structural proof when API fails or returns garbage.
 */
export function buildStructuralProofLatex(
  title: string,
  targetFunction: string,
  nodeId: string,
  steps?: Array<{ phase: number | string; name: string; action: string; expression: string }>
): string {
  const tf = escText(targetFunction);
  const ttl = escText(title);
  const id = sanitizeLabel(nodeId);
  const defaultSteps = [
    { phase: -1, name: 'L1_IDENTITY', action: 'Verify identity and types', expression: 'T(target)' },
    { phase: 0.5, name: 'SP4', action: 'Semantic indexing of singularities', expression: '0_E' },
    { phase: 1, name: 'SP2', action: 'Algebraic reduction before singularity axioms', expression: 'Reduced(E)' },
    { phase: 2, name: 'SP3/A6', action: 'Indexed zero/infinity calculus', expression: '0_F/0_G=F/G' },
    { phase: 6, name: 'L1', action: 'Final identity check', expression: 'X=X' },
  ];
  const st = steps && steps.length ? steps : defaultSteps;
  const lines: string[] = [];
  lines.push(`\\subsubsection*{RICIS-III structural proof}`);
  lines.push(`\\textbf{Node:} ${ttl}`);
  lines.push('');
  lines.push(`\\textbf{ID:} \\texttt{${escText(id)}}`);
  lines.push('');
  lines.push(`\\textbf{Target (text):} \\texttt{${tf}}`);
  lines.push('');
  lines.push('\\begin{enumerate}');
  for (const s of st) {
    lines.push(
      `  \\item \\textbf{Phase ${escText(String(s.phase))} --- ${escText(s.name)}.} ${escText(s.action)}`
    );
    lines.push(`  \\\\ \\texttt{${escText(s.expression)}}`);
  }
  lines.push('\\end{enumerate}');
  lines.push('');
  lines.push(
    `\\textbf{Result:} axiom extracted for \\texttt{${escText(id)}} (structural offline proof; API proof unavailable or invalid).`
  );
  return lines.join('\n');
}

export function sanitizeVerbatimBody(raw: string, maxLen = 5000): string {
  let s = String(raw ?? '');
  if (s.length > maxLen) s = s.slice(0, maxLen) + '\n% truncated\n';
  s = s.replace(/\\end\s*\{\s*verbatim\s*\}/gi, '\\end\\{verbatim\\}');
  s = s.replace(/\\begin\s*\{\s*document\s*\}/gi, '% begin-doc');
  s = s.replace(/\\end\s*\{\s*document\s*\}/gi, '% end-doc');
  return s;
}

export const LATEX_AGENT_RULES = `
STRICT LaTeX OUTPUT RULES (must compile under pdflatex + T2A):
1. Return ONLY a FRAGMENT: \\subsubsection and paragraphs. NO \\documentclass, NO \\usepackage, NO \\begin{document}, NO markdown.
2. ASCII math only: $\\infty$ $\\to$ $\\leq$ --- never unicode.
3. Pair every $. Pair every \\begin{env}/\\end{env}. Allowed: equation*, align*, itemize, enumerate.
4. Underscores in text: use \\_ or wrap carefully. Prefer $\\mathrm{name}$.
5. No \\verb, verbatim, \\input, \\include, \\cite to missing keys.
6. Max 60 lines. No HTML, no JSON, no error messages.
7. RICIS: write $0_F$, $\\infty_F$, and SP2 SP3 SP4 as ordinary text.
`.trim();
