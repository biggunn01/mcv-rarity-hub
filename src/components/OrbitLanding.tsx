"use client";

import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import type { CollectionSummary } from "@/lib/types";

const badgeMap: Record<string, string> = {
  "mars-cats-voyage": "/collection-badges/mars-cats-voyage.png",
  "mars-alien-cats": "/collection-badges/mars-alien-cats.png",
  "mars-cats-in-spacesuits": "/collection-badges/mars-cats-in-spacesuits.png",
  "mars-cats-snipers": "/collection-badges/mars-cats-snipers.png",
  metazoku: "/collection-badges/metazoku.png",
  "battle-pawss": "/collection-badges/battle-pawss.png",
  "cream-cats": "/collection-badges/cream-cats.png",
};

const planetThemeMap: Record<string, { color: number; accent: string; accentRgb: string }> = {
  "mars-cats-voyage": { color: 0xffa34a, accent: "#ff9a32", accentRgb: "255, 154, 50" },
  "mars-alien-cats": { color: 0x75e6ff, accent: "#75e6ff", accentRgb: "117, 230, 255" },
  "mars-cats-in-spacesuits": { color: 0x9bdcff, accent: "#9bdcff", accentRgb: "155, 220, 255" },
  "mars-cats-snipers": { color: 0x8dff9f, accent: "#8dff9f", accentRgb: "141, 255, 159" },
  metazoku: { color: 0xc8ff2f, accent: "#c8ff2f", accentRgb: "200, 255, 47" },
  "battle-pawss": { color: 0x1ef9d8, accent: "#1ef9d8", accentRgb: "30, 249, 216" },
  "cream-cats": { color: 0xf4cf7a, accent: "#f4cf7a", accentRgb: "244, 207, 122" },
};

type PlanetArchetype = {
  band: number;
  warp: number;
  crack: number;
  cap: number;
  noiseScale: number;
  deep?: number;
  highMix?: number;
  ring?: { inner: number; outer: number; tilt: number; opacity: number };
};

const planetArchetypes: Record<string, PlanetArchetype> = {
  "mars-alien-cats": { band: 0.82, warp: 0.75, crack: 0, cap: 0, noiseScale: 2.1 },
  "mars-cats-in-spacesuits": { band: 0.14, warp: 0.4, crack: 0, cap: 0.95, noiseScale: 2.7, highMix: 0.72 },
  "mars-cats-snipers": { band: 0.55, warp: 1.0, crack: 0, cap: 0.18, noiseScale: 2.3, ring: { inner: 1.55, outer: 1.95, tilt: -0.44, opacity: 0.22 } },
  metazoku: { band: 0, warp: 0.55, crack: 1, cap: 0, noiseScale: 3.1, deep: 0x090c07 },
  "battle-pawss": { band: 0.28, warp: 1.5, crack: 0, cap: 0, noiseScale: 2.4 },
  "cream-cats": { band: 0.68, warp: 0.35, crack: 0, cap: 0, noiseScale: 2.0, ring: { inner: 1.5, outer: 2.15, tilt: -0.37, opacity: 0.36 } },
};

const defaultArchetype: PlanetArchetype = { band: 0.4, warp: 0.7, crack: 0, cap: 0, noiseScale: 2.4 };

type Props = {
  collections: CollectionSummary[];
  chainCount: number;
};

type PlanetConfig = {
  entry: CollectionSummary;
  slug: string;
  name: string;
  route: string;
  radius: number;
  orbitRadius: number;
  orbitHeight: number;
  orbitDepth: number;
  phase: number;
  orbitSpeed: number;
  spinSpeed: number;
  accent: string;
  accentRgb: string;
  color: number;
};

type TrailRuntime = {
  line: THREE.Line;
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
};

type PlanetRuntime = {
  config: PlanetConfig;
  group: THREE.Group;
  sphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  trail: TrailRuntime;
  angle: number;
  hover: number;
  label: HTMLButtonElement | null;
};

type ActivePlanet = {
  slug: string;
  name: string;
  route: string;
  x: number;
  y: number;
  depth: number;
  accent: string;
};

type TransitionOverlay = {
  name: string;
  accent: string;
  phase: "approach" | "hold" | "explode";
};

type TransitionParticle = {
  sprite: THREE.Sprite;
  direction: THREE.Vector3;
  speed: number;
  size: number;
};

type TransitionTargetConfig = Pick<PlanetConfig, "slug" | "name" | "route" | "spinSpeed" | "accent" | "color">;

type LandingTransition = {
  config: TransitionTargetConfig;
  runtime?: PlanetRuntime;
  group: THREE.Group;
  sphere: THREE.Mesh;
  atmosphere?: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  route: string;
  startTime: number;
  fromPosition: THREE.Vector3;
  fromScale: number;
  targetScale: number;
  particles: TransitionParticle[];
  hasExploded: boolean;
  hasNavigated: boolean;
  timeScale: number;
};

const orbitPresets = [
  { orbitRadius: 3.38, orbitHeight: 0.82, orbitDepth: 1.56, phase: 2.55, orbitSpeed: 0.1, radius: 0.38, spinSpeed: 0.28 },
  { orbitRadius: 4.36, orbitHeight: 1.02, orbitDepth: 1.98, phase: 5.05, orbitSpeed: 0.08, radius: 0.35, spinSpeed: 0.24 },
  { orbitRadius: 5.32, orbitHeight: 1.34, orbitDepth: 2.36, phase: 3.35, orbitSpeed: 0.066, radius: 0.37, spinSpeed: 0.22 },
  { orbitRadius: 6.28, orbitHeight: 1.52, orbitDepth: 2.74, phase: 0.2, orbitSpeed: 0.055, radius: 0.41, spinSpeed: 0.2 },
  { orbitRadius: 4.92, orbitHeight: 1.92, orbitDepth: 2.98, phase: 1.35, orbitSpeed: 0.048, radius: 0.36, spinSpeed: 0.17 },
  { orbitRadius: 6.82, orbitHeight: 2.16, orbitDepth: 3.44, phase: 4.45, orbitSpeed: 0.043, radius: 0.38, spinSpeed: 0.15 },
];

