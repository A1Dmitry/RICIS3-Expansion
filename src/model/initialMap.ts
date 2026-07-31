import { MapState } from './types';

export const initialMap: MapState = {
  nodes: [
    {
      id: 'core-agi-target',
      title: 'Целевая функция AGI (RICIS Core)',
      description: 'Фундаментальная нерешённая проблема формализации целевой функции сверхсложных систем (ИИ). Избежание расхождения путей с помощью протокола SP4.',
      state: 'unresolved',
      type: 'core_singularity',
      targetFunction: 'FormalizeAGITarget()',
      zoneIds: ['informatics'],
      dependencyIds: [],
      dependentIds: ['med-diagnostics', 'pharm-design', 'phys-unified', 'econ-value', 'ethic-alignment'],
      fractalDepth: 0,
      economic: {
        costUnresolved: 10_000_000_000_000,
        costToSolve: 5_000_000_000,
        marketGain: 50_000_000_000_000,
        riskLoss: 100_000_000_000_000
      }
    },
    {
      id: 'math-singularity',
      title: 'Разрешение сингулярностей (Деление на ноль)',
      description: 'Использование монолитной алгебры RICIS-III для вычисления неопределённостей 0/0 через фрактальную идентичность.',
      state: 'partial',
      type: 'core_singularity',
      targetFunction: 'ResolveSingularity(0_F/0_G)',
      zoneIds: ['math'],
      dependencyIds: [],
      dependentIds: ['phys-unified', 'informatics-complexity'],
      fractalDepth: 0,
      economic: {
        costUnresolved: 1_000_000_000,
        costToSolve: 100_000_000,
        marketGain: 10_000_000_000,
        riskLoss: 5_000_000_000
      }
    },
    {
      id: 'med-diagnostics',
      title: 'Сверхточная диагностика',
      description: 'Диагностика на основе формальных моделей организма с использованием AGI.',
      state: 'unresolved',
      type: 'scientific_task',
      targetFunction: 'OptimizeDiagnostics()',
      zoneIds: ['medicine'],
      dependencyIds: ['core-agi-target'],
      dependentIds: [],
      fractalDepth: 1,
      economic: {
        costUnresolved: 5_000_000_000,
        costToSolve: 200_000_000,
        marketGain: 20_000_000_000,
        riskLoss: 30_000_000_000
      }
    },
    {
      id: 'pharm-design',
      title: 'Дизайн молекул (Фармакология)',
      description: 'Формальный дизайн лекарственных молекул с учётом сложных целевых функций AGI.',
      state: 'unresolved',
      type: 'scientific_task',
      targetFunction: 'DesignMolecules()',
      zoneIds: ['pharmacology'],
      dependencyIds: ['core-agi-target'],
      dependentIds: [],
      fractalDepth: 1,
      economic: {
        costUnresolved: 8_000_000_000,
        costToSolve: 300_000_000,
        marketGain: 40_000_000_000,
        riskLoss: 60_000_000_000
      }
    },
    {
      id: 'phys-unified',
      title: 'Единая Теория Поля',
      description: 'Применение монолитов RICIS-III для квантовой гравитации и объединения взаимодействий.',
      state: 'unresolved',
      type: 'scientific_task',
      targetFunction: 'UnifiedField(QG)',
      zoneIds: ['physics'],
      dependencyIds: ['core-agi-target', 'math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: {
        costUnresolved: 2_000_000_000,
        costToSolve: 500_000_000,
        marketGain: 100_000_000_000,
        riskLoss: 10_000_000_000
      }
    },
    {
      id: 'econ-value',
      title: 'Абсолютная Теория Стоимости',
      description: 'Сингулярная экономика и распределение ресурсов в пост-AGI обществе.',
      state: 'unresolved',
      type: 'scientific_task',
      targetFunction: 'Distribute(Value)',
      zoneIds: ['economics'],
      dependencyIds: ['core-agi-target'],
      dependentIds: [],
      fractalDepth: 1,
      economic: {
        costUnresolved: 50_000_000_000,
        costToSolve: 10_000_000_000,
        marketGain: 500_000_000_000,
        riskLoss: 200_000_000_000
      }
    },
    {
      id: 'ethic-alignment',
      title: 'Сингулярное Выравнивание',
      description: 'Гарантия сохранения идентичности (L1) в сверхразумных системах.',
      state: 'unresolved',
      type: 'scientific_task',
      targetFunction: 'Align(Human, AGI)',
      zoneIds: ['ethics'],
      dependencyIds: ['core-agi-target'],
      dependentIds: [],
      fractalDepth: 1,
      economic: {
        costUnresolved: 100_000_000_000,
        costToSolve: 2_000_000_000,
        marketGain: 1_000_000_000_000,
        riskLoss: 10_000_000_000_000
      }
    },
    {
      id: 'informatics-complexity',
      title: 'Преодоление P vs NP',
      description: 'Использование фрактального развёртывания для сведения NP-сложности к линейной топологии.',
      state: 'unresolved',
      type: 'scientific_task',
      targetFunction: 'ResolveComplexity(P, NP)',
      zoneIds: ['informatics'],
      dependencyIds: ['math-singularity'],
      dependentIds: [],
      fractalDepth: 1,
      economic: {
        costUnresolved: 3_000_000_000,
        costToSolve: 1_000_000_000,
        marketGain: 80_000_000_000,
        riskLoss: 15_000_000_000
      }
    }
  ],
  edges: [
    { id: 'edge-1', fromId: 'core-agi-target', toId: 'med-diagnostics', strength: 0.9, stateColor: 'red', economicInfluence: 0.7 },
    { id: 'edge-2', fromId: 'core-agi-target', toId: 'pharm-design', strength: 0.9, stateColor: 'red', economicInfluence: 0.8 },
    { id: 'edge-3', fromId: 'core-agi-target', toId: 'phys-unified', strength: 0.8, stateColor: 'red', economicInfluence: 0.9 },
    { id: 'edge-4', fromId: 'core-agi-target', toId: 'econ-value', strength: 0.9, stateColor: 'red', economicInfluence: 1.0 },
    { id: 'edge-5', fromId: 'core-agi-target', toId: 'ethic-alignment', strength: 1.0, stateColor: 'red', economicInfluence: 1.0 },
    { id: 'edge-6', fromId: 'math-singularity', toId: 'phys-unified', strength: 0.7, stateColor: 'yellow', economicInfluence: 0.8 },
    { id: 'edge-7', fromId: 'math-singularity', toId: 'informatics-complexity', strength: 0.8, stateColor: 'yellow', economicInfluence: 0.9 },
  ],
  zones: [
    {
      id: 'math',
      name: 'Математика',
      description: 'Формальные модели, аксиоматика, сложность.',
      nodeIds: ['math-singularity'],
      economicProfile: { costUnresolved: 1000, costToSolve: 100, marketGain: 10000, riskLoss: 5000 }
    },
    {
      id: 'informatics',
      name: 'Информатика и ИИ',
      description: 'Вычисления, нейросети, AGI.',
      nodeIds: ['core-agi-target', 'informatics-complexity'],
      economicProfile: { costUnresolved: 10000, costToSolve: 5000, marketGain: 50000, riskLoss: 100000 }
    },
    {
      id: 'medicine',
      name: 'Медицина',
      description: 'Здоровье и продолжительность жизни.',
      nodeIds: ['med-diagnostics'],
      economicProfile: { costUnresolved: 5000, costToSolve: 200, marketGain: 20000, riskLoss: 30000 }
    },
    {
      id: 'pharmacology',
      name: 'Фармакология',
      description: 'Молекулярный дизайн и синтез.',
      nodeIds: ['pharm-design'],
      economicProfile: { costUnresolved: 8000, costToSolve: 300, marketGain: 40000, riskLoss: 60000 }
    },
    {
      id: 'physics',
      name: 'Физика',
      description: 'Квантовая гравитация, энергия.',
      nodeIds: ['phys-unified'],
      economicProfile: { costUnresolved: 2000, costToSolve: 500, marketGain: 100000, riskLoss: 10000 }
    },
    {
      id: 'economics',
      name: 'Экономика',
      description: 'Моделирование стоимости, логистика.',
      nodeIds: ['econ-value'],
      economicProfile: { costUnresolved: 50000, costToSolve: 10000, marketGain: 500000, riskLoss: 200000 }
    },
    {
      id: 'ethics',
      name: 'Этика и Когнитивистика',
      description: 'Моральное выравнивание, безопасность.',
      nodeIds: ['ethic-alignment'],
      economicProfile: { costUnresolved: 100000, costToSolve: 2000, marketGain: 1000000, riskLoss: 10000000 }
    }
  ],
  axioms: [],
  proofs: {}
};
