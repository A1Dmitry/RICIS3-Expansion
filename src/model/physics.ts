import { ProblemNode, ScienceZone, MapState } from './types';

/**
 * Физика экранирования и внешнего давления (Модель Катющика).
 *
 * Радиус R равен Массе M (M = R), Диаметр D = 2*R.
 * Экранирование массой (диаметром): Масса M экранирует внешнее эфирное давление Pext.
 * Fext_i = -Pext * Si * normalize(x_i)
 * Frep_ij = k * (Si * Sj) / r^2 * normalize(x_i - x_j)
 * Орбиты узлов сжимаются в плоские экваториальные диски (ПЛОСКИЕ ОРБИТЫ / ЭФИРНОЕ КОЛЬЦО).
 */

export function nodeShielding(node: ProblemNode, allNodes?: ProblemNode[]): number {
  // По Катющику: Радиус = Масса (M = R), Диаметр = 2*R.
  const mass = nodeVisualRadius(node, allNodes || [node]); // M = R
  const diameter = mass * 2; // D = 2*R
  
  const eco =
    Math.log10(1 + node.economic.costUnresolved) * 0.15 +
    Math.log10(1 + node.economic.riskLoss) * 0.12 +
    Math.log10(1 + node.economic.marketGain) * 0.1;
  const deps = 0.08 * (node.dependencyIds?.length || 0) + 0.05 * (node.dependentIds?.length || 0);
  const typeBoost =
    node.type === 'core_singularity' ? 1.4 : node.type === 'scientific_task' ? 1.0 : 0.85;
  const stateBoost =
    node.state === 'resolved' ? 0.7 : node.state === 'partial' ? 1.05 : 1.0;
  const reward =
    node.rewardClass === 'clay'
      ? 1.35
      : node.rewardClass === 'nobel'
      ? 1.3
      : node.rewardClass === 'commercial'
      ? 1.1
      : 1.0;

  // Экранирование массой/диаметром: S_i пропорционально массе M (R)
  return Math.max(0.35, mass * (0.55 + eco + deps) * typeBoost * stateBoost * reward);
}

export function zoneShielding(zone: ScienceZone, nodes: ProblemNode[]): number {
  const members = nodes.filter(n => zone.nodeIds.includes(n.id) || n.zoneIds.includes(zone.id));
  if (members.length === 0) {
    return 0.8 + Math.log10(1 + zone.economicProfile.costUnresolved) * 0.1;
  }
  // Суммарное экранирование массой всех составляющих узлов ядра/электронов
  const sumS = members.reduce((a, n) => a + nodeShielding(n, nodes), 0);
  const nBoost = Math.pow(members.length, 0.45);
  return Math.max(0.8, sumS * 0.35 + nBoost * 0.9);
}

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const len = Math.sqrt(x * x + y * y + z * z) + 1e-9;
  return [x / len, y / len, z / len];
}

export interface PressureLayoutParams {
  Pext: number;
  kRep: number;
  steps: number;
  dt: number;
  damping: number;
  soft: number;
  r0: number;
}

const DEFAULT_ZONE: PressureLayoutParams = {
  Pext: 0.00315, // Уменьшенное на 10% внешнее давление среды
  kRep: 250,     // Экранирующее отталкивание между зонами
  steps: 160,
  dt: 0.45,
  damping: 0.84,
  soft: 1.4,
  r0: 16,
};

const DEFAULT_NODE: PressureLayoutParams = {
  Pext: 0.0054,  // Уменьшенное на 10% давление среды внутри научной зоны
  kRep: 220,     // Отталкивание между соседними телами
  steps: 140,
  dt: 0.4,
  damping: 0.82,
  soft: 0.55,
  r0: 4.5,
};

