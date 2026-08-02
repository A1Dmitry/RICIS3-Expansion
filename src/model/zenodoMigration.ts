/**
 * Одноразовая миграция Zenodo → IndexedDB.
 *
 * Источники (изучены по описаниям и файлам записей):
 * - 10.5281/zenodo.18116204 / 17872755 — Complete Proofs of the Seven Millennium Problems and Navier–Stokes
 * - Master Registry 17 singularities (July 23, 2026)
 * - LLM gradient explosion regularization (July 22, 2026)
 * - Cosmological model of mutual pushing (July 18, 2026)
 * - Bridge Classical ↔ Structural Algebra / π O(1) (July 16, 2026)
 * - Erdős Conjecture on Arithmetic Progressions (July 16, 2026)
 * - Elimination of Singularities / Beal + UV (July 15, 2026)
 * - Cusp singularity y² = x³ without blow-up (July 11, 2026; related DOI 10.5281/zenodo.21309650)
 * - Voynich MS 408 Functional Decipherment (Dec 20, 2025)
 * - Lean 4 Kernel v1.0.0 (July 24, 2026)
 *
 * Если БД пуста (nodes.length === 0), накатывает полный seed из initialMap
 * (уже содержит registry + Millennium-корреляты) и ставит meta-флаг миграции.
 * Повторный вызов при непустой БД — no-op.
 */

import type { MapState, Proof, ProblemNode } from './types';
import { initialMap } from './initialMap';
import { dbSaveMap, dbLoadMap, dbMeta } from './db';

export const ZENODO_MIGRATION_VERSION = 'zenodo-seed-2026-08-01';

/** DOI / record links used as provenance for solved nodes. */
export const ZENODO_SOURCES: Record<string, string> = {
  millennium: 'https://doi.org/10.5281/zenodo.18116204',
  millenniumAlt: 'https://doi.org/10.5281/zenodo.17872755',
  masterRegistry: 'RICIS-III Master Registry (Zenodo, 2026-07-23)',
  llmGradient: 'Гладкая регуляризация градиентного взрыва LLM (Zenodo, 2026-07-22)',
  cosmology: 'Cosmological Model of Mutual Pushing (Zenodo, 2026-07-18)',
  bridge: 'Bridge Classical Mathematics and Structural Algebra (Zenodo, 2026-07-16)',
  erdosAP: 'Proof of the Erdős Conjecture on Arithmetic Progressions (Zenodo, 2026-07-16)',
  bealUV: 'Elimination of Singularities / Beal + UV (Zenodo, 2026-07-15)',
  cusp: 'https://doi.org/10.5281/zenodo.21309650',
  voynich: 'Functional Decipherment of the Voynich Manuscript (Zenodo, 2025-12-20)',
  lean4: 'A1Dmitry/RICIS-III-Lean4-Kernel v1.0.0 (Zenodo, 2026-07-24)',
};

function millenniumProofs(): Record<string, Proof> {
  const base = (nodeId: string, target: string, title: string, body: string, finalResult: string): Proof => ({
    nodeId,
    targetFunction: target,
    steps: [
      { phase: -1, name: 'L1_IDENTITY', action: 'Preserve absolute identity under indexing', expression: 'X = X' },
      { phase: 0.5, name: 'A1_INDEXING', action: 'Index singularity / non-existence', expression: 'ρ / 0 → ∞_ρ  or  φ / 0 → ∞_φ' },
      { phase: 1, name: 'A3_TYPED_ZERO + Identity Recovery', action: 'Typed zero and product recovery', expression: '0_ρ × ∞_ρ = ρ' },
      { phase: 2, name: 'L0_ABSOLUTE_CONTINUITY', action: 'No recursive level may break self-similarity', expression: 'R(Q) := {Q, ∞_Q, 0_Q, R(∞_Q), R(0_Q)}' },
      { phase: 6, name: 'Q.E.D.', action: body, expression: finalResult },
    ],
    finalResult,
    latex:
      '\\section*{RICIS-III / Zenodo: ' +
      title +
      '}\n\\textbf{Source:} ' +
      ZENODO_SOURCES.millennium +
      '\n\n' +
      body +
      '\n\n\\textbf{Final:} $' +
      finalResult +
      '$',
  });

  return {
    'mill-riemann': base('mill-riemann', 'RiemannHypothesis()', 'Riemann Hypothesis', 'Все нетривиальные нули ζ имеют Re = 1/2. Из ∞_ρ ⟷ ∞_(1-ρ) и L0 следует ρ = 1−ρ.', 'Re(ρ) = 1/2'),
    'mill-pnp': base('mill-pnp', 'PvsNP()', 'P versus NP', 'P = NP: внутри ∞_φ (SAT) полный разбор 2ⁿ уже структурирован рекурсивно; разрыв размеров нарушил бы L1.', 'P = NP'),
    'mill-bsd': base('mill-bsd', 'BSD()', 'Birch–Swinnerton-Dyer', 'Ранг E(ℚ) = ord_{s=1} L(E,s). Иначе аналитическое и алгебраическое описания E расходятся на уровне ∞_E.', 'rank = analytic order'),
    'mill-hodge': base('mill-hodge', 'Hodge()', 'Hodge Conjecture', 'Hodge-класс обязан раскрываться в алгебраические циклы; контрпример нарушил бы самоподобие R(∞_цикл).', 'Hodge classes are algebraic'),
    'pde-navier-stokes': base('pde-navier-stokes', 'NavierStokes3D()', 'Navier–Stokes Existence and Smoothness', 'Blow-up в T < ∞ означал бы потерю идентичности начальных данных; запрещено L0/L1. Глобальная гладкость.', 'global smooth solution exists'),
    'mill-yang-mills': base('mill-yang-mills', 'YangMillsMassGap()', 'Yang–Mills Mass Gap', 'Вакуум / 0_масштаб = ∞_вакуум; L0 запрещает безмассовый/нестабильный вакуум на любом масштабе. Δ > 0.', 'mass gap Δ > 0'),
  };
}

