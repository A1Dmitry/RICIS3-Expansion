import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AddNodeModal } from './AddNodeModal';
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
import { downloadTexPreprint, type TexBridgeMode, expandToRoot } from '../model/texPreprint';
import { AuditPanel } from './AuditPanel';
import { isMissingTargetFunction } from '../model/audit';

export const Map3D: React.FC = () => {
  return (
    <div className="w-full h-screen bg-[#050505] text-[#e0e0e0] flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <p className="text-amber-300 text-sm mb-2">Map3D temporarily reduced while restoring full UI.</p>
        <p className="text-gray-400 text-xs mb-4">Core audit tools:</p>
        <AuditPanel />
        <p className="text-gray-600 text-[10px] mt-4">APP {APP_BUILD_LABEL} · refresh after next restore commit</p>
      </div>
    </div>
  );
};