const ORBIT_TILT_X = -0.42;
const ORBIT_TILT_Z = -0.1;
const BODY_FACE_TILT_X = -0.58;
const BODY_FACE_TILT_Z = -0.04;
const ORBIT_VARIANCE = [
  { x: -0.05, y: -0.07, z: -0.02 },
  { x: -0.12, y: 0.03, z: 0.08 },
  { x: 0.02, y: -0.04, z: -0.11 },
  { x: -0.18, y: 0.05, z: 0.13 },
  { x: 0.08, y: -0.08, z: -0.16 },
  { x: -0.24, y: 0.02, z: 0.19 },
];
const TRANSITION_APPROACH_SECONDS = 0.53;
const TRANSITION_EXPLODE_SECONDS = 2.03;
const TRANSITION_NAV_SECONDS = 2.44;
const TRANSITION_EXPLOSION_SECONDS = 0.41;
const TRAIL_POINTS = 72;
const TRAIL_SPAN = 1.05;

const NOISE_GLSL = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i += 1) {
      value += amplitude * vnoise(p);
      p = p * 2.03 + vec3(11.7);
      amplitude *= 0.5;
    }
    return value;
  }
`;

const BODY_VERTEX_GLSL = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  void main() {
    vObj = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = cameraPosition - worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const PLANET_FRAGMENT_GLSL = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform float uHover;
  uniform float uBand;
  uniform float uWarp;
  uniform float uCrack;
  uniform float uCap;
  uniform float uNoiseScale;

  __NOISE__

  void main() {
    vec3 p = normalize(vObj);
    vec3 q = p * uNoiseScale;
    float drift = uTime * 0.016;
    vec3 warpVec = vec3(
      fbm(q + vec3(0.0, drift, 0.0)),
      fbm(q + vec3(5.2, 1.3, drift * 0.8)),
      0.0
    );
    float field = fbm(q + uWarp * warpVec);
    float bands = 0.5 + 0.5 * sin(p.y * 7.5 + field * 4.2);
    float tex = mix(field, bands, uBand);

    vec3 col = mix(uDeep, uMid, smoothstep(0.18, 0.62, tex));
    col = mix(col, uHigh, smoothstep(0.62, 0.95, tex));

    float ridge = 1.0 - abs(2.0 * fbm(q * 1.7 + vec3(3.1)) - 1.0);
    float crackGlow = pow(smoothstep(0.78, 1.0, ridge), 2.0) * (0.62 + 0.38 * sin(uTime * 1.35 + p.x * 4.0));
    col += uHigh * uCrack * crackGlow;

    float capMask = uCap * smoothstep(0.62, 0.86, abs(p.y)) * (0.62 + 0.38 * field);
    col = mix(col, mix(uHigh, vec3(1.0), 0.55), capMask);

    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewW);
    float diffuse = dot(N, normalize(uSunDir));
    float light = smoothstep(-0.5, 0.45, diffuse);
    col *= 0.26 + 0.92 * light;

    float fresnel = pow(1.0 - max(dot(V, N), 0.0), 2.6);
    col += uMid * fresnel * (0.42 + uHover * 0.9);
    col += uHigh * pow(max(diffuse, 0.0), 3.0) * 0.1;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT_GLSL = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uIntensity;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewW);
    float rim = pow(1.0 - abs(dot(V, N)), 3.4);
    float dayBoost = 0.4 + 0.6 * smoothstep(-0.5, 0.6, dot(N, normalize(uSunDir)));
    gl_FragColor = vec4(uColor, rim * dayBoost * uIntensity);
  }
`;

const RING_VERTEX_GLSL = /* glsl */ `
  varying vec2 vRingPos;

  void main() {
    vRingPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT_GLSL = /* glsl */ `
  varying vec2 vRingPos;

  uniform vec3 uColor;
  uniform float uInner;
  uniform float uOuter;
  uniform float uOpacity;

  void main() {
    float radius = length(vRingPos);
    float t = (radius - uInner) / (uOuter - uInner);
    if (t < 0.0 || t > 1.0) discard;
    float grain = 0.82 + 0.18 * sin(t * 18.0);
    float gap = 1.0 - 0.85 * smoothstep(0.52, 0.56, t) * (1.0 - smoothstep(0.64, 0.68, t));
    float soft = smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.78, 1.0, t));
    gl_FragColor = vec4(uColor, grain * gap * soft * uOpacity);
  }
