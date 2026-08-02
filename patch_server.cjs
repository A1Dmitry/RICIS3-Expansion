const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldPrompt = "Provide the output as a valid LaTeX document section. Use mathematical notation and refer to the provided axioms if applicable. Keep it concise, professional, and do not use generic AI filler. Structure it with subsections for the phases of the solution. Return ONLY the LaTeX string without markdown code blocks.";
const newPrompt = "Provide the output as a valid LaTeX document section. Use mathematical notation and refer to the provided axioms if applicable. Keep it concise, professional, and do not use generic AI filler.\\nSTRICT LaTeX OUTPUT RULES:\\n1. Return ONLY a FRAGMENT: paragraphs and math environments. NO \\\\documentclass, NO \\\\usepackage, NO \\\\begin{document}, NO markdown.\\n2. DO NOT use \\\\section, \\\\subsection, or \\\\chapter. Use \\\\textbf{...} for headings instead.\\n3. ASCII math only: $\\\\infty$ $\\\\to$ $\\\\leq$ --- never unicode.\\n4. Pair every $. Pair every \\\\begin{env}/\\\\end{env}. Allowed: equation*, align*, itemize, enumerate.\\n5. Max 60 lines. No HTML, no JSON, no error messages.";

code = code.replace(oldPrompt, newPrompt);
code = code.replace(/"gemini-3\.6-flash"/g, '"gemini-2.5-flash"');
fs.writeFileSync('server.ts', code);
console.log('Patched server.ts');