export function relaxPressureRepulsion(
  n: number,
  S: number[],
  params: PressureLayoutParams,
  seedPos?: [number, number, number][]
): [number, number, number][] {
  if (n === 0) return [];

  const pos: [number, number, number][] =
    seedPos && seedPos.length === n
      ? seedPos.map(p => [p[0], p[1], p[2]] as [number, number, number])
      : Array.from({ length: n }, (_, i) => {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
          const theta = Math.PI * (1 + Math.sqrt(5)) * i;
          const meanS = S.reduce((a, b) => a + b, 0) / n + 1e-6;
          const r = params.r0 * (0.85 + 0.15 * (S[i] / meanS));
          return [
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi) * 0.55,
          ] as [number, number, number];
        });

  const vel = pos.map(() => [0, 0, 0] as [number, number, number]);
  const { Pext, kRep, steps, dt, damping, soft } = params;

  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < n; i++) {
      const Si = S[i];
      // Spring attraction to origin
      let fx = -Pext * Si * pos[i][0];
      let fy = -Pext * Si * pos[i][1];
      let fz = -Pext * Si * pos[i][2];

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const dz = pos[i][2] - pos[j][2];
        const r2 = dx * dx + dy * dy + dz * dz + soft * soft;
        const invR = 1 / Math.sqrt(r2);
        const mag = (kRep * (Si * S[j])) / r2;
        fx += dx * invR * mag;
        fy += dy * invR * mag;
        fz += dz * invR * mag;
      }

      vel[i][0] = (vel[i][0] + fx * dt) * damping;
      vel[i][1] = (vel[i][1] + fy * dt) * damping;
      vel[i][2] = (vel[i][2] + fz * dt) * damping;
    }
    for (let i = 0; i < n; i++) {
      pos[i][0] += vel[i][0] * dt;
      pos[i][1] += vel[i][1] * dt;
      pos[i][2] += vel[i][2] * dt;
    }
  }

  return pos;
}

export function layoutZones(
  zones: ScienceZone[],
  nodes: ProblemNode[],
  params: Partial<PressureLayoutParams> = {}
): Record<string, [number, number, number]> {
  const p = { ...DEFAULT_ZONE, ...params };
  const S = zones.map(z => zoneShielding(z, nodes));
  const pos = relaxPressureRepulsion(zones.length, S, p);

  const zoneR = zones.map(z => zoneVisualRadius(z, nodes));
  const n = zones.length;
  const ZONE_SURFACE_GAP = 5.0; // Четкий красивый зазор между оболочками зон при плотной упаковке

  // Внешнее давление поджимает зоны к центру, но поверхностное отталкивание строго запрещает пересечение
  for (let iter = 0; iter < 500; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const dz = pos[i][2] - pos[j][2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 1e-9;

        // ЭКРАНИРУЮЩЕЕ ПОВЕРХНОСТНОЕ ОТТАЛКИВАНИЕ КАЦИЮЩИКА:
        // Дистанция между центрами не менее R1 + R2 + ZONE_SURFACE_GAP
        const requiredDist = zoneR[i] + zoneR[j] + ZONE_SURFACE_GAP;
        if (dist < requiredDist) {
          const overlap = requiredDist - dist;
          const px = (dx / dist) * overlap * 0.5;
          const py = (dy / dist) * overlap * 0.5;
          const pz = (dz / dist) * overlap * 0.5;

          pos[i][0] += px; pos[i][1] += py; pos[i][2] += pz;
          pos[j][0] -= px; pos[j][1] -= py; pos[j][2] -= pz;
        }
      }
    }
    // Внешнее поджимающее давление среды к центру кластера (ослаблено на 10%)
    for (let i = 0; i < n; i++) {
      pos[i][0] *= 0.9964;
      pos[i][1] *= 0.9964;
      pos[i][2] *= 0.9964;
    }
  }

  const out: Record<string, [number, number, number]> = {};
  zones.forEach((z, i) => {
    out[z.id] = pos[i];
  });
  return out;
}