`;

const SUN_FRAGMENT_GLSL = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  uniform float uTime;
  uniform vec3 uEmber;
  uniform vec3 uFlame;
  uniform vec3 uGold;
  uniform vec3 uCore;

  __NOISE__

  void main() {
    vec3 p = normalize(vObj) * 2.6;
    float t = uTime * 0.055;
    vec3 flow = vec3(t, -t * 0.7, t * 0.4);
    float churn = fbm(p + flow + 1.4 * vec3(fbm(p * 1.6 + vec3(0.0, t * 1.3, 0.0))));
    float granulation = fbm(p * 6.5 - vec3(0.0, 0.0, t * 2.0));
    float heat = clamp(churn * 0.92 + granulation * 0.5 - 0.16, 0.0, 1.0);

    vec3 col = mix(uEmber, uFlame, smoothstep(0.05, 0.52, heat));
    col = mix(col, uGold, smoothstep(0.52, 0.78, heat));
    col = mix(col, uCore, smoothstep(0.78, 0.97, heat));

    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewW);
    float limb = pow(max(dot(V, N), 0.0), 0.6);
    col *= 0.55 + 0.45 * limb;
    float rim = pow(1.0 - max(dot(V, N), 0.0), 3.0);
    col += uFlame * rim * 0.9;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function withNoise(shader: string) {
  return shader.replace("__NOISE__", NOISE_GLSL);
}

export function OrbitLanding({ collections, chainCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeRef = useRef<string | null>(null);
  const launchTransitionRef = useRef<(slug: string) => void>(() => {});
  const transitionTimersRef = useRef<number[]>([]);
  const [activePlanet, setActivePlanet] = useState<ActivePlanet | null>(null);
  const [transitionOverlay, setTransitionOverlay] = useState<TransitionOverlay | null>(null);

  const center = collections.find((entry) => entry.collection.slug === "mars-cats-voyage");
  const planets = useMemo<PlanetConfig[]>(
    () =>
      collections
        .filter((entry) => entry.collection.slug !== "mars-cats-voyage")
        .map((entry, index) => {
          const slug = entry.collection.slug;
          const theme = planetThemeMap[slug] ?? { color: 0xffffff, accent: "#ffffff", accentRgb: "255, 255, 255" };
          const preset = orbitPresets[index % orbitPresets.length];
          return {
            entry,
            slug,
            name: entry.collection.name,
            route: `/collections/${slug}`,
            ...preset,
            ...theme,
          };
        }),
    [collections],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || !center) return;
    const canvasElement = canvas;
    const stageElement = stage;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03050d, 0.035);

    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 80);
    camera.position.set(0, 8.1, 9.9);
    camera.lookAt(0, 0, 0);

    const runtimePlanets: PlanetRuntime[] = [];
    const sunGroup = new THREE.Group();
    sunGroup.rotation.x = BODY_FACE_TILT_X;
    sunGroup.rotation.z = BODY_FACE_TILT_Z;
    scene.add(sunGroup);

    function accentPalette(config: PlanetConfig, archetype: PlanetArchetype) {
      const accent = new THREE.Color(config.color);
      const deep =
        archetype.deep !== undefined
          ? new THREE.Color(archetype.deep)
          : accent.clone().multiplyScalar(0.16).lerp(new THREE.Color(0x040711), 0.55);
      const mid = accent.clone().multiplyScalar(0.86);
      const high = accent.clone().lerp(new THREE.Color(0xffffff), archetype.highMix ?? 0.5);
      return { deep, mid, high };
    }

    function makePlanetMaterial(config: PlanetConfig, archetype: PlanetArchetype) {
      const palette = accentPalette(config, archetype);
      return new THREE.ShaderMaterial({
        vertexShader: BODY_VERTEX_GLSL,
        fragmentShader: withNoise(PLANET_FRAGMENT_GLSL),
        uniforms: {
          uDeep: { value: palette.deep },
          uMid: { value: palette.mid },
          uHigh: { value: palette.high },
          uSunDir: { value: new THREE.Vector3(0, 0, 1) },
          uTime: { value: 0 },
          uHover: { value: 0 },
          uBand: { value: archetype.band },
          uWarp: { value: archetype.warp },
          uCrack: { value: archetype.crack },
          uCap: { value: archetype.cap },
          uNoiseScale: { value: archetype.noiseScale },
        },
      });
    }

    function makeAtmosphereMesh(config: PlanetConfig) {
      const accent = new THREE.Color(config.color);
      const material = new THREE.ShaderMaterial({
        vertexShader: BODY_VERTEX_GLSL,
        fragmentShader: ATMOSPHERE_FRAGMENT_GLSL,
        uniforms: {
          uColor: { value: accent.clone().lerp(new THREE.Color(0xffffff), 0.2) },
          uSunDir: { value: new THREE.Vector3(0, 0, 1) },
          uIntensity: { value: 0.5 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(config.radius * 1.24, 32, 32), material);
      mesh.renderOrder = 4;
      return mesh;
    }

    function makeRingMesh(config: PlanetConfig, archetype: PlanetArchetype) {
      if (!archetype.ring) return null;
      const inner = config.radius * archetype.ring.inner;
      const outer = config.radius * archetype.ring.outer;
      const material = new THREE.ShaderMaterial({
        vertexShader: RING_VERTEX_GLSL,
        fragmentShader: RING_FRAGMENT_GLSL,
        uniforms: {
          uColor: { value: new THREE.Color(config.color).lerp(new THREE.Color(0xffffff), 0.35) },
          uInner: { value: inner },
          uOuter: { value: outer },
          uOpacity: { value: archetype.ring.opacity },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96, 1), material);
      mesh.rotation.x = Math.PI / 2 + archetype.ring.tilt;
      mesh.rotation.y = 0.16;
      mesh.renderOrder = 5;
      return mesh;
    }

    const sunMaterial = new THREE.ShaderMaterial({
      vertexShader: BODY_VERTEX_GLSL,
      fragmentShader: withNoise(SUN_FRAGMENT_GLSL),
      uniforms: {
        uTime: { value: 0 },
        uEmber: { value: new THREE.Color(0x461003) },
        uFlame: { value: new THREE.Color(0xff5c08) },
        uGold: { value: new THREE.Color(0xffb347) },
        uCore: { value: new THREE.Color(0xfff3d6) },
      },
    });

    function makeSunGlowTexture() {
      const size = 512;
      const canvasTexture = document.createElement("canvas");
      canvasTexture.width = size;
      canvasTexture.height = size;
      const context = canvasTexture.getContext("2d");
      if (!context) return null;

      const gradient = context.createRadialGradient(size * 0.5, size * 0.5, size * 0.08, size * 0.5, size * 0.5, size * 0.5);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.42)");
      gradient.addColorStop(0.36, "rgba(255, 255, 255, 0.22)");
      gradient.addColorStop(0.68, "rgba(255, 255, 255, 0.08)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);

      const texture = new THREE.CanvasTexture(canvasTexture);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    function makeSunParticleTexture() {
      const size = 64;
      const canvasTexture = document.createElement("canvas");
      canvasTexture.width = size;
      canvasTexture.height = size;
      const context = canvasTexture.getContext("2d");
      if (!context) return null;

      const gradient = context.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.5);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.42, "rgba(255, 255, 255, 0.62)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);

      const texture = new THREE.CanvasTexture(canvasTexture);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const sunRadius = 1.3125;
    const sun = new THREE.Mesh(new THREE.SphereGeometry(sunRadius, 64, 64), sunMaterial);
    sun.renderOrder = 2;
    sunGroup.add(sun);

    const sunGlowTexture = makeSunGlowTexture();
    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunGlowTexture,
        color: 0xffa844,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    sunGlow.scale.set(3.75, 3.75, 1);
    sunGlow.position.set(0, 0, -0.08);
    sunGlow.renderOrder = -4;
    scene.add(sunGlow);

    const sunParticleTexture = makeSunParticleTexture();
    const sunParticles = Array.from({ length: 26 }, (_, index) => {
      const angle = index * 2.39996;
      const lift = Math.sin(index * 1.73) * 0.46;
      const direction = new THREE.Vector3(Math.cos(angle), lift, Math.sin(angle) * 0.34).normalize();
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: sunParticleTexture,
          color: 0xffc76a,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      sprite.renderOrder = 3;
      scene.add(sprite);
      return {
        sprite,
        direction,
        phase: (index / 26) * Math.PI * 2,
        speed: 0.34 + (index % 7) * 0.045,
        size: 0.045 + (index % 5) * 0.012,
      };
    });

    let landingTransition: LandingTransition | null = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitTargets: THREE.Object3D[] = [];
    const centerTransitionConfig: TransitionTargetConfig = {
      slug: center.collection.slug,
      name: center.collection.name,
      route: `/collections/${center.collection.slug}`,
      spinSpeed: 0.28,
      accent: planetThemeMap["mars-cats-voyage"].accent,
      color: planetThemeMap["mars-cats-voyage"].color,
    };
    sun.userData = centerTransitionConfig;
    hitTargets.push(sun);

    function clearTransitionTimers() {
      transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      transitionTimersRef.current = [];
    }

    function scheduleTransitionStep(delay: number, callback: () => void) {
      const timer = window.setTimeout(callback, delay);
      transitionTimersRef.current.push(timer);
    }

    function easeOutCubic(value: number) {
      return 1 - Math.pow(1 - value, 3);
    }

    function easeInOutCubic(value: number) {
      return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
    }

    function createExplosionParticles(config: TransitionTargetConfig, origin: THREE.Vector3): TransitionParticle[] {
      const particleTexture = sunParticleTexture ?? makeSunParticleTexture();
      return Array.from({ length: 74 }, (_, index) => {
        const angle = index * 2.399963229728653;
        const vertical = Math.sin(index * 1.618) * 0.82;
        const spread = 0.82 + (index % 9) * 0.035;
        const direction = new THREE.Vector3(Math.cos(angle) * spread, vertical, Math.sin(angle) * spread).normalize();
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: particleTexture,
            color: new THREE.Color(config.color),
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        sprite.position.copy(origin);
        sprite.renderOrder = 18;
        scene.add(sprite);
        return {
          sprite,
          direction,
          speed: 2.15 + (index % 11) * 0.18,
          size: 0.07 + (index % 6) * 0.018,
        };
      });
    }

    function removeExplosionParticles(particles: TransitionParticle[]) {
      particles.forEach((particle) => {
        scene.remove(particle.sprite);
        particle.sprite.material.dispose();
      });
    }

    function orbitPoint(config: PlanetConfig, index: number, angle: number) {
      const point = new THREE.Vector3(
        Math.cos(angle) * config.orbitRadius,
        Math.sin(angle) * config.orbitHeight + Math.sin(angle * 2 + index) * 0.08,
        -Math.sin(angle) * config.orbitDepth,
      );
      const variance = ORBIT_VARIANCE[index % ORBIT_VARIANCE.length];
      point.applyEuler(new THREE.Euler(ORBIT_TILT_X + variance.x, variance.y, ORBIT_TILT_Z + variance.z));
      return point;
    }

    function makeOrbitEllipse(config: PlanetConfig, index: number) {
      const points: THREE.Vector3[] = [];
      const pointCount = 240;
      for (let i = 0; i < pointCount; i += 1) {
        points.push(orbitPoint(config, index, (i / pointCount) * Math.PI * 2));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x94a3c0,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.LineLoop(geometry, material);
      line.renderOrder = -2;
      scene.add(line);
    }

    function makeTrail(config: PlanetConfig): TrailRuntime {
      const positions = new Float32Array(TRAIL_POINTS * 3);
      const colors = new Float32Array(TRAIL_POINTS * 3);
      const accent = new THREE.Color(config.color);
      for (let i = 0; i < TRAIL_POINTS; i += 1) {
        const fade = Math.pow(1 - i / (TRAIL_POINTS - 1), 1.7) * 0.62;
        colors[i * 3] = accent.r * fade;
        colors[i * 3 + 1] = accent.g * fade;
        colors[i * 3 + 2] = accent.b * fade;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.frustumCulled = false;
      line.renderOrder = -1;
      scene.add(line);
      return { line, geometry, positions };
    }

    planets.forEach((config, index) => {
      makeOrbitEllipse(config, index);
      const archetype = planetArchetypes[config.slug] ?? defaultArchetype;

      const group = new THREE.Group();
      group.userData = { slug: config.slug, route: config.route, name: config.name };

      const material = makePlanetMaterial(config, archetype);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(config.radius, 48, 48), material);
      sphere.userData = group.userData;
      group.add(sphere);

      const atmosphere = makeAtmosphereMesh(config);
      group.add(atmosphere);

      const ring = makeRingMesh(config, archetype);
      if (ring) group.add(ring);

      scene.add(group);
      hitTargets.push(sphere);
      runtimePlanets.push({
        config,
        group,
        sphere,
        atmosphere,
        trail: makeTrail(config),
        angle: config.phase,
        hover: 0,
        label: labelsRef.current[config.slug] ?? null,
      });
    });

    function startLandingTransition(slug: string) {
      if (landingTransition) return;
      const runtime = runtimePlanets.find((item) => item.config.slug === slug);
      const isCenter = slug === centerTransitionConfig.slug;
      if (!runtime && !isCenter) return;
      const config = runtime?.config ?? centerTransitionConfig;
      const group = runtime?.group ?? sunGroup;
      const sphere = runtime?.sphere ?? sun;
      const atmosphere = runtime?.atmosphere;
      const fromScale = group.scale.x || 1;

      clearTransitionTimers();
      activeRef.current = slug;
      setActive(config.slug);
      setActivePlanet(null);
      stageElement.setAttribute("data-transitioning", "true");
      stageElement.style.cursor = "default";

      let hasSeenDropIn = false;
      try {
        hasSeenDropIn = window.sessionStorage.getItem("mcvDropInSeen") === "1";
        window.sessionStorage.setItem("mcvDropInSeen", "1");
      } catch {
        hasSeenDropIn = false;
      }
      const timeScale = hasSeenDropIn ? 0.55 : 1;

      landingTransition = {
        config,
        runtime,
        group,
        sphere,
        atmosphere,
        route: config.route,
        startTime: 0,
        fromPosition: group.position.clone(),
        fromScale,
        targetScale: fromScale * (isCenter ? 2 : 4),
        particles: [],
        hasExploded: false,
        hasNavigated: false,
        timeScale,
      };

      setTransitionOverlay({ name: config.name, accent: config.accent, phase: "approach" });
      scheduleTransitionStep(TRANSITION_APPROACH_SECONDS * timeScale * 1000, () => {
        setTransitionOverlay({ name: config.name, accent: config.accent, phase: "hold" });
      });
      scheduleTransitionStep(TRANSITION_EXPLODE_SECONDS * timeScale * 1000, () => {
        setTransitionOverlay({ name: config.name, accent: config.accent, phase: "explode" });
      });
      scheduleTransitionStep(TRANSITION_NAV_SECONDS * timeScale * 1000 + 600, () => {
        if (landingTransition && !landingTransition.hasNavigated) {
          landingTransition.hasNavigated = true;
          window.location.assign(config.route);
        }
      });
    }

    launchTransitionRef.current = startLandingTransition;

    function resize() {
      const rect = stageElement.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(360, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.72 ? 45 : 37;
      camera.position.set(0, camera.aspect < 0.72 ? 9.8 : 8.1, camera.aspect < 0.72 ? 13.8 : 9.9);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    function pick(clientX: number, clientY: number) {
      const rect = canvasElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitTargets, false)[0];
      return hit?.object.userData?.slug as string | undefined;
    }

    function setActive(slug: string | null) {
      activeRef.current = slug;
      if (!slug) {
        setActivePlanet(null);
        stageElement.removeAttribute("data-active-planet");
        return;
      }
      stageElement.setAttribute("data-active-planet", slug);
    }

    const onPointerMove = (event: PointerEvent) => {
      if (landingTransition) return;
      const slug = pick(event.clientX, event.clientY) ?? null;
      if (slug !== activeRef.current) setActive(slug);
      stageElement.style.cursor = slug ? "pointer" : "default";
    };

    const onPointerLeave = () => {
      if (landingTransition) return;
      setActive(null);
      stageElement.style.cursor = "default";
    };

    const onPointerDown = (event: PointerEvent) => {
      if (landingTransition) return;
      const slug = pick(event.clientX, event.clientY) ?? activeRef.current;
      if (slug) startLandingTransition(slug);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (landingTransition) return;
      if (target?.closest(".solarSystemFallback, .solarSunLabel, .solarPlanetLabel")) return;
      const slug = pick(event.clientX, event.clientY) ?? activeRef.current;
      if (slug) startLandingTransition(slug);
    };

    canvasElement.addEventListener("pointermove", onPointerMove);
    canvasElement.addEventListener("pointerleave", onPointerLeave);
    canvasElement.addEventListener("pointerdown", onPointerDown);
    canvasElement.addEventListener("click", onClick);
    stageElement.addEventListener("click", onClick);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stageElement);
    resize();

    let frame = 0;
    let start = 0;
    let lastTime = 0;
    let sceneSlow = 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const projected = new THREE.Vector3();
    const topProjected = new THREE.Vector3();
    const sunDirScratch = new THREE.Vector3();
    const labelStates: {
      config: PlanetConfig;
      closeness: number;
      isActive: boolean;
      overlapFade: number;
      x: number;
      y: number;
      planetX: number;
      planetY: number;
      planetRadius: number;
      stageWidth: number;
      stageHeight: number;
    }[] = [];

    function animate(now: number) {
      if (!start) start = now;
      const time = (now - start) / 1000;
      const delta = Math.min(Math.max(time - lastTime, 0), 0.05);
      lastTime = time;
      const motionTime = prefersReducedMotion ? 14 : time;
      const motionDelta = prefersReducedMotion ? 0 : delta;
      const activeSlug = activeRef.current;
      const transition = landingTransition;
      if (transition && !transition.startTime) transition.startTime = time;
      const transitionElapsed = transition ? (time - transition.startTime) / transition.timeScale : 0;

      sunMaterial.uniforms.uTime.value = motionTime;
      sunGroup.rotation.y = Math.PI * 0.5 + motionTime * 0.28;
      sunGroup.rotation.x = BODY_FACE_TILT_X + Math.sin(motionTime * 0.14) * 0.018;
      sunGroup.rotation.z = BODY_FACE_TILT_Z;
      const glowPulse = 1 + Math.sin(motionTime * 1.4) * 0.035;
      sunGlow.scale.set(3.75 * glowPulse, 3.75 * glowPulse, 1);

      sunParticles.forEach((particle) => {
        const progress = (motionTime * particle.speed + particle.phase) % 1;
        const distance = 1.34 + progress * 0.59;
        particle.sprite.position.copy(particle.direction).multiplyScalar(distance);
        particle.sprite.material.opacity = prefersReducedMotion ? 0 : (1 - progress) * 0.46;
        particle.sprite.scale.setScalar(particle.size * (0.72 + progress * 1.05));
      });

      const centerLabel = labelsRef.current[centerTransitionConfig.slug];
      if (centerLabel) {
        const stageRectForSun = stageElement.getBoundingClientRect();
        projected.set(0, 0, 0).project(camera);
        topProjected.set(0, sunRadius * 1.12, 0).project(camera);
        const sunCenterY = (-projected.y * 0.5 + 0.5) * stageRectForSun.height;
        const sunTopY = (-topProjected.y * 0.5 + 0.5) * stageRectForSun.height;
        const sunLabelLift = Math.max(96, sunCenterY - sunTopY + 20);
        centerLabel.style.transform = `translate(-50%, ${-sunLabelLift}px)`;
        centerLabel.style.setProperty("--label-opacity", transition ? "0" : activeSlug === centerTransitionConfig.slug ? "1" : "0.55");
        centerLabel.style.setProperty("--label-accent", centerTransitionConfig.accent);
        centerLabel.style.setProperty("--label-rgb", planetThemeMap["mars-cats-voyage"].accentRgb);
      }

      if (transition && !transition.runtime) {
        const approachProgress = THREE.MathUtils.clamp(transitionElapsed / TRANSITION_APPROACH_SECONDS, 0, 1);
        const easedApproach = easeInOutCubic(approachProgress);
        const targetPosition = new THREE.Vector3(0, -0.04, 2.1);
        transition.group.position.copy(transition.fromPosition).lerp(targetPosition, easedApproach);
        transition.group.scale.setScalar(THREE.MathUtils.lerp(transition.fromScale, transition.targetScale, easedApproach));
        transition.sphere.rotation.y += transition.config.spinSpeed * 0.075;

        if (transitionElapsed >= TRANSITION_EXPLODE_SECONDS && !transition.hasExploded) {
          transition.hasExploded = true;
          transition.particles = createExplosionParticles(transition.config, transition.group.position);
          transition.group.visible = false;
          sunGlow.visible = false;
        }

        if (transition.hasExploded) {
          const explosionProgress = THREE.MathUtils.clamp((transitionElapsed - TRANSITION_EXPLODE_SECONDS) / TRANSITION_EXPLOSION_SECONDS, 0, 1);
          const easedExplosion = easeOutCubic(explosionProgress);
          transition.particles.forEach((particle) => {
            particle.sprite.position.copy(transition.group.position).addScaledVector(particle.direction, particle.speed * easedExplosion);
            particle.sprite.scale.setScalar(particle.size * (1 + easedExplosion * 2.4));
            particle.sprite.material.opacity = (1 - explosionProgress) * 0.92;
          });
        }

        if (transitionElapsed >= TRANSITION_NAV_SECONDS && !transition.hasNavigated) {
          transition.hasNavigated = true;
          window.location.assign(transition.route);
        }
      }

      sceneSlow += ((activeSlug ? 1 : 0) - sceneSlow) * Math.min(1, delta * 6);
      const orbitScale = 1 - sceneSlow * 0.85;

      const positions = runtimePlanets.map((planet, index) => {
        const { config } = planet;
        const isActive = activeSlug === config.slug;
        const speed = isActive ? config.orbitSpeed * 0.08 : config.orbitSpeed;
        planet.angle += motionDelta * speed * orbitScale;
        const point = orbitPoint(config, index, planet.angle);
        return { x: point.x, y: point.y, z: point.z, isActive };
      });

      runtimePlanets.forEach((planet, index) => {
        const { config, group, sphere, atmosphere, trail } = planet;
        const { x, y, z, isActive } = positions[index];
        const isTransitionPlanet = transition?.config.slug === config.slug;
        const isTransitioningOtherPlanet = Boolean(transition && !isTransitionPlanet);
        const closeness = THREE.MathUtils.clamp((z + config.orbitDepth) / (config.orbitDepth * 2), 0, 1);
        const scale = (0.86 + closeness * 0.34) * (isActive ? 1.14 : 1);
        const nearestNeighbor = positions.reduce((nearest, other, otherIndex) => {
          if (otherIndex === index) return nearest;
          const distance = Math.hypot(other.x - x, other.y - y);
          return Math.min(nearest, distance);
        }, Number.POSITIVE_INFINITY);
        const overlapFade = THREE.MathUtils.smoothstep(nearestNeighbor, 0.78, 1.28);

        planet.hover += ((isActive ? 1 : 0) - planet.hover) * Math.min(1, delta * 9);
        sphere.material.uniforms.uTime.value = motionTime;
        sphere.material.uniforms.uHover.value = planet.hover;

        for (let k = 0; k < TRAIL_POINTS; k += 1) {
          const trailAngle = planet.angle - (k / (TRAIL_POINTS - 1)) * TRAIL_SPAN;
          const trailPoint = orbitPoint(config, index, trailAngle);
          trail.positions[k * 3] = trailPoint.x;
          trail.positions[k * 3 + 1] = trailPoint.y;
          trail.positions[k * 3 + 2] = trailPoint.z;
        }
        trail.geometry.attributes.position.needsUpdate = true;
        (trail.line.material as THREE.LineBasicMaterial).opacity = isTransitioningOtherPlanet ? 0.24 : transition ? 0.4 : 1;

        if (isTransitionPlanet && transition) {
          const approachProgress = THREE.MathUtils.clamp(transitionElapsed / TRANSITION_APPROACH_SECONDS, 0, 1);
          const easedApproach = easeInOutCubic(approachProgress);
          const targetPosition = new THREE.Vector3(0, -0.04, 2.1);
          group.position.copy(transition.fromPosition).lerp(targetPosition, easedApproach);
          group.scale.setScalar(THREE.MathUtils.lerp(transition.fromScale, transition.targetScale, easedApproach));
          sphere.rotation.y += config.spinSpeed * 0.075;
          sphere.rotation.x = BODY_FACE_TILT_X + Math.sin(time * 1.25) * 0.08;
          sphere.rotation.z = BODY_FACE_TILT_Z;
          sphere.material.uniforms.uHover.value = 1;
          atmosphere.material.uniforms.uIntensity.value = transition.hasExploded ? 0 : 1.3;

          if (transitionElapsed >= TRANSITION_EXPLODE_SECONDS && !transition.hasExploded) {
            transition.hasExploded = true;
            transition.particles = createExplosionParticles(config, group.position);
            group.visible = false;
          }

          if (transition.hasExploded) {
            const explosionProgress = THREE.MathUtils.clamp((transitionElapsed - TRANSITION_EXPLODE_SECONDS) / TRANSITION_EXPLOSION_SECONDS, 0, 1);
            const easedExplosion = easeOutCubic(explosionProgress);
            transition.particles.forEach((particle) => {
              particle.sprite.position.copy(group.position).addScaledVector(particle.direction, particle.speed * easedExplosion);
              particle.sprite.scale.setScalar(particle.size * (1 + easedExplosion * 2.4));
              particle.sprite.material.opacity = (1 - explosionProgress) * 0.92;
            });
          }

          if (transitionElapsed >= TRANSITION_NAV_SECONDS && !transition.hasNavigated) {
            transition.hasNavigated = true;
            window.location.assign(transition.route);
          }
        } else {
          group.visible = true;
          group.position.set(x, y, z);
          group.scale.setScalar(isTransitioningOtherPlanet ? scale * 0.92 : scale);
          group.renderOrder = Math.round(closeness * 20);
          sphere.rotation.y += (isActive ? config.spinSpeed * 0.15 : config.spinSpeed) * 0.016 * (prefersReducedMotion ? 0 : 1);
          sphere.rotation.x = BODY_FACE_TILT_X + Math.sin(motionTime * 0.18 + index) * 0.05;
          sphere.rotation.z = BODY_FACE_TILT_Z;
          atmosphere.material.uniforms.uIntensity.value =
            (isTransitioningOtherPlanet ? 0.16 : 0.42 + closeness * 0.22 + planet.hover * 0.55) * overlapFade;
        }

        sunDirScratch.copy(group.position).multiplyScalar(-1);
        if (sunDirScratch.lengthSq() < 0.0001) sunDirScratch.set(0, 0, 1);
        sunDirScratch.normalize();
        (sphere.material.uniforms.uSunDir.value as THREE.Vector3).copy(sunDirScratch);
        (atmosphere.material.uniforms.uSunDir.value as THREE.Vector3).copy(sunDirScratch);

        projected.copy(group.position).project(camera);
        topProjected.copy(group.position);
        topProjected.y += config.radius * group.scale.x * 1.05;
        topProjected.project(camera);
        const stageRect = stageElement.getBoundingClientRect();
        const centerY = (-projected.y * 0.5 + 0.5) * stageRect.height;
        const topY = (-topProjected.y * 0.5 + 0.5) * stageRect.height;
        labelStates.push({
          config,
          closeness,
          isActive,
          overlapFade,
          x: THREE.MathUtils.clamp((projected.x * 0.5 + 0.5) * stageRect.width, 110, stageRect.width - 110),
          y: THREE.MathUtils.clamp(Math.min(topY, centerY), 96, stageRect.height - 30),
          planetX: (projected.x * 0.5 + 0.5) * stageRect.width,
          planetY: centerY,
          planetRadius: Math.abs(centerY - topY),
          stageWidth: stageRect.width,
          stageHeight: stageRect.height,
        });

        if (!transition && isActive) {
          setActivePlanet({
            slug: config.slug,
            name: config.name,
            route: config.route,
            x: (projected.x * 0.5 + 0.5) * 100,
            y: (-projected.y * 0.5 + 0.5) * 100,
            depth: closeness,
            accent: config.accent,
          });
        }
      });

      labelStates.sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.closeness - a.closeness);
      const placedLabels: { x: number; y: number; halfWidth: number; halfHeight: number }[] = [];
      if (labelStates.length > 0) {
        const stageW = labelStates[0].stageWidth;
        const stageH = labelStates[0].stageHeight;
        placedLabels.push({ x: stageW / 2, y: stageH / 2 - 124, halfWidth: 116, halfHeight: 30 });
        placedLabels.push({ x: stageW / 2, y: stageH / 2, halfWidth: 150, halfHeight: 118 });
      }
      labelStates.forEach((state) => {
        const label = labelsRef.current[state.config.slug];
        if (!label) return;
        const depthScale = 0.72 + state.closeness * 0.34;
        const halfWidth = (state.config.name.length * 7.4 * depthScale + 44) / 2;
        let opacity = state.isActive ? 1 : (0.52 + state.closeness * 0.2) * Math.max(0.5, state.overlapFade);
        const collides = placedLabels.some(
          (other) =>
            Math.abs(state.x - other.x) < halfWidth + other.halfWidth + 12 &&
            Math.abs(state.y - other.y) < 26 + other.halfHeight,
        );
        const hitsPlanet = labelStates.some(
          (other) =>
            other.config.slug !== state.config.slug &&
            Math.abs(state.x - other.planetX) < halfWidth + other.planetRadius + 8 &&
            Math.abs(state.y - other.planetY) < 24 + other.planetRadius + 8,
        );
        if ((collides || hitsPlanet) && !state.isActive) opacity = 0;
        if (state.y > state.stageHeight - 130 && !state.isActive) opacity = 0;
        if (opacity > 0.05) placedLabels.push({ x: state.x, y: state.y, halfWidth, halfHeight: 26 });
        label.style.setProperty("--label-x", `${state.x}px`);
        label.style.setProperty("--label-y", `${state.y}px`);
        label.style.setProperty("--label-depth", String(depthScale));
        label.style.setProperty("--label-opacity", transition ? "0" : opacity.toFixed(3));
        label.style.setProperty("--label-accent", state.config.accent);
      });
      labelStates.length = 0;

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    }

    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      clearTransitionTimers();
      launchTransitionRef.current = () => {};
      if (landingTransition?.particles.length) removeExplosionParticles(landingTransition.particles);
      resizeObserver.disconnect();
      canvasElement.removeEventListener("pointermove", onPointerMove);
      canvasElement.removeEventListener("pointerleave", onPointerLeave);
      canvasElement.removeEventListener("pointerdown", onPointerDown);
      canvasElement.removeEventListener("click", onClick);
      stageElement.removeEventListener("click", onClick);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };
  }, [center, planets]);

  function navigate(route: string) {
    const planet = planets.find((item) => item.route === route);
    if (planet) {
      launchTransitionRef.current(planet.slug);
      return;
    }
    const centerRoute = center ? `/collections/${center.collection.slug}` : "";
    if (route === centerRoute && center) {
      launchTransitionRef.current(center.collection.slug);
      return;
    }
    window.location.assign(route);
  }

  function labelPointerDown(event: ReactPointerEvent<HTMLButtonElement>, route: string) {
    event.preventDefault();
    event.stopPropagation();
    navigate(route);
  }

  function heroParallax(event: ReactPointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    event.currentTarget.style.setProperty("--px", px.toFixed(3));
    event.currentTarget.style.setProperty("--py", py.toFixed(3));
  }

  return (
    <section className="orbitHero threeOrbitHero" aria-label="MCV rarity collection selector" onPointerMove={heroParallax}>
      <div className="starField" aria-hidden="true" />
      <div className="nebula nebulaOne" aria-hidden="true" />
      <div className="nebula nebulaTwo" aria-hidden="true" />

      <div className="orbitCopy threeOrbitCopy">
        <p className="eyebrow">Mars Cats Ventures Rarity Hub</p>
        <h1>
          <span>Choose a collection.</span>{" "}
          <span className="mobileTitleBreak">Drop into the rarity table.</span>
        </h1>
        <p className="lede">
          Real imported rarity data for the MCV ecosystem, ranked across traits, trait counts, listings, and collection-specific scoring rules.
        </p>
        <p className="orbitStatLine">
          <span>{collections.length} collections</span>
          <span>{collections.reduce((sum, entry) => sum + entry.collection.actualTokenCount, 0).toLocaleString()} tokens ranked</span>
          <span>{chainCount} chains</span>
        </p>
      </div>

      <div className="solarSystemStage" ref={stageRef}>
        <div className="solarSystemBackdrop" aria-hidden="true" />
        <span className="shootingStar" aria-hidden="true" />
        <div className="hudFrame" aria-hidden="true">
          <span className="hudTag hudTagTopLeft">Orbital selector — live</span>
          <span className="hudTag hudTagTopRight">Select a world · click to drop in</span>
        </div>
        <div className="solarSunTrajectory" aria-hidden="true" />
        <canvas className="solarSystemCanvas" ref={canvasRef} aria-label="Interactive 3D MCV collection solar system" />
        {center && (
          <button
            className="solarSunLabel"
            ref={(node) => {
              labelsRef.current[center.collection.slug] = node;
            }}
            style={
              {
                "--label-accent": planetThemeMap["mars-cats-voyage"].accent,
                "--label-rgb": planetThemeMap["mars-cats-voyage"].accentRgb,
              } as CSSProperties
            }
            type="button"
            tabIndex={-1}
            onPointerEnter={() => {
              activeRef.current = center.collection.slug;
            }}
            onPointerLeave={() => {
              if (activeRef.current === center.collection.slug) activeRef.current = null;
            }}
            onPointerDown={(event) => labelPointerDown(event, `/collections/${center.collection.slug}`)}
            onClick={() => navigate(`/collections/${center.collection.slug}`)}
          >
            {center.collection.name}
          </button>
        )}
        <div className="solarPlanetLabels" aria-hidden="true">
          {planets.map((planet) => (
            <button
              className="solarPlanetLabel"
              key={planet.slug}
              ref={(node) => {
                labelsRef.current[planet.slug] = node;
              }}
              style={
                {
                  "--label-accent": planet.accent,
                  "--label-rgb": planet.accentRgb,
                } as CSSProperties
              }
              type="button"
              tabIndex={-1}
              onPointerEnter={() => {
                activeRef.current = planet.slug;
              }}
              onPointerLeave={() => {
                if (activeRef.current === planet.slug) activeRef.current = null;
              }}
              onPointerDown={(event) => labelPointerDown(event, planet.route)}
              onClick={() => navigate(planet.route)}
            >
              {planet.name}
            </button>
          ))}
        </div>
        <nav className="solarSystemFallback" aria-label="Collection links">
          {center && (
            <button
              type="button"
              onClick={() => navigate(`/collections/${center.collection.slug}`)}
              style={
                {
                  "--planet-link-accent": planetThemeMap["mars-cats-voyage"].accent,
                  "--planet-link-rgb": planetThemeMap["mars-cats-voyage"].accentRgb,
                } as CSSProperties
              }
            >
              <span className="dockBadge" aria-hidden="true">
                <NextImage src={badgeMap[center.collection.slug]} alt="" width={56} height={56} />
              </span>
              <span className="dockName">{center.collection.name}</span>
            </button>
          )}
          {planets.map((planet) => (
            <button
              key={planet.slug}
              type="button"
              onClick={() => navigate(planet.route)}
              style={
                {
                  "--planet-link-accent": planet.accent,
                  "--planet-link-rgb": planet.accentRgb,
                } as CSSProperties
              }
            >
              <span className="dockBadge" aria-hidden="true">
                <NextImage src={badgeMap[planet.slug]} alt="" width={56} height={56} />
              </span>
              <span className="dockName">{planet.name}</span>
            </button>
          ))}
        </nav>
        {activePlanet && (
          <div
            className="solarActiveReadout"
            style={
              {
                "--active-x": `${activePlanet.x}%`,
                "--active-y": `${activePlanet.y}%`,
                "--active-accent": activePlanet.accent,
              } as CSSProperties
            }
          >
            {activePlanet.name}
          </div>
        )}
        <a className="scrollCue" href="#hall-of-rarest">
          <span className="scrollCueLine" aria-hidden="true" />
          Hall of Rarest
        </a>
        {transitionOverlay && (
          <div
            className={`solarTransitionName solarTransitionName--${transitionOverlay.phase}`}
            style={{ "--transition-accent": transitionOverlay.accent } as CSSProperties}
          >
            {transitionOverlay.name}
          </div>
        )}
      </div>
    </section>
  );
}
