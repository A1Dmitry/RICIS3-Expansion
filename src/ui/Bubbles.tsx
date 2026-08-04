import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Пузырь зоны: fresnel-ободок, полупрозрачная плёнка, лёгкий пульс. */
export function ZoneBubble({
  position,
  color,
  radius,
}: {
  position: [number, number, number];
  color: string;
  radius: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const currentR = useRef(radius);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uOpacity: { value: 0.28 },
      uGlow: { value: 1.35 },
    }),
    [color]
  );

  useFrame((_, delta) => {
    currentR.current += (radius - currentR.current) * Math.min(1, delta * 2.8);
    if (meshRef.current) meshRef.current.scale.setScalar(currentR.current);
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={radius}
      // Зоны не должны перехватывать клики по узлам
      raycast={() => null}
    >
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uTime;
          uniform float uOpacity;
          uniform float uGlow;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float ndotv = max(dot(vNormal, vView), 0.0);
            float fresnel = pow(1.0 - ndotv, 2.6);
            float pulse = 0.9 + 0.1 * sin(uTime * 1.1);
            float irid = 0.18 * sin(uTime * 0.65 + fresnel * 10.0);
            vec3 film = uColor * (0.5 + irid) + vec3(0.2, 0.28, 0.35) * fresnel;
            float rim = fresnel * uGlow * pulse;
            float core = 0.03 + 0.06 * fresnel;
            vec3 col = film * (core + rim * 1.4);
            float alpha = clamp(uOpacity * (0.18 + fresnel * 1.85) * pulse, 0.0, 0.92);
            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
}

/** Подпись рядом с узлом (billboard sprite, без дополнительных зависимостей). */
export function NodeLabel({
  position,
  text,
  subtitle,
  valueText,
  offsetY = 0.55,
}: {
  position: [number, number, number];
  text: string;
  subtitle?: string;
  valueText?: string;
  offsetY?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    // Increase canvas size to accommodate 3x larger text
    const w = 2048;
    const h = subtitle || valueText ? 512 : 384;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.clearRect(0, 0, w, h);
    
    // 3x larger text (from 52px to 156px)
    ctx.font = 'bold 156px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const label = text.length > 42 ? text.slice(0, 40) + '…' : text;
    const sub = subtitle ? (subtitle.length > 50 ? subtitle.slice(0, 48) + '…' : subtitle) : '';
    const val = valueText ? valueText : '';
    
    const metrics1 = ctx.measureText(label);
    
    ctx.font = 'normal 72px Inter, system-ui, sans-serif';
    const metrics2 = sub ? ctx.measureText(sub) : { width: 0 };
    
    ctx.font = 'bold 84px Inter, system-ui, sans-serif';
    const metrics3 = val ? ctx.measureText(val) : { width: 0 };
    
    const padX = 96;
    const boxW = Math.min(w - 16, Math.max(metrics1.width, metrics2.width, metrics3.width) + padX * 2);
    let boxH = 200;
    if (sub) boxH += 80;
    if (val) boxH += 100;
    
    const bx = (w - boxW) / 2;
    const by = (h - boxH) / 2;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
    ctx.lineWidth = 8;
    const r = 32;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r);
    ctx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r);
    ctx.arcTo(bx, by + boxH, bx, by, r);
    ctx.arcTo(bx, by, bx + boxW, by, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    let currentY = by + 100;
    
    ctx.font = 'bold 144px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText(label, w / 2, currentY);
    
    if (sub) {
      currentY += 100;
      ctx.font = 'normal 72px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8'; // text-slate-400
      ctx.fillText(sub, w / 2, currentY);
    }
    
    if (val) {
      currentY += 100;
      ctx.font = 'bold 84px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#4ade80'; // green-400 for value
      ctx.fillText(val, w / 2, currentY);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, subtitle, valueText]);

  return (
    <sprite position={[position[0], position[1] + offsetY, position[2]]} scale={[15.6, (subtitle || valueText) ? 3.9 : 2.925, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}

/** Узел-пузырь: блик, fresnel, мягкое свечение ядра. */
export function NodeBubble({
  position,
  color,
  radius,
  emissive,
  emissiveIntensity,
  opacity,
  locked,
  onClick,
}: {
  position: [number, number, number];
  color: string;
  radius: number;
  emissive: string;
  emissiveIntensity: number;
  opacity: number;
  locked: boolean;
  onClick: (e: any) => void;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uEmissive: { value: new THREE.Color(emissive) },
      uEmissiveIntensity: { value: emissiveIntensity },
      uOpacity: { value: opacity },
      uLocked: { value: locked ? 1.0 : 0.0 },
      uTime: { value: 0 },
    }),
    [color, emissive, emissiveIntensity, opacity, locked]
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      matRef.current.uniforms.uColor.value.set(color);
      matRef.current.uniforms.uEmissive.value.set(emissive);
      matRef.current.uniforms.uEmissiveIntensity.value = emissiveIntensity;
      matRef.current.uniforms.uOpacity.value = opacity;
      matRef.current.uniforms.uLocked.value = locked ? 1.0 : 0.0;
    }
  });

  return (
    <mesh
      position={position}
      onClick={onClick}
      onPointerDown={e => {
        e.stopPropagation();
        onClick(e);
      }}
      onPointerOver={e => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <sphereGeometry args={[radius, 48, 48]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={!locked}
        side={THREE.FrontSide}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vView;
          varying vec3 vWorld;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = normalize(-mv.xyz);
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform vec3 uEmissive;
          uniform float uEmissiveIntensity;
          uniform float uOpacity;
          uniform float uLocked;
          uniform float uTime;
          varying vec3 vNormal;
          varying vec3 vView;
          varying vec3 vWorld;
          void main() {
            float ndotv = max(dot(vNormal, vView), 0.0);
            float fresnel = pow(1.0 - ndotv, 3.0);
            vec3 lightDir = normalize(vec3(0.45, 0.75, 0.4));
            float spec = pow(max(dot(reflect(-lightDir, vNormal), vView), 0.0), 48.0);
            float pulse = 0.92 + 0.08 * sin(uTime * 1.6 + vWorld.x * 0.3);
            vec3 base = uColor * (0.35 + 0.45 * ndotv);
            vec3 rim = uColor * fresnel * 1.6 + vec3(0.55, 0.75, 0.95) * fresnel * 0.45;
            vec3 glow = uEmissive * uEmissiveIntensity * (0.4 + fresnel * 0.8);
            vec3 col = (base + rim + glow + vec3(spec * 0.85)) * pulse;
            col = mix(col, col * 0.45 + vec3(0.12), uLocked);
            float alpha = mix(uOpacity * (0.72 + fresnel * 0.28), uOpacity * 0.5, uLocked);
            gl_FragColor = vec4(col, clamp(alpha, 0.15, 1.0));
          }
        `}
      />
    </mesh>
  );
}