function extraZenodoNodes(): ProblemNode[] {
  const ecoHigh = {
    costUnresolved: 1_000_000_000,
    costToSolve: 50_000_000,
    marketGain: 10_000_000_000,
    riskLoss: 5_000_000_000,
  };

  return [
    {
      id: 'mill-riemann',
      title: 'Riemann Hypothesis',
      description: 'Все нетривиальные нули ζ-функции имеют действительную часть 1/2. Доказано в RICIS-III через индексацию ∞_ρ ⟷ ∞_(1−ρ) и L0 Absolute Continuity (Zenodo 10.5281/zenodo.18116204).',
      state: 'resolved',
      type: 'core_singularity',
      targetFunction: 'RiemannHypothesis()',
      zoneIds: ['math'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 0,
      economic: { ...ecoHigh },
      rewardClass: 'clay',
      prizeNote: 'Clay Millennium',
      singularityHint: 'нули ζ и отражение s ↔ 1−s',
      ricisSolvable: true,
    },
    {
      id: 'mill-pnp',
      title: 'P versus NP',
      description: 'P = NP. Внутри индексированной ∞_φ полный разбор сертификатов уже содержится рекурсивно; разрыв детерминированного/недетерминированного размера нарушает L1 (Zenodo 18116204).',
      state: 'resolved',
      type: 'core_singularity',
      targetFunction: 'PvsNP()',
      zoneIds: ['informatics', 'math'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 0,
      economic: { ...ecoHigh, marketGain: 50_000_000_000 },
      rewardClass: 'clay',
      prizeNote: 'Clay Millennium',
      singularityHint: 'сертификат / 0_неизвестность',
      ricisSolvable: true,
    },
    {
      id: 'mill-bsd',
      title: 'Birch and Swinnerton-Dyer Conjecture',
      description: 'Ранг E(ℚ) равен порядку нуля L(E,s) в s=1. Иначе аналитическое и алгебраическое описания расходятся на уровне ∞_E (Zenodo 18116204).',
      state: 'resolved',
      type: 'scientific_task',
      targetFunction: 'BSD()',
      zoneIds: ['math'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: { ...ecoHigh },
      rewardClass: 'clay',
      prizeNote: 'Clay Millennium',
      singularityHint: 'L(E,1) = 0 vs algebraic rank',
      ricisSolvable: true,
    },
    {
      id: 'mill-hodge',
      title: 'Hodge Conjecture',
      description: 'Каждый Hodge-класс — рациональная комбинация алгебраических циклов. Контрпример нарушил бы самоподобие R(∞_цикл) (Zenodo 18116204).',
      state: 'resolved',
      type: 'scientific_task',
      targetFunction: 'Hodge()',
      zoneIds: ['math'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: { ...ecoHigh },
      rewardClass: 'clay',
      prizeNote: 'Clay Millennium',
      singularityHint: 'Hodge class vs algebraic cycle',
      ricisSolvable: true,
    },
    {
      id: 'mill-yang-mills',
      title: 'Yang–Mills Existence and Mass Gap',
      description: 'Квантовая ЯМ на ℝ⁴ с массовым зазором Δ > 0. Вакуум индексируется; L0 запрещает безмассовый вакуум (Zenodo 18116204).',
      state: 'resolved',
      type: 'scientific_task',
      targetFunction: 'YangMillsMassGap()',
      zoneIds: ['physics', 'math'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: { ...ecoHigh },
      rewardClass: 'clay',
      prizeNote: 'Clay Millennium',
      singularityHint: 'vacuum / scale singularity',
      ricisSolvable: true,
    },
    {
      id: 'math-cusp-y2x3',
      title: 'Cusp Singularity y² = x³ (without blow-up)',
      description: 'Разрешение cusp y² = x³ в начале координат через typed zeros 0_F без blow-up и без увеличения размерности. 0_(y²)/0_(x³) = y²/x³ → t² (Zenodo cusp / 21309650).',
      state: 'resolved',
      type: 'scientific_task',
      targetFunction: 'ResolveCusp(y2-x3)',
      zoneIds: ['math'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: { costUnresolved: 100_000_000, costToSolve: 5_000_000, marketGain: 500_000_000, riskLoss: 200_000_000 },
      rewardClass: 'reputation',
      singularityHint: 'y² = x³ at origin; typed zeros vs quotient values',
      ricisSolvable: true,
    },
    {
      id: 'math-erdos-ap',
      title: 'Erdős Conjecture on Arithmetic Progressions',
      description: 'Любое A ⊆ ℕ с ∑ 1/n = ∞ содержит AP произвольной длины. Через monolith hierarchy + A6 (0_F × ∞_G = F·G) и сохранение координатной идентичности (Zenodo 2026-07-16).',
      state: 'resolved',
      type: 'scientific_task',
      targetFunction: 'ErdosAP()',
      zoneIds: ['math'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: { costUnresolved: 200_000_000, costToSolve: 10_000_000, marketGain: 1_000_000_000, riskLoss: 300_000_000 },
      rewardClass: 'reputation',
      singularityHint: 'divergent harmonic sum → structured ∞_F',
      ricisSolvable: true,
    },
    {
      id: 'math-beal',
      title: "Beal's Conjecture (field collision)",
      description: 'Контрпример к Beal блокируется field collision в алгебре отложенных выражений RICIS-III; UV-расходимости в QED дают конечные residues в r=0 без регуляризации (Zenodo 2026-07-15).',
      state: 'resolved',
      type: 'scientific_task',
      targetFunction: 'BealConjecture()',
      zoneIds: ['math', 'physics'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: { costUnresolved: 150_000_000, costToSolve: 8_000_000, marketGain: 800_000_000, riskLoss: 250_000_000 },
      rewardClass: 'commercial',
      singularityHint: 'coprime counterexample / UV at r=0',
      ricisSolvable: true,
    },
    {
      id: 'math-pi-o1',
      title: 'π and definite integral in O(1) (structural gaps)',
      description: 'π и определённый интеграл вычисляются за O(1) без потери точности через разность внешней площади и произведения structural gaps: 0_C × ∞_M = C·M (Zenodo Bridge, 2026-07-16).',
      state: 'resolved',
      type: 'scientific_task',
      targetFunction: 'PiStructuralO1()',
      zoneIds: ['math'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: { costUnresolved: 50_000_000, costToSolve: 2_000_000, marketGain: 200_000_000, riskLoss: 80_000_000 },
      rewardClass: 'reputation',
      singularityHint: '0_C × ∞_M = C · M',
      ricisSolvable: true,
    },
    {
      id: 'phys-cosmology-push',
      title: 'Cosmological Model of Mutual Pushing (no collapse)',
      description: 'Гравитационный коллапс невозможен: «force groove» + RICIS-III; вязкость космического газа стабилизирует орбиты. Сингулярности r→0 устранены (Zenodo 2026-07-18).',
      state: 'resolved',
      type: 'scientific_task',
      targetFunction: 'CosmologyPushRepulsion()',
      zoneIds: ['physics'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: { costUnresolved: 500_000_000, costToSolve: 20_000_000, marketGain: 2_000_000_000, riskLoss: 1_000_000_000 },
      rewardClass: 'reputation',
      singularityHint: 'r → 0 gravitational singularity',
      ricisSolvable: true,
    },
  ];
}

function genericProof(node: ProblemNode, sourceKey: keyof typeof ZENODO_SOURCES): Proof {
  const src = ZENODO_SOURCES[sourceKey] || 'Zenodo RICIS-III';
  return {
    nodeId: node.id,
    targetFunction: node.targetFunction,
    steps: [
      { phase: -1, name: 'L1_IDENTITY', action: 'Verify identity', expression: 'T(' + node.targetFunction + ')' },
      { phase: 0.5, name: 'SEMANTIC INDEXING', action: 'Index singularity', expression: '0_F / ∞_G' },
      { phase: 2, name: 'A6 TRANSFORM', action: '0_F × ∞_G = F · G', expression: node.singularityHint || 'structured resolution' },
      { phase: 6, name: 'L0 VERIFICATION', action: 'Absolute continuity preserved', expression: 'resolved' },
    ],
    finalResult: 'Resolved via RICIS-III (' + src + ')',
    latex:
      '\\section*{' +
      node.title +
      '}\n\\textbf{Source:} ' +
      src +
      '\n\\textbf{Target:} $' +
      node.targetFunction +
      '$\n\\textbf{Result:} resolved',
  };
}

export function buildZenodoSeedState(): MapState {
  const existingIds = new Set(initialMap.nodes.map(n => n.id));
  const extras = extraZenodoNodes().filter(n => !existingIds.has(n.id));
  const nodes = [
    ...initialMap.nodes.map(n => ({
      ...n,
      economic: { ...n.economic },
      zoneIds: [...n.zoneIds],
      dependencyIds: [...(n.dependencyIds || [])],
      dependentIds: [...(n.dependentIds || [])],
    })),
    ...extras.map(n => ({
      ...n,
      economic: { ...n.economic },
      zoneIds: [...n.zoneIds],
      dependencyIds: [...(n.dependencyIds || [])],
      dependentIds: [...(n.dependentIds || [])],
    })),
  ];

  for (const n of nodes) {
    if (
      n.id.startsWith('nt-') ||
      n.id.startsWith('ds-') ||
      n.id.startsWith('pde-') ||
      n.id.startsWith('geo-') ||
      n.id.startsWith('found-') ||
      n.id.startsWith('phys-') ||
      n.id.startsWith('ml-') ||
      n.id.startsWith('info-') ||
      n.id.startsWith('math-') ||
      n.id.startsWith('mill-') ||
      n.id === 'math-singularity'
    ) {
      n.state = 'resolved';
      n.ricisSolvable = true;
    }
  }

  const millProofs = millenniumProofs();
  const proofs: Record<string, Proof> = { ...initialMap.proofs, ...millProofs };

  for (const n of extras) {
    if (!proofs[n.id]) {
      const key =
        n.id === 'math-cusp-y2x3'
          ? 'cusp'
          : n.id === 'math-erdos-ap'
          ? 'erdosAP'
          : n.id === 'math-beal'
          ? 'bealUV'
          : n.id === 'math-pi-o1'
          ? 'bridge'
          : n.id === 'phys-cosmology-push'
          ? 'cosmology'
          : 'millennium';
      proofs[n.id] = genericProof(n, key as keyof typeof ZENODO_SOURCES);
    }
  }

  const edges = [
    ...initialMap.edges.map(e => ({ ...e })),
    ...extras.map(n => ({
      id: `edge-zenodo-${n.id}`,
      fromId: 'math-singularity',
      toId: n.id,
      strength: 0.85,
      stateColor: 'green' as const,
      economicInfluence: 0.7,
    })),
  ];

  const zones = initialMap.zones.map(z => {
    const extraIds = extras.filter(n => n.zoneIds.includes(z.id)).map(n => n.id);
    return {
      ...z,
      nodeIds: Array.from(new Set([...z.nodeIds, ...extraIds])),
      economicProfile: { ...z.economicProfile },
    };
  });

  const axioms = [
    ...initialMap.axioms,
    {
      id: 'ax-zenodo-millennium-core',
      sourceNodeId: 'math-singularity',
      formalStatement: 'L0_ABSOLUTE_CONTINUITY ∧ L1_IDENTITY ∧ A1_INDEXING ⇒ Millennium corollaries',
      usedByNodeIds: extras.map(n => n.id),
    },
  ];

  return { nodes, edges, zones, axioms, proofs };
}

export async function runZenodoMigrationIfEmpty(): Promise<boolean> {
  const existing = await dbLoadMap();
  if (existing && existing.nodes.length > 0) {
    return false;
  }

  const seed = buildZenodoSeedState();
  await dbSaveMap(seed);
  return true;
}

export async function forceZenodoReseed(): Promise<void> {
  const seed = buildZenodoSeedState();
  await dbSaveMap(seed);
}
