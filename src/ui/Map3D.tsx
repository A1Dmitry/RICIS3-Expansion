import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { useMapStore } from '../store/mapStore';
import * as THREE from 'three';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { APP_BUILD_LABEL, APP_VERSION } from '../version';
import {
  isNodeAvailable,
  findPathToRicis,
  getUnlockRequirements,
  countAvailable,
  isRicisCore,
} from '../model/access';
import { layoutZones, layoutNodes, zoneVisualRadius, nodeVisualRadius } from '../model/physics';
import { ZoneBubble, NodeBubble, NodeLabel } from './Bubbles';
import { downloadTexPreprint, type TexBridgeMode } from '../model/texPreprint';

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
    controls.maxDistance = 160;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;
    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);
  useFrame(() => {
    controlsRef.current?.update();
  });
  return null;
}

export const Map3D: React.FC = () => {
  const map = useMapStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [pathNodeIds, setPathNodeIds] = useState<string[]>([]);
  const [agentMsg, setAgentMsg] = useState<string | null>(null);
  const [texMode, setTexMode] = useState<TexBridgeMode>('ricis_pure');
  const [texMsg, setTexMsg] = useState<string | null>(null);

  const selectedNode = map.nodes.find(n => n.id === selectedNodeId) || null;
  const availability = useMemo(() => countAvailable(map), [map.nodes, map.edges]);
  const pathSet = useMemo(() => new Set(pathNodeIds), [pathNodeIds]);
  const pathEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 0; i < pathNodeIds.length - 1; i++) {
      keys.add(pathNodeIds[i] + '|' + pathNodeIds[i + 1]);
      keys.add(pathNodeIds[i + 1] + '|' + pathNodeIds[i]);
    }
    return keys;
  }, [pathNodeIds]);

  useEffect(() => {
    setShowProof(false);
  }, [selectedNodeId]);

  const handleSolve = (id: string) => {
    const node = map.nodes.find(n => n.id === id);
    if (!node || !isNodeAvailable(node, map) || node.state === 'resolved') return;
    map.solveNode(id);
    setPathNodeIds([]);
  };

  const handleFindPathToRicis = () => {
    if (!selectedNodeId) return;
    setPathNodeIds(findPathToRicis(selectedNodeId, map));
  };

  const handleGenerateTex = () => {
    if (!selectedNodeId) {
      setTexMsg('Select a node on the map.');
      setTimeout(() => setTexMsg(null), 3000);
      return;
    }
    try {
      const r = downloadTexPreprint(map, selectedNodeId, { mode: texMode });
      setTexMsg('TEX: ' + r.filename + ' (' + r.nodeCount + ' nodes to root, mode ' + texMode + ')');
      setTimeout(() => setTexMsg(null), 8000);
    } catch (e) {
      setTexMsg('TEX generation error');
      setTimeout(() => setTexMsg(null), 4000);
    }
  };

  const handleAgentDiscovery = async () => {
    const added = await map.runAgentDiscovery(selectedNodeId || undefined);
    setAgentMsg(
      added > 0
        ? 'Агент добавил ' + added + ' новых проблем в граф.'
        : 'Агент не нашёл новых кандидатов.'
    );
    setTimeout(() => setAgentMsg(null), 4000);
  };

  const unlockReqs = useMemo(() => {
    if (!selectedNode || selectedNode.state === 'resolved') return [];
    if (isNodeAvailable(selectedNode, map)) return [];
    return getUnlockRequirements(selectedNode, map);
  }, [selectedNode, map.nodes]);

  const availableNodes = useMemo(
    () =>
      map.nodes.filter(
        n => n.state !== 'resolved' && isNodeAvailable(n, map)
      ),
    [map.nodes, map.edges]
  );

  const zonePositions = useMemo(
    () => layoutZones(map.zones, map.nodes),
    [map.zones, map.nodes]
  );

  const nodePositions = useMemo(
    () => layoutNodes(map, zonePositions),
    [map.nodes, map.edges, zonePositions]
  );

  const zoneRadii = useMemo(() => {
    const r: Record<string, number> = {};
    map.zones.forEach(z => {
      const members = map.nodes.filter(n => z.nodeIds.includes(n.id) || n.zoneIds.includes(z.id));
      const zPos = zonePositions[z.id];
      if (zPos && members.length > 0) {
        let maxDist = 0;
        members.forEach(m => {
          const mPos = nodePositions[m.id];
          if (mPos) {
            const dx = mPos[0] - zPos[0];
            const dy = mPos[1] - zPos[1];
            const dz = mPos[2] - zPos[2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            maxDist = Math.max(maxDist, dist + 15);
          }
        });
        r[z.id] = Math.max(zoneVisualRadius(z, map.nodes), maxDist);
      } else {
        r[z.id] = zoneVisualRadius(z, map.nodes);
      }
    });
    return r;
  }, [map.zones, map.nodes, zonePositions, nodePositions]);

  const nodeStateById = useMemo(() => {
    const m: Record<string, string> = {};
    map.nodes.forEach(n => {
      m[n.id] = n.state;
    });
    return m;
  }, [map.nodes]);

  const edgesLines = useMemo(() => {
    return map.edges.map(edge => {
      const fromPos = nodePositions[edge.fromId];
      const toPos = nodePositions[edge.toId];
      if (!fromPos || !toPos) return null;
      const onPath =
        pathEdgeKeys.has(edge.fromId + '|' + edge.toId) ||
        pathEdgeKeys.has(edge.toId + '|' + edge.fromId);
      const fromResolved = nodeStateById[edge.fromId] === 'resolved';
      const toResolved = nodeStateById[edge.toId] === 'resolved';
      let color = '#ef4444';
      let opacity = 0.3;
      if (onPath) {
        color = '#22d3ee';
        opacity = 1;
      } else if (fromResolved && toResolved) {
        color = '#22c55e';
        opacity = 0.95;
      } else if (fromResolved || toResolved) {
        color = '#eab308';
        opacity = 0.55;
      }
      const points = [new THREE.Vector3(...fromPos), new THREE.Vector3(...toPos)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return (
        <primitive
          key={edge.id}
          object={new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ color, opacity, transparent: true })
          )}
        />
      );
    });
  }, [map.edges, nodePositions, pathEdgeKeys, nodeStateById]);

  return (
    <div className="w-full h-screen bg-[#050505] text-[#e0e0e0] font-sans overflow-hidden flex flex-col">
      <header className="h-16 border-b border-cyan-900/30 bg-[#080808] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_cyan]" />
          <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
            RICIS-III // Singularity Map Core
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/50 text-cyan-300">
            {APP_BUILD_LABEL}
          </span>
        </div>
        <div className="flex gap-6 text-[10px] font-mono">
          <div className="flex flex-col"><span className="text-gray-500">NODES</span><span className="text-cyan-200">{map.nodes.length}</span></div>
          <div className="flex flex-col"><span className="text-gray-500">AVAILABLE</span><span className="text-emerald-400">{availability.available}</span></div>
          <div className="flex flex-col"><span className="text-gray-500">LOCKED</span><span className="text-gray-400">{availability.locked}</span></div>
          <div className="flex flex-col"><span className="text-gray-500">RESOLVED</span><span className="text-green-400">{availability.resolved}</span></div>
        </div>
      </header>

      <main className="flex-1 flex relative overflow-hidden">
        <aside className="w-64 border-r border-cyan-900/20 bg-[#070707] p-4 flex flex-col gap-5 shrink-0 z-10 overflow-y-auto">
          <section>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3">Science Zones</h3>
            <div className="space-y-2">
              {map.zones.map(zone => (
                <div key={zone.id} className="flex items-center justify-between p-2 bg-neutral-900/40 border border-neutral-800/50 rounded">
                  <span className="text-xs text-gray-300">{zone.name}</span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: zoneColors[zone.id] || '#fff' }} />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3">Доступно к решению ({availableNodes.length})</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {availableNodes.length === 0 && (<p className="text-[10px] text-gray-600">Нет открытых узлов.</p>)}
              {availableNodes.map(n => (
                <button key={n.id} type="button" onClick={() => setSelectedNodeId(n.id)}
                  className={'w-full text-left px-2 py-1.5 text-[11px] rounded border transition-colors ' + (selectedNodeId === n.id ? 'border-cyan-500/60 bg-cyan-950/50 text-cyan-200' : 'border-neutral-800 bg-neutral-900/40 text-gray-300 hover:border-cyan-800/50 hover:text-cyan-300')}>
                  <span className="block truncate font-medium">{n.title}</span>
                  <span className="block text-[9px] text-gray-500 font-mono truncate">{n.id}</span>
                </button>
              ))}
            </div>
            {selectedNode && selectedNode.state !== 'resolved' && isNodeAvailable(selectedNode, map) && (
              <button type="button" onClick={() => handleSolve(selectedNode.id)} className="mt-2 w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px] uppercase tracking-wider rounded">Execute RICIS Solution</button>
            )}
          </section>

          <section>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3">Persistence</h3>
            <div className="space-y-2">
              <button type="button" onClick={() => { void map.saveNow(); }} className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-cyan-800/50 bg-cyan-950/40 text-cyan-300">Сохранить в IndexedDB</button>
              <button type="button" onClick={() => map.downloadJson()} className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-neutral-700 text-gray-300">Скачать .json</button>
              <button type="button" onClick={() => { if (window.confirm('Сбросить карту?')) void map.resetMap(); }} className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-red-900/40 text-red-300">Сброс карты</button>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-3">ИИ-агент</h3>
            <button type="button" onClick={handleAgentDiscovery} className="w-full text-left px-2 py-1.5 text-[11px] rounded border border-violet-800/50 bg-violet-950/40 text-violet-300">Поиск новых проблем</button>
            <p className="text-[9px] text-gray-600 mt-1">Каталог остаток: {map.catalogRemaining()}.</p>
            {agentMsg && <p className="text-[10px] text-violet-300 mt-1">{agentMsg}</p>}
          </section>

          <p className="text-[9px] text-gray-600 mt-auto leading-snug">Зоны растут с числом узлов. Размер узла — значимость. Подписи — реальные названия.</p>
        </aside>

        <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_#0a0f1a_0%,_#050505_100%)]">
          <Canvas camera={{ position: [0, 0, 32], fov: 55 }} gl={{ antialias: true, alpha: true }}>
            <OrbitControls />
            <ambientLight intensity={0.22} />
            <hemisphereLight args={['#1e3a5f', '#050508', 0.55]} />
            <pointLight position={[18, 22, 14]} intensity={1.35} color="#e8f4ff" distance={80} />
            <pointLight position={[-16, -8, 12]} intensity={0.85} color="#67e8f9" distance={70} />
            <pointLight position={[8, -14, -18]} intensity={0.55} color="#a78bfa" distance={60} />
            <pointLight position={[0, 28, 0]} intensity={0.45} color="#ffffff" distance={90} />
            <spotLight position={[12, 30, 8]} angle={0.45} penumbra={0.6} intensity={0.7} color="#cffafe" />

            {map.zones.map(zone => {
              const pos = zonePositions[zone.id] || [0, 0, 0];
              const color = zoneColors[zone.id] || '#ffffff';
              const radius = zoneRadii[zone.id] || 5;
              return <ZoneBubble key={zone.id} position={pos} color={color} radius={radius} />;
            })}

            {edgesLines}

            {map.nodes.map(node => {
              const pos = nodePositions[node.id] || [0, 0, 0];
              const isSelected = selectedNode?.id === node.id;
              const isCore = isRicisCore(node);
              const available = isNodeAvailable(node, map);
              const onPath = pathSet.has(node.id);
              const locked = !available && node.state !== 'resolved';

              let color = '#ef4444';
              if (node.state === 'resolved') color = '#22c55e';
              else if (locked) color = '#6b7280';
              else if (node.state === 'partial') color = '#eab308';
              if (onPath) color = locked ? '#94a3b8' : '#22d3ee';

              const baseR = nodeVisualRadius(node, map.nodes);
              const radius = isSelected ? baseR * 1.28 : onPath ? baseR * 1.12 : baseR;
              const emissive = isSelected ? '#22d3ee' : onPath ? '#0891b2' : isCore ? '#155e75' : color;
              const emissiveIntensity = isSelected ? 0.65 : onPath ? 0.45 : isCore ? 0.35 : locked ? 0.08 : 0.22;

              return (
                <group key={node.id}>
                  <NodeBubble
                    position={pos}
                    color={color}
                    radius={radius}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                    opacity={locked ? 0.5 : 0.92}
                    locked={locked}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                  />
                  <NodeLabel
                    position={pos}
                    text={node.title}
                    subtitle={map.zones.find(z => z.id === node.zoneIds[0])?.name || node.zoneIds[0]}
                    offsetY={radius + 0.35}
                  />
                </group>
              );
            })}
          </Canvas>

          {selectedNode && (
            <div className="absolute top-6 right-6 w-80 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-5 shadow-2xl pointer-events-auto max-h-[90%] overflow-y-auto">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-sm font-bold text-white leading-tight mb-1">{selectedNode.title}</h2>
                  <span className="text-[9px] font-mono text-cyan-400">ID: {selectedNode.id}</span>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="text-neutral-500 hover:text-white ml-3">✕</button>
              </div>
              <div className="mb-3 flex gap-2 flex-wrap">
                <span className={'px-2 py-0.5 rounded text-[9px] font-bold uppercase ' + (selectedNode.state === 'resolved' ? 'bg-green-900/50 text-green-400' : selectedNode.state === 'partial' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400')}>{selectedNode.state}</span>
                {!isNodeAvailable(selectedNode, map) && selectedNode.state !== 'resolved' && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-800 text-gray-400 border border-gray-700">LOCKED</span>
                )}
                {isRicisCore(selectedNode) && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-900/50 text-cyan-300 border border-cyan-700/40">RICIS CORE</span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-3">{selectedNode.description}</p>
              <div className="mb-3 space-y-2">
                <div className="flex gap-2">
                  <button type="button" onClick={handleFindPathToRicis} className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded border border-cyan-700/50 bg-cyan-950/50 text-cyan-300">Путь к RICIS</button>
                  {pathNodeIds.length > 0 && (
                    <button type="button" onClick={() => setPathNodeIds([])} className="px-2 py-2 text-[10px] rounded border border-neutral-700 text-gray-400">Сброс</button>
                  )}
                </div>
                {pathNodeIds.length > 0 && (
                  <div className="text-[10px] text-cyan-400/90 font-mono bg-cyan-950/20 border border-cyan-900/40 rounded p-2 max-h-24 overflow-y-auto">
                    {pathNodeIds.map(id => map.nodes.find(n => n.id === id)?.title || id).join(' → ')}
                  </div>
                )}
                {unlockReqs.length > 0 && (
                  <div className="bg-gray-900/60 border border-gray-700/50 rounded p-2">
                    <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Чтобы открыть — решите:</p>
                    <ul className="space-y-1 max-h-28 overflow-y-auto">
                      {unlockReqs.map(n => (
                        <li key={n.id} className="text-[10px] text-gray-300">
                          <button type="button" className="text-left hover:text-cyan-300" onClick={() => setSelectedNodeId(n.id)}>● {n.title}</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <code className="block text-[10px] bg-black p-2 rounded border border-gray-800 font-mono text-cyan-200 mb-3">{selectedNode.targetFunction}</code>
              <div className="mb-3 border border-amber-900/40 rounded p-2 bg-amber-950/20 space-y-1.5">
                <p className="text-[9px] font-bold uppercase text-amber-400/90 tracking-wider">Препринт TEX</p>
                <p className="text-[9px] text-gray-500 leading-snug">
                  Развёртка до корня графа (зависимости + рёбра). Два режима мостов.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="flex items-start gap-2 text-[10px] text-gray-300 cursor-pointer">
                    <input type="radio" name="texMode" checked={texMode === 'ricis_pure'} onChange={() => setTexMode('ricis_pure')} className="mt-0.5" />
                    <span><span className="text-cyan-300 font-semibold">RICIS-pure</span> — без классических lim / L'Hôpital</span>
                  </label>
                  <label className="flex items-start gap-2 text-[10px] text-gray-300 cursor-pointer">
                    <input type="radio" name="texMode" checked={texMode === 'classical_bridges'} onChange={() => setTexMode('classical_bridges')} className="mt-0.5" />
                    <span><span className="text-amber-300 font-semibold">Classical bridges</span> — классика как мост + re-index RICIS</span>
                  </label>
                </div>
                <button type="button" onClick={handleGenerateTex} className="w-full py-2 text-[10px] font-bold uppercase tracking-wider rounded border border-amber-700/50 bg-amber-950/50 text-amber-200 hover:bg-amber-900/40">
                  Генерировать TEX
                </button>
                {texMsg && <p className="text-[9px] text-amber-300/90 font-mono break-all">{texMsg}</p>}
              </div>
              <button
                onClick={() => handleSolve(selectedNode.id)}
                disabled={selectedNode.state === 'resolved' || !isNodeAvailable(selectedNode, map)}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold text-xs uppercase tracking-widest rounded"
              >
                {selectedNode.state === 'resolved' ? 'Axiom Extracted' : !isNodeAvailable(selectedNode, map) ? 'Заблокировано зависимостями' : 'Execute RICIS Solution'}
              </button>
              {selectedNode.state === 'resolved' && map.getLatexProof(selectedNode.id) && (
                <div className="mt-4 border-t border-gray-800 pt-3">
                  <button onClick={() => setShowProof(!showProof)} className="w-full flex justify-between text-cyan-400 text-xs font-bold uppercase">
                    <span>View Formal Proof</span><span>{showProof ? '▲' : '▼'}</span>
                  </button>
                  {showProof && (
                    <div className="mt-2 bg-[#020202] p-3 rounded border border-cyan-900/50 text-gray-300 font-mono text-[9px] whitespace-pre-wrap max-h-40 overflow-y-auto">{map.getLatexProof(selectedNode.id)}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="h-8 border-t border-cyan-900/30 bg-[#080808] flex items-center px-4 shrink-0">
        <div className="flex gap-6 text-[9px] font-mono text-cyan-900/70 uppercase">
          <span className="text-cyan-400/90">// {APP_BUILD_LABEL}</span>
          <span>// ZONES GROW BY NODE COUNT · NODE SIZE = SIGNIFICANCE</span>
          <span>// EDGE GREEN = BOTH ENDS RESOLVED</span>
          <span className="text-cyan-500/80">// LABELS = REAL PROBLEM TITLES</span>
        </div>
      </footer>
    </div>
  );
};
