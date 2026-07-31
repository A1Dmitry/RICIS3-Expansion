import { ProblemNode, ScienceZone, MapState } from './types';

/**
 * Физика экранирования и внешнего давления.
 *
 * Fext_i = -Pext * Si * normalize(x_i)
 * Frep_ij = k * (Si * Sj) / r^2 * normalize(x_i - x_j)
 * Fi = Fext_i + sum Frep_ij -> 0 в равновесии
 */

export function nodeShielding(node: ProblemNode): number {
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
  return Math.max(0.35, (0.55 + eco + deps) * typeBoost * stateBoost * reward);
}

export function zoneShielding(zone: ScienceZone, nodes: ProblemNode[]): number {
  const members = nodes.filter(n => zone.nodeIds.includes(n.id) || n.zoneIds.includes(zone.id));
  if (members.length === 0) {
    return 0.8 + Math.log10(1 + zone.economicProfile.costUnresolved) * 0.1;
  }
  const sumS = members.reduce((a, n) => a + nodeShielding(n), 0);
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
  Pext: 0.12,
  kRep: 28,
  steps: 120,
  dt: 0.45,
  damping: 0.84,
  soft: 1.4,
  r0: 14,
};

const DEFAULT_NODE: PressureLayoutParams = {
  Pext: 0.18,
  kRep: 12,
  steps: 100,
  dt: 0.4,
  damping: 0.82,
  soft: 0.55,
  r0: 3.5,
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
      const [nx, ny, nz] = normalize3(pos[i][0], pos[i][1], pos[i][2]);
      let fx = -Pext * Si * nx;
      let fy = -Pext * Si * ny;
      let fz = -Pext * Si * nz;

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
  const S = nodes.map(nodeShielding);

  const seed: [number, number, number][] = nodes.map((node, i) => {
    const zid = node.zoneIds[0] || 'math';
    const zc = zonePositions[zid] || [0, 0, 0];
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const rad = p.r0 * (0.6 + 0.4 * (S[i] / (1 + Math.max(...S))));
    return [
      zc[0] + Math.cos(angle) * rad,
      zc[1] + Math.sin(angle) * rad,
      zc[2] + ((i * 0.618) % 1) * 2 - 1,
    ];
  });

  const pos = seed.map(pt => [pt[0], pt[1], pt[2]] as [number, number, number]);
  const vel = pos.map(() => [0, 0, 0] as [number, number, number]);
  const { Pext, kRep, steps, dt, damping, soft } = p;
  const P_zone = Pext * 1.15;
  const P_origin = Pext * 0.25;

  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < n; i++) {
      const Si = S[i];
      const zid = nodes[i].zoneIds[0] || 'math';
      const zc = zonePositions[zid] || [0, 0, 0];

      const dxz = pos[i][0] - zc[0];
      const dyz = pos[i][1] - zc[1];
      const dzz = pos[i][2] - zc[2];
      const [nzx, nzy, nzz] = normalize3(dxz, dyz, dzz);
      let fx = -P_zone * Si * nzx;
      let fy = -P_zone * Si * nzy;
      let fz = -P_zone * Si * nzz;

      const [nox, noy, noz] = normalize3(pos[i][0], pos[i][1], pos[i][2]);
      fx += -P_origin * Si * nox;
      fy += -P_origin * Si * noy;
      fz += -P_origin * Si * noz;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const dz = pos[i][2] - pos[j][2];
        const r2 = dx * dx + dy * dy + dz * dz + soft * soft;
        if (r2 > 100) continue;
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

  const out: Record<string, [number, number, number]> = {};
  nodes.forEach((node, i) => {
    out[node.id] = pos[i];
  });
  return out;
}

export function zoneVisualRadius(zone: ScienceZone, nodes: ProblemNode[]): number {
  const S = zoneShielding(zone, nodes);
  return 3.8 + Math.sqrt(S) * 2.2;
}
