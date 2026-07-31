import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { useMapStore } from '../store/mapStore';
import * as THREE from 'three';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { APP_BUILD_LABEL, APP_VERSION } from '../version';

const zoneColors: Record<string, string> = {
  math: '#3b82f6',
  informatics: '#06b6d4',
  medicine: '#10b981',
  pharmacology: '#8b5cf6',
  physics: '#f59e0b',
  economics: '#eab308',
  ethics: '#f43f5e',
  cognitive: '#a78bfa',
  chemistry: '#34d399',
  bioinformatics: '#2dd4bf',
};

function OrbitControls() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<ThreeOrbitControls | null>(null);
  useEffect(() => {
    const controls = new ThreeOrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.panSpeed = 0.8;
    controls.zoomSpeed = 1.0;
    controls.minDistance = 4;
    controls.maxDistance = 80;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;
    return () => { controls.dispose(); controlsRef.current = null; };
  }, [camera, gl]);
  useFrame(() => { controlsRef.current?.update(); });
  return null;
}

export const Map3D: React.FC = () => {
  const map = useMapStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showProof, setShowProof] = useState<boolean>(false);
  const selectedNode = map.nodes.find(n => n.id === selectedNodeId) || null;
  useEffect(() => { setShowProof(false); }, [selectedNodeId]);
  const handleSolve = (id: string) => { map.solveNode(id); };

  const zonePositions = useMemo(() => {
    const n = map.zones.length;
    if (n === 0) return {} as Record<string, [number, number, number]>;
    const pos: [number, number, number][] = map.zones.map((_, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r0 = 10;
      return [
        r0 * Math.sin(phi) * Math.cos(theta),
        r0 * Math.sin(phi) * Math.sin(theta),
        r0 * Math.cos(phi) * 0.55,
      ];
    });
    const kPressure = 0.045;
    const kRepel = 18;
    const lambda = 6.5;
    const soft = 1.2;
    const damping = 0.82;
    const steps = 80;
    const dt = 0.55;
    const vel = pos.map(() => [0, 0, 0] as [number, number, number]);
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < n; i++) {
        let fx = -kPressure * pos[i][0];
        let fy = -kPressure * pos[i][1];
        let fz = -kPressure * pos[i][2];
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = pos[i][0] - pos[j][0];
          const dy = pos[i][1] - pos[j][1];
          const dz = pos[i][2] - pos[j][2];
          const r2 = dx * dx + dy * dy + dz * dz + soft * soft;
          const r = Math.sqrt(r2);
          const mag = (kRepel / r2) * Math.exp(-r / lambda);
          fx += (dx / r) * mag;
          fy += (dy / r) * mag;
          fz += (dz / r) * mag;
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
    const positions: Record<string, [number, number, number]> = {};
    map.zones.forEach((zone, i) => {
      positions[zone.id] = [pos[i][0], pos[i][1], pos[i][2]];
    });
    return positions;
  }, [map.zones]);

  const nodePositions = useMemo(() => {
    const positions: Record<string, [number, number, number]> = {};
    const zoneCounts: Record<string, number> = {};
    map.nodes.forEach(node => {
      const primaryZone = node.zoneIds[0];
      const zPos = zonePositions[primaryZone] || [0, 0, 0];
      const count = zoneCounts[primaryZone] || 0;
      zoneCounts[primaryZone] = count + 1;
      if (node.type === 'core_singularity') {
        positions[node.id] = [zPos[0] * 0.3, zPos[1] * 0.3, zPos[2] * 0.3];
      } else {
        const angle = count * Math.PI * 0.618;
        const dist = 1.5 + count * 0.8;
        const zOff = ((count * 0.73) % 1) * 3.2 - 1.6;
        positions[node.id] = [
          zPos[0] + Math.cos(angle) * dist,
          zPos[1] + Math.sin(angle) * dist,
          zPos[2] + zOff,
        ];
      }
    });
    return positions;
  }, [map.nodes, zonePositions]);

  const edgesLines = useMemo(() => {
    return map.edges.map(edge => {
      const fromPos = nodePositions[edge.fromId];
      const toPos = nodePositions[edge.toId];
      if (!fromPos || !toPos) return null;
      const points = [new THREE.Vector3(...fromPos), new THREE.Vector3(...toPos)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return (
        <primitive
          key={edge.id}
          object={new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({
              color: edge.stateColor === 'green' ? '#22c55e' : edge.stateColor === 'yellow' ? '#eab308' : '#ef4444',
              linewidth: 2,
              opacity: 0.6,
              transparent: true,
            })
          )}
        />
      );
    });
  }, [map.edges, nodePositions]);

  return (
    <div className="w-full h-screen bg-[#050505] text-[#e0e0e0] font-sans overflow-hidden flex flex-col">
      <header className="h-16 border-b border-cyan-900/30 bg-[#080808] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_cyan]"></div>
          <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">RICIS-III // Singularity Map Core</h1>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/50 text-cyan-300"
            title={`Версия приложения ${APP_VERSION}`}
          >
            {APP_BUILD_LABEL}
          </span>
        </div>
        <div className="flex gap-8 text-[10px] font-mono">
          <div className="flex flex-col">
            <span className="text-gray-500">VERSION</span>
            <span className="text-cyan-200">{APP_BUILD_LABEL}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">FRACTAL_DEPTH</span>
            <span className="text-cyan-200">LEVEL_{Math.max(...map.nodes.map(n => n.fractalDepth), 0).toString().padStart(2, '0')}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">NODES_TOTAL</span>
            <span className="text-cyan-200">{map.nodes.length.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">ECONOMIC_POTENTIAL</span>
            <span className="text-green-400">${(map.nodes.reduce((acc, n) => acc + n.economic.marketGain, 0) / 1e12).toFixed(1)}T</span>
          </div>
        </div>
      </header>
      <main className="flex-1 flex relative overflow-hidden">
        <aside className="w-64 border-r border-cyan-900/20 bg-[#070707] p-4 flex flex-col gap-6 shrink-0 z-10 overflow-y-auto">
          <section>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3">Science Zones</h3>
            <div className="space-y-2">
              {map.zones.map(zone => (
                <div key={zone.id} className="flex items-center justify-between p-2 bg-neutral-900/40 border border-neutral-800/50 rounded">
                  <span className="text-xs text-gray-300" title={zone.description}>{zone.name}</span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: zoneColors[zone.id] || '#ffffff' }}></span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3">Persistence</h3>
            <div className="space-y-2">
              <button type="button" onClick={() => { void map.saveNow(); }} className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-cyan-800/50 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/40">Сохранить в IndexedDB</button>
              <button type="button" onClick={() => map.downloadJson()} className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-neutral-700 bg-neutral-900/50 text-gray-300 hover:bg-neutral-800">Скачать снимок .json</button>
              <button type="button" onClick={() => { if (window.confirm('Сбросить карту?')) void map.resetMap(); }} className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-red-900/40 bg-red-950/20 text-red-300/90 hover:bg-red-900/30">Сброс карты</button>
              <p className="text-[9px] text-gray-600 leading-snug pt-1">Версия {APP_BUILD_LABEL}. После обновления кода — сброс карты.</p>
            </div>
          </section>
        </aside>
        <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_#0a0f1a_0%,_#050505_100%)]">
          <Canvas camera={{ position: [0, 0, 25], fov: 60 }}>
            <OrbitControls />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#06b6d4" />
            {map.zones.map(zone => {
              const pos = zonePositions[zone.id] || [0, 0, 0];
              const color = zoneColors[zone.id] || '#ffffff';
              return (
                <mesh key={zone.id} position={pos}>
                  <sphereGeometry args={[7, 32, 32]} />
                  <meshStandardMaterial color={color} transparent opacity={0.06} roughness={0.1} metalness={0.2} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
              );
            })}
            {edgesLines}
            {map.nodes.map(node => {
              const pos = nodePositions[node.id] || [0, 0, 0];
              const isSelected = selectedNode?.id === node.id;
              const isCore = node.type === 'core_singularity';
              return (
                <mesh key={node.id} position={pos} onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}>
                  <sphereGeometry args={[isSelected ? (isCore ? 1.4 : 1.0) : (isCore ? 1.0 : 0.6), 32, 32]} />
                  <meshStandardMaterial
                    color={node.state === 'resolved' ? '#22c55e' : node.state === 'partial' ? '#eab308' : '#ef4444'}
                    roughness={0.2}
                    metalness={0.8}
                    emissive={isSelected ? '#22d3ee' : '#000000'}
                    emissiveIntensity={isSelected ? 0.5 : isCore ? 0.2 : 0}
                  />
                </mesh>
              );
            })}
          </Canvas>
          {selectedNode && (
            <div className="absolute top-6 right-6 w-80 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-5 shadow-2xl pointer-events-auto">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-sm font-bold text-white leading-tight mb-1">{selectedNode.title}</h2>
                  <span className="text-[9px] font-mono text-cyan-400">ID: {selectedNode.id}</span>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="text-neutral-500 hover:text-white ml-4">✕</button>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">{selectedNode.description}</p>
              {(selectedNode as { ricisSolvable?: boolean }).ricisSolvable && (
                <span className="inline-block mb-3 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-900/50 text-cyan-300 border border-cyan-700/40">RICIS-SOLVABLE</span>
              )}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/5 p-2 rounded">
                  <span className="block text-[8px] text-gray-500 uppercase">Risk Loss</span>
                  <span className="text-xs font-mono text-red-400">${(selectedNode.economic.riskLoss / 1e9).toFixed(1)}B</span>
                </div>
                <div className="bg-white/5 p-2 rounded">
                  <span className="block text-[8px] text-gray-500 uppercase">Market Gain</span>
                  <span className="text-xs font-mono text-green-400">${(selectedNode.economic.marketGain / 1e9).toFixed(1)}B</span>
                </div>
              </div>
              <code className="block text-[10px] bg-black p-2 rounded border border-gray-800 font-mono text-cyan-200 mb-4">{selectedNode.targetFunction}</code>
              <button
                onClick={() => handleSolve(selectedNode.id)}
                disabled={selectedNode.state === 'resolved'}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold text-xs uppercase tracking-widest rounded"
              >
                {selectedNode.state === 'resolved' ? 'Axiom Extracted' : 'Execute RICIS Solution'}
              </button>
              {selectedNode.state === 'resolved' && map.getLatexProof(selectedNode.id) && (
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <button onClick={() => setShowProof(!showProof)} className="w-full flex justify-between text-cyan-400 text-xs font-bold uppercase">
                    <span>View Formal Proof (LaTeX)</span><span>{showProof ? '▲' : '▼'}</span>
                  </button>
                  {showProof && (
                    <div className="mt-3 bg-[#020202] p-3 rounded border border-cyan-900/50 text-gray-300 font-mono text-[9px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {map.getLatexProof(selectedNode.id)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <footer className="h-8 border-t border-cyan-900/30 bg-[#080808] flex items-center px-4 overflow-hidden shrink-0">
        <div className="flex whitespace-nowrap gap-8 text-[9px] font-mono text-cyan-900/60 uppercase tracking-tighter">
          <span className="text-cyan-400/90">// VERSION {APP_BUILD_LABEL}</span>
          <span className="text-cyan-500/80">// RICIS-III BOOT SEQUENCE COMPLETED</span>
          <span>// ZONE LAYOUT: PRESSURE + YUKAWA SCREENING</span>
          <span className="text-green-500/80">// L1 IDENTITY AXIOM ENFORCED</span>
        </div>
      </footer>
    </div>
  );
};