export function layoutNodes(
  map: MapState,
  zonePositions: Record<string, [number, number, number]>,
  params: Partial<PressureLayoutParams> = {}
): Record<string, [number, number, number]> {
  const nodes = map.nodes;
  const n = nodes.length;
  if (n === 0) return {};

  const p = { ...DEFAULT_NODE, ...params };

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const getZid = (node: ProblemNode) => (node.zoneIds[0] && zonePositions[node.zoneIds[0]]) ? node.zoneIds[0] : 'math';
  
  const zoneMaxDepth: Record<string, number> = {};
  const zoneBaseR: Record<string, number> = {};
  
  map.zones.forEach(z => {
    zoneMaxDepth[z.id] = 0;
    zoneBaseR[z.id] = zoneVisualRadius(z, map.nodes);
  });
  
  nodes.forEach(node => {
    const zid = getZid(node);
    if (zoneMaxDepth[zid] === undefined) {
       zoneMaxDepth[zid] = 0;
       zoneBaseR[zid] = 15;
    }
    if (node.fractalDepth && node.fractalDepth > zoneMaxDepth[zid]) {
      zoneMaxDepth[zid] = node.fractalDepth;
    }
  });

  const rawPos: Record<string, [number, number, number]> = {};
  const nodeRadii: Record<string, number> = {};
  nodes.forEach(node => {
    nodeRadii[node.id] = nodeVisualRadius(node, nodes);
  });

  // Group depth 0 nodes by zone for a spacious root distribution
  const zoneDepth0Map: Record<string, ProblemNode[]> = {};
  nodes.filter(n => (n.fractalDepth || 0) === 0).forEach(node => {
    const zid = getZid(node);
    if (!zoneDepth0Map[zid]) zoneDepth0Map[zid] = [];
    zoneDepth0Map[zid].push(node);
  });

  Object.entries(zoneDepth0Map).forEach(([zid, d0Nodes]) => {
    const zc = zonePositions[zid] || [0, 0, 0];
    const R = zoneBaseR[zid] || 15;
    const rCore = Math.max(5, R * 0.28);
    
    // Sort d0Nodes so that nodes with the most dependent references/core hubs are placed closest to center [zc]
    d0Nodes.sort((a, b) => {
      const scoreA = (a.dependentIds?.length || 0) * 2 + (a.dependencyIds?.length || 0) + (/AGI|Core|Якобиан|Jacobian|Инвариант/i.test(a.title) ? 10 : 0);
      const scoreB = (b.dependentIds?.length || 0) * 2 + (b.dependencyIds?.length || 0) + (/AGI|Core|Якобиан|Jacobian|Инвариант/i.test(b.title) ? 10 : 0);
      return scoreB - scoreA;
    });

    const count = d0Nodes.length;
    d0Nodes.forEach((node, i) => {
      if (count === 1 || i === 0) {
        // Core hub node at exact center of zone
        rawPos[node.id] = [zc[0], zc[1], zc[2]];
      } else {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        rawPos[node.id] = [
          zc[0] + Math.sin(phi) * Math.cos(theta) * rCore,
          zc[1] + Math.sin(phi) * Math.sin(theta) * rCore,
          zc[2] + Math.cos(phi) * rCore
        ];
      }
    });
  });

  const globalMaxDepth = Math.max(0, ...Object.values(zoneMaxDepth));

  for (let d = 1; d <= globalMaxDepth; d++) {
    const layerNodes = nodes.filter(n => (n.fractalDepth || 0) === d);
    
    const parentGroups: Record<string, typeof layerNodes> = {};
    layerNodes.forEach(node => {
      let primaryParentId = node.dependencyIds?.find(depId => {
         const dep = nodeMap.get(depId);
         return dep && (dep.fractalDepth || 0) === d - 1;
      }) || 'none';
      
      if (!parentGroups[primaryParentId]) parentGroups[primaryParentId] = [];
      parentGroups[primaryParentId].push(node);
    });
    
    for (const [parentId, siblings] of Object.entries(parentGroups)) {
      const parentNode = nodeMap.get(parentId);
      let baseDir = [0, 1, 0];
      
      const zid = getZid(siblings[0]);
      const zc = zonePositions[zid] || [0, 0, 0];
      const maxD = zoneMaxDepth[zid] || 1;
      let R = zoneBaseR[zid] || 15;
      const rCore = Math.max(5, R * 0.28);
      const orbitStep = Math.max(6, R * 0.25);
      
      const siblingFootprint = siblings.reduce((sum, s) => sum + nodeRadii[s.id] * 2 + 0.8, 0);
      const minOrbitForSiblings = siblingFootprint / (2 * Math.PI);
      const targetR = Math.max(rCore + d * orbitStep, minOrbitForSiblings);
      
      if (parentNode && rawPos[parentId]) {
        const pp = rawPos[parentId];
        const dx = pp[0] - zc[0];
        const dy = pp[1] - zc[1];
        const dz = pp[2] - zc[2];
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz) + 1e-9;
        if (len < 1) { 
           baseDir = [Math.random()-0.5, Math.random()-0.5, Math.random()-0.5];
           const blen = Math.sqrt(baseDir[0]*baseDir[0] + baseDir[1]*baseDir[1] + baseDir[2]*baseDir[2]) + 1e-9;
           baseDir = [baseDir[0]/blen, baseDir[1]/blen, baseDir[2]/blen];
        } else {
           baseDir = [dx/len, dy/len, dz/len];
        }
      } else {
        baseDir = [Math.random()-0.5, Math.random()-0.5, Math.random()-0.5];
        const len = Math.sqrt(baseDir[0]*baseDir[0] + baseDir[1]*baseDir[1] + baseDir[2]*baseDir[2]) + 1e-9;
        baseDir = [baseDir[0]/len, baseDir[1]/len, baseDir[2]/len];
      }
      
      let vUp = [0, 1, 0];
      if (Math.abs(baseDir[1]) > 0.9) vUp = [1, 0, 0];
      
      let cx = baseDir[1]*vUp[2] - baseDir[2]*vUp[1];
      let cy = baseDir[2]*vUp[0] - baseDir[0]*vUp[2];
      let cz = baseDir[0]*vUp[1] - baseDir[1]*vUp[0];
      let cLen = Math.sqrt(cx*cx + cy*cy + cz*cz) + 1e-9;
      const u1 = [cx/cLen, cy/cLen, cz/cLen];
      
      const u2 = [
        baseDir[1]*u1[2] - baseDir[2]*u1[1],
        baseDir[2]*u1[0] - baseDir[0]*u1[2],
        baseDir[0]*u1[1] - baseDir[1]*u1[0]
      ];
      
      const requiredAngle = (siblingFootprint / (2 * Math.PI * targetR)) * Math.PI * 1.5;
      const coneAngle = Math.max(Math.PI / 4, Math.min(Math.PI / 1.8, requiredAngle));
      
      // Sort siblings so nodes with many dependent references are closest
      siblings.sort((a, b) => {
        const scoreA = (a.dependentIds?.length || 0) * 2 + (/AGI|Core|Якобиан|Jacobian|Инвариант/i.test(a.title) ? 10 : 0);
        const scoreB = (b.dependentIds?.length || 0) * 2 + (/AGI|Core|Якобиан|Jacobian|Инвариант/i.test(b.title) ? 10 : 0);
        return scoreB - scoreA;
      });

      siblings.forEach((node, i) => {
        let dir = [...baseDir];
        if (siblings.length === 1) {
          dir = [...baseDir];
        } else {
          // 2D Fibonacci cap distribution across the cone cap
          const cosCap = 1 - (1 - Math.cos(coneAngle)) * ((i + 0.5) / siblings.length);
          const sinCap = Math.sqrt(Math.max(0, 1 - cosCap * cosCap));
          const phi = 2 * Math.PI * i * 0.618033988749895; // Golden angle
          
          dir = [
            baseDir[0] * cosCap + (u1[0] * Math.cos(phi) + u2[0] * Math.sin(phi)) * sinCap,
            baseDir[1] * cosCap + (u1[1] * Math.cos(phi) + u2[1] * Math.sin(phi)) * sinCap,
            baseDir[2] * cosCap + (u1[2] * Math.cos(phi) + u2[2] * Math.sin(phi)) * sinCap
          ];
          const dLen = Math.sqrt(dir[0]*dir[0] + dir[1]*dir[1] + dir[2]*dir[2]) + 1e-9;
          dir = [dir[0]/dLen, dir[1]/dLen, dir[2]/dLen];
        }
        
        // Scale radial orbit distance in towards center if node has many dependent references or is core
        const depCount = (node.dependentIds?.length || 0);
        const isCoreHub = /AGI|Core|Якобиан|Jacobian|Инвариант/i.test(node.title);
        const radialScale = isCoreHub ? 0.35 : (depCount > 0 ? 1 / Math.sqrt(1 + depCount * 0.75) : 1);
        const effectiveR = targetR * radialScale;

        rawPos[node.id] = [
          zc[0] + dir[0] * effectiveR,
          zc[1] + dir[1] * effectiveR,
          zc[2] + dir[2] * effectiveR
        ];
      });
    }
  }

  const pos: [number, number, number][] = nodes.map(n => rawPos[n.id] || [0,0,0]);
  const minSurfaceGap = 1.5; // Strict surface gap between node spheres inside scientific zones

  // Surface-to-surface repulsion simulation & zone containment
  for (let s = 0; s < 500; s++) {
    // 1. Surface-to-surface node repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const nodeI = nodes[i];
        const nodeJ = nodes[j];
        const radI = nodeRadii[nodeI.id];
        const radJ = nodeRadii[nodeJ.id];
        
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const dz = pos[i][2] - pos[j][2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 1e-9;
        
        // SURFACE-TO-SURFACE REPULSION REQUIREMENT:
        // Center distance must be at least radI + radJ + minSurfaceGap
        const requiredDist = radI + radJ + minSurfaceGap;
        if (dist < requiredDist) {
          const overlap = requiredDist - dist;
          const px = (dx / dist) * overlap * 0.5;
          const py = (dy / dist) * overlap * 0.5;
          const pz = (dz / dist) * overlap * 0.5;
          
          pos[i][0] += px; pos[i][1] += py; pos[i][2] += pz;
          pos[j][0] -= px; pos[j][1] -= py; pos[j][2] -= pz;
        }
      }
    }

    // 2. Central attraction force towards zone center for core nodes & hubs with many dependent references
    for (let i = 0; i < n; i++) {
      const nodeI = nodes[i];
      const zidI = getZid(nodeI);
      const zcI = zonePositions[zidI] || [0, 0, 0];
      
      const depCount = (nodeI.dependentIds?.length || 0) + (nodeI.dependencyIds?.length || 0);
      const isCoreHub = nodeI.fractalDepth === 0 || /AGI|Core|Якобиан|Jacobian|Инвариант|singularity/i.test(nodeI.title);
      
      const pullFactor = isCoreHub ? 0.08 : (depCount > 1 ? Math.min(0.06, 0.015 * depCount) : 0.002);
      
      pos[i][0] += (zcI[0] - pos[i][0]) * pullFactor;
      pos[i][1] += (zcI[1] - pos[i][1]) * pullFactor;
      pos[i][2] += (zcI[2] - pos[i][2]) * pullFactor;
    }

    // 2. Contain nodes strictly inside their scientific zone boundary
    for (let i = 0; i < n; i++) {
      const nodeI = nodes[i];
      const zidI = getZid(nodeI);
      const zcI = zonePositions[zidI] || [0, 0, 0];
      const zR = zoneBaseR[zidI] || 15;
      const radI = nodeRadii[nodeI.id];

      const dx = pos[i][0] - zcI[0];
      const dy = pos[i][1] - zcI[1];
      const dz = pos[i][2] - zcI[2];
      const distFromCenter = Math.sqrt(dx*dx + dy*dy + dz*dz) + 1e-9;

      // Outer surface of node sphere must stay inside zone bubble
      const maxAllowedDist = Math.max(1.0, zR - radI - 0.5);
      if (distFromCenter > maxAllowedDist) {
        pos[i][0] = zcI[0] + (dx / distFromCenter) * maxAllowedDist;
        pos[i][1] = zcI[1] + (dy / distFromCenter) * maxAllowedDist;
        pos[i][2] = zcI[2] + (dz / distFromCenter) * maxAllowedDist;
      }
    }
  }

  const out: Record<string, [number, number, number]> = {};
  nodes.forEach((node, i) => {
    out[node.id] = pos[i];
  });
  return out;
}

