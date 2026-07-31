import React, { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useMapStore } from '../store/mapStore';
import * as THREE from 'three';

const zoneColors: Record<string, string> = {
  math: '#3b82f6', // blue
  informatics: '#06b6d4', // cyan
  medicine: '#10b981', // emerald
  pharmacology: '#8b5cf6', // purple
  physics: '#f59e0b', // amber
  economics: '#eab308', // yellow
  ethics: '#f43f5e', // rose
};

export const Map3D: React.FC = () => {
  const map = useMapStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showProof, setShowProof] = useState<boolean>(false);

  const selectedNode = map.nodes.find(n => n.id === selectedNodeId) || null;

  useEffect(() => {
    setShowProof(false);
  }, [selectedNodeId]);

  const handleSolve = (id: string) => {
    map.solveNode(id);
  };

  const zonePositions = useMemo(() => {
    const positions: Record<string, [number, number, number]> = {};
    const radius = 12; // Spread zones out wide
    const numZones = map.zones.length;
    map.zones.forEach((zone, index) => {
      const angle = (index / numZones) * Math.PI * 2;
      positions[zone.id] = [
        Math.cos(angle) * radius, 
        Math.sin(angle) * radius, 
        (index % 2 === 0 ? -3 : 3)
      ];
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
        // Core singularities slightly offset from center towards their zone
        positions[node.id] = [
          zPos[0] * 0.3, 
          zPos[1] * 0.3, 
          zPos[2] * 0.3
        ];
      } else {
        // Other tasks distributed inside the zone bubble
        const angle = count * Math.PI * 0.618;
        const dist = 1.5 + (count * 0.8);
        positions[node.id] = [
          zPos[0] + Math.cos(angle) * dist,
          zPos[1] + Math.sin(angle) * dist,
          zPos[2] + (Math.random() - 0.5) * 4
        ];
      }
    });

    return positions;
  }, [map.nodes, zonePositions]);

  // Edges definition
  const edgesLines = useMemo(() => {
    return map.edges.map(edge => {
      const fromPos = nodePositions[edge.fromId];
      const toPos = nodePositions[edge.toId];
      
      if (!fromPos || !toPos) return null;
      
      const points = [
        new THREE.Vector3(...fromPos),
        new THREE.Vector3(...toPos)
      ];
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      return (
        <primitive 
          key={edge.id} 
          object={new THREE.Line(
            geometry, 
            new THREE.LineBasicMaterial({
              color: edge.stateColor === 'green' ? '#22c55e' : 
                     edge.stateColor === 'yellow' ? '#eab308' : '#ef4444',
              linewidth: 2,
              opacity: 0.6,
              transparent: true
            })
          )} 
        />
      );
    });
  }, [map.edges, nodePositions]);

  return (
    <div className="w-full h-screen bg-[#050505] text-[#e0e0e0] font-sans overflow-hidden flex flex-col">
      {/* Header: System Status */}
      <header className="h-16 border-b border-cyan-900/30 bg-[#080808] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_cyan]"></div>
          <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">RICIS-III // Singularity Map Core</h1>
        </div>
        <div className="flex gap-8 text-[10px] font-mono">
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
            <span className="text-green-400">
              ${(map.nodes.reduce((acc, n) => acc + n.economic.marketGain, 0) / 1_000_000_000_000).toFixed(1)}T
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex relative overflow-hidden">
        {/* Sidebar Left: Navigation & Layers */}
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
            <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3">Visual Layers</h3>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-[11px] text-cyan-300 py-1 cursor-pointer">
                <div className="w-3 h-3 border border-cyan-500 bg-cyan-500/20"></div> Economic Heatmap
              </label>
              <label className="flex items-center gap-2 text-[11px] text-gray-500 py-1 cursor-pointer">
                <div className="w-3 h-3 border border-gray-600"></div> Risk Trajectories
              </label>
              <label className="flex items-center gap-2 text-[11px] text-gray-500 py-1 cursor-pointer">
                <div className="w-3 h-3 border border-gray-600"></div> Axiom Web
              </label>
            </div>
          </section>

          <section className="mt-auto border-t border-cyan-900/20 pt-4">
            <div className="p-3 bg-red-900/5 border border-red-900/20 rounded">
              <p className="text-[10px] text-red-400 font-bold uppercase mb-1">Critical Singularity</p>
              <p className="text-[10px] text-gray-400 leading-tight">AGI Target Function Formalization (Unresolved)</p>
            </div>
          </section>
        </aside>

        {/* Central 3D Canvas Mockup */}
        <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_#0a0f1a_0%,_#050505_100%)]">
          <Canvas camera={{ position: [0, 0, 25], fov: 60 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#06b6d4" />

            {/* Zone Bubbles */}
            {map.zones.map((zone) => {
              const pos = zonePositions[zone.id] || [0, 0, 0];
              const color = zoneColors[zone.id] || '#ffffff';
              return (
                <mesh key={zone.id} position={pos}>
                  <sphereGeometry args={[7, 32, 32]} />
                  <meshStandardMaterial 
                    color={color} 
                    transparent 
                    opacity={0.06} 
                    roughness={0.1}
                    metalness={0.2}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              );
            })}

            {edgesLines}

            {map.nodes.map(node => {
              const pos = nodePositions[node.id] || [0,0,0];
              const isSelected = selectedNode?.id === node.id;
              const isCore = node.type === 'core_singularity';
              return (
                <mesh
                  key={node.id}
                  position={pos}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                >
                  <sphereGeometry args={[isSelected ? (isCore ? 1.4 : 1.0) : (isCore ? 1.0 : 0.6), 32, 32]} />
                  <meshStandardMaterial
                    color={
                      node.state === 'resolved'
                        ? '#22c55e'
                        : node.state === 'partial'
                        ? '#eab308'
                        : '#ef4444'
                    }
                    roughness={0.2}
                    metalness={0.8}
                    emissive={isSelected ? '#22d3ee' : '#000000'}
                    emissiveIntensity={isSelected ? 0.5 : (isCore ? 0.2 : 0)}
                  />
                </mesh>
              );
            })}
          </Canvas>

          {/* Overlay: Node Detail */}
          {selectedNode && (
            <div className="absolute top-6 right-6 w-80 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-5 shadow-2xl pointer-events-auto">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-sm font-bold text-white leading-tight mb-1">{selectedNode.title}</h2>
                  <span className="text-[9px] font-mono text-cyan-400">ID: {selectedNode.id}</span>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="text-neutral-500 hover:text-white transition-colors ml-4 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="mb-4 flex items-center">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap shrink-0 ${
                  selectedNode.state === 'resolved' ? 'bg-green-900/50 text-green-400' : 
                  selectedNode.state === 'partial' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {selectedNode.state}
                </span>
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
                {selectedNode.description}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/5 p-2 rounded">
                  <span className="block text-[8px] text-gray-500 uppercase">Risk Loss</span>
                  <span className="text-xs font-mono text-red-400">${(selectedNode.economic.riskLoss / 1_000_000_000).toFixed(1)}B</span>
                </div>
                <div className="bg-white/5 p-2 rounded">
                  <span className="block text-[8px] text-gray-500 uppercase">Market Gain</span>
                  <span className="text-xs font-mono text-green-400">${(selectedNode.economic.marketGain / 1_000_000_000).toFixed(1)}B</span>
                </div>
              </div>

              <div className="mb-6">
                <span className="block text-[8px] text-gray-500 uppercase mb-2">Target Function</span>
                <code className="block text-[10px] bg-black p-2 rounded border border-gray-800 font-mono text-cyan-200">
                  {selectedNode.targetFunction}
                </code>
              </div>

              <button 
                onClick={() => handleSolve(selectedNode.id)}
                disabled={selectedNode.state === 'resolved'}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:shadow-none text-white font-bold text-xs uppercase tracking-widest transition-colors rounded shadow-[0_0_15px_rgba(8,145,178,0.3)] cursor-pointer disabled:cursor-not-allowed"
              >
                {selectedNode.state === 'resolved' ? 'Axiom Extracted' : 'Execute RICIS Solution'}
              </button>

              {selectedNode.state === 'resolved' && map.getLatexProof(selectedNode.id) && (
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <button 
                    onClick={() => setShowProof(!showProof)} 
                    className="w-full flex justify-between items-center text-cyan-400 text-xs font-bold uppercase tracking-wider hover:text-cyan-300"
                  >
                    <span>View Formal Proof (LaTeX)</span>
                    <span>{showProof ? '▲' : '▼'}</span>
                  </button>
                  {showProof && (
                    <div className="mt-3 bg-[#020202] p-3 rounded border border-cyan-900/50 text-gray-300 font-mono text-[9px] whitespace-pre-wrap max-h-48 overflow-y-auto shadow-inner">
                      {map.getLatexProof(selectedNode.id)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Floating Nav Overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 bg-black/60 backdrop-blur p-2 rounded-full border border-white/10 pointer-events-none">
            <div className="px-4 py-1.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold cursor-pointer pointer-events-auto">MOVE</div>
            <div className="px-4 py-1.5 rounded-full text-gray-400 text-[10px] font-bold cursor-pointer pointer-events-auto hover:bg-white/5 transition-colors">SCAN</div>
            <div className="px-4 py-1.5 rounded-full text-gray-400 text-[10px] font-bold cursor-pointer pointer-events-auto hover:bg-white/5 transition-colors">ANALYZE</div>
            <div className="px-4 py-1.5 rounded-full text-gray-400 text-[10px] font-bold cursor-pointer pointer-events-auto hover:bg-white/5 transition-colors">FRACTAL</div>
          </div>
        </div>
      </main>

      {/* Footer: Ticker */}
      <footer className="h-8 border-t border-cyan-900/30 bg-[#080808] flex items-center px-4 overflow-hidden shrink-0">
        <div className="flex whitespace-nowrap gap-8 text-[9px] font-mono text-cyan-900/60 uppercase tracking-tighter w-full animate-[marquee_20s_linear_infinite]">
          <span className="text-cyan-500/80">// RICIS-III BOOT SEQUENCE COMPLETED</span>
          <span>// WARNING: Derived node pharm-design-loop showing 82% risk increase</span>
          <span>// SYSTEM: RICIS-III core temperature stabilized at 32.4K</span>
          <span>// MARKET: Singularity economic impact revised to +4.2% global GDP</span>
          <span className="text-green-500/80">// L1 IDENTITY AXIOM ENFORCED ACROSS ALL ZONES</span>
          <span>// FRACTAL RESOLUTION: SP4 PROTOCOL ACTIVE</span>
        </div>
      </footer>
    </div>
  );
};

