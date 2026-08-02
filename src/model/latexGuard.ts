/**
 * LaTeX hygiene for RICIS3 proofs and preprints (pdflatex + T2A + babel).
 */

export function sanitizeLabel(id: string): string {
  return (
    String(id || 'x')
      .replace(/[^a-zA-Z0-9:._+-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'node'
  );
}

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

export function escPath(s: string): string {
  const t = String(s ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[{}]/g, '')
    .slice(0, 200);
  return `\\detokenize{${t}}`;
}

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

/** Proofs unsafe under \\subsection: \\section, $$, document wrappers. */
export function isUnsafeProofLatex(latex: string | null | undefined): boolean {
  if (isErrorProofLatex(latex)) return true;
  const t = String(latex);
  if (/\\documentclass/.test(t)) return true;
  if (/\\begin\s*\{\s*document\s*\}/i.test(t)) return true;
  if (/\\section\*?/.test(t)) return true;
  if (/\\subsection\*?/.test(t)) return true;
  if (/\\chapter\*?/.test(t)) return true;
  if (/\$\$/.test(t)) return true;
  return false;
}

export function stripMarkdownFences(text: string): string {
  let t = String(text ?? '').trim();
  t = t.replace(/^```(?:latex|tex)?\s*/i, '');
  t = t.replace(/\s*```\s*$/i, '');
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
  t = t.replace(/\\section\*?\{[^}]*\}/g, '');
  t = t.replace(/\\subsection\*?\{[^}]*\}/g, '');

  let out = '';
  let inDisplay = false;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '$' && t[i + 1] === '$') {
      out += inDisplay ? '\\]' : '\\[';
      inDisplay = !inDisplay;
      i++;
      continue;
    }
    out += t[i];
  }
  t = out;
  if (inDisplay) t += '\\]';

  t = t.replace(/\binfinity\b/gi, '\\infty');
  t = t.replace(/\bequiv\b/g, '\\equiv');

  const dollars = (t.match(/(?<!\\)\$/g) || []).length;
  if (dollars % 2 === 1) t += '$';

  return t.trim();
}

/**
 * Compile-safe structural proof.
 * Single \\item lines only — never \\\\ after \\item (no line here to end).
 */
export function buildStructuralProofLatex(
  title: string,
  targetFunction: string,
  nodeId: string,
  steps?: Array<{ phase: number | string; name: string; action: string; expression: string }>
): string {
  const ttl = escText(title);
  const id = sanitizeLabel(nodeId);

  const defaultSteps = [
    { phase: '-1', name: 'L1 IDENTITY', action: 'Verify identity and types', expression: 'T(target)' },
    { phase: '0.5', name: 'SP4', action: 'Semantic indexing of singularities', expression: '0_E' },
    { phase: '1', name: 'SP2', action: 'Algebraic reduction before singularity axioms', expression: 'Reduced(E)' },
    { phase: '2', name: 'SP3 A6', action: 'Indexed zero and infinity calculus', expression: '0_F / 0_G = F / G' },
    { phase: '6', name: 'L1', action: 'Final identity check', expression: 'X = X' },
  ];

  const st = (steps && steps.length ? steps : defaultSteps).map(s => ({
    phase: String(s.phase),
    name: String(s.name).replace(/_/g, ' '),
    action: String(s.action),
    expression: String(s.expression)
      .replace(/\binfinity\b/gi, 'infty')
      .replace(/\bequiv\b/g, 'equiv')
      .slice(0, 120),
  }));

  const lines: string[] = [];
  lines.push('\\begin{quote}');
  lines.push('\\textbf{RICIS-III structural proof}');
  lines.push('');
  lines.push(`\\textbf{Node:} ${ttl}`);
  lines.push('');
  lines.push(`\\textbf{ID:} ${escPath(id)}`);
  lines.push('');
  lines.push(`\\textbf{Target:} ${escPath(targetFunction)}`);
  lines.push('');
  lines.push('\\begin{enumerate}');
  for (const s of st) {
    lines.push(
      `  \\item \\textbf{Phase ${escText(s.phase)} --- ${escText(s.name)}.} ` +
        `${escText(s.action)} ` +
        `(expr: \\texttt{${escText(s.expression)}})`
    );
  }
  lines.push('\\end{enumerate}');
  lines.push('');
  lines.push(`\\textbf{Result:} axiom extracted for ${escPath(id)} (structural offline proof).`);
  lines.push('\\end{quote}');
  return lines.join('\n');
}

export const LATEX_AGENT_RULES =
  'STRICT LaTeX (pdflatex+T2A): fragment only; no documentclass; no section; no $$; pair $; ASCII math; max 40 lines; no HTML.';