/** 
 * Радиус сферы зоны 
 */
export function zoneVisualRadius(zone: ScienceZone, nodes: ProblemNode[]): number {
  const members = nodes.filter(
    n => zone.nodeIds.includes(n.id) || n.zoneIds.includes(zone.id)
  );
  if (members.length === 0) return 8.0;

  const sumNodeR = members.reduce((sum, n) => sum + nodeVisualRadius(n, nodes), 0);
  const maxNodeR = Math.max(...members.map(n => nodeVisualRadius(n, nodes)));
  const S = zoneShielding(zone, nodes);
  const byCount = Math.sqrt(members.length) * 2.8;
  const byShield = Math.sqrt(S) * 0.8;

  // Guarantee zone bubble radius comfortably encloses all member nodes
  const contentR = maxNodeR * 2.5 + Math.sqrt(sumNodeR) * 3.2 + byCount + byShield;
  return Number(Math.max(10.0, contentR).toFixed(2));
}

export function nodeVisualRadius(node: ProblemNode, allNodes: ProblemNode[]): number {
  const nodeList = allNodes && allNodes.length > 0 ? allNodes : [node];

  // Helper to compute net profitability of a node solution (marketGain - costToSolve)
  const getProfit = (n: ProblemNode): number => {
    const gain = n.economic?.marketGain || 0;
    const cost = n.economic?.costToSolve || 0;
    return Math.max(1, gain - cost);
  };

  // 1. Calculate profitability for all nodes in the map
  const profits = nodeList.map(getProfit);

  // 2. Find min and max bounds of the profitability range
  const minP = Math.min(...profits);
  const maxP = Math.max(...profits);

  const logMin = Math.log10(minP);
  const logMax = Math.log10(maxP);

  // 3. Compute profitability and log value for current node
  const nodeP = getProfit(node);
  const logP = Math.log10(nodeP);

  // 4. Normalized score on log scale [0..1]
  const t = logMax > logMin ? Math.max(0, Math.min(1, (logP - logMin) / (logMax - logMin))) : 0.5;

  // 5. Rank node sphere visual radius on logarithmic scale with high contrast ratio
  // Min radius = 0.75 (compact), Max radius = 3.60 (prominent)
  const R_MIN = 0.75;
  const R_MAX = 3.60;
  const baseRadius = R_MIN + t * (R_MAX - R_MIN);

  // Core singularity structural boost
  const coreBoost = node.type === 'core_singularity' ? 1.15 : 1.0;

  return Number((baseRadius * coreBoost).toFixed(2));
}
