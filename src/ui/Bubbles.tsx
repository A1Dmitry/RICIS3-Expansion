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
    <mesh ref={meshRef} position={position} scale={radius}>
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
    <mesh position={position} onClick={onClick}>
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
