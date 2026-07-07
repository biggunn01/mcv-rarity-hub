"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import type { CollectionSummary } from "@/lib/types";

const logoMap: Record<string, string> = {
  "mars-cats-voyage": "/collection-logos/mcv-official-logo.png",
  "mars-alien-cats": "/collection-logos/mars-alien-cats.avif",
  "mars-cats-in-spacesuits": "/collection-logos/mars-cats-in-spacesuits.avif",
  "mars-cats-snipers": "/collection-logos/mars-cats-snipers.avif",
  metazoku: "/collection-logos/metazoku-official.png",
  "battle-pawss": "/collection-logos/battle-pawss-planet-logo.png",
  "cream-cats": "/collection-logos/cream-cats.webp",
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

type Props = {
  collections: CollectionSummary[];
};

type PlanetConfig = {
  entry: CollectionSummary;
  slug: string;
  name: string;
  route: string;
  logo: string;
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

type PlanetRuntime = {
  config: PlanetConfig;
  group: THREE.Group;
  sphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  atmosphere: THREE.Sprite;
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

type OrbitTrail = {
  line: THREE.LineLoop;
  material: THREE.LineDashedMaterial;
  shaderStore: { current: { uniforms: Record<string, { value: number }> } | null };
  dashSpeed: number;
};

type TransitionTargetConfig = Pick<PlanetConfig, "slug" | "name" | "route" | "spinSpeed" | "accent" | "color">;

type LandingTransition = {
  config: TransitionTargetConfig;
  runtime?: PlanetRuntime;
  group: THREE.Group;
  sphere: THREE.Mesh;
  atmosphere?: THREE.Sprite;
  route: string;
  startTime: number;
  fromPosition: THREE.Vector3;
  fromScale: number;
  targetScale: number;
  particles: TransitionParticle[];
  hasExploded: boolean;
  hasNavigated: boolean;
};

const orbitPresets = [
  { orbitRadius: 3.38, orbitHeight: 0.82, orbitDepth: 1.56, phase: 2.55, orbitSpeed: 0.18, radius: 0.38, spinSpeed: 0.28 },
  { orbitRadius: 4.36, orbitHeight: 1.02, orbitDepth: 1.98, phase: 5.05, orbitSpeed: 0.145, radius: 0.35, spinSpeed: 0.24 },
  { orbitRadius: 5.32, orbitHeight: 1.34, orbitDepth: 2.36, phase: 3.35, orbitSpeed: 0.12, radius: 0.37, spinSpeed: 0.22 },
  { orbitRadius: 6.28, orbitHeight: 1.52, orbitDepth: 2.74, phase: 0.2, orbitSpeed: 0.1, radius: 0.41, spinSpeed: 0.2 },
  { orbitRadius: 4.92, orbitHeight: 1.92, orbitDepth: 2.98, phase: 1.35, orbitSpeed: 0.088, radius: 0.36, spinSpeed: 0.17 },
  { orbitRadius: 6.82, orbitHeight: 2.16, orbitDepth: 3.44, phase: 4.45, orbitSpeed: 0.078, radius: 0.38, spinSpeed: 0.15 },
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

export function OrbitLanding({ collections }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeRef = useRef<string | null>(null);
  const launchTransitionRef = useRef<(slug: string) => void>(() => {});
  const transitionTimersRef = useRef<number[]>([]);
  const [activePlanet, setActivePlanet] = useState<ActivePlanet | null>(null);
  const [transitionOverlay, setTransitionOverlay] = useState<TransitionOverlay | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
            logo: logoMap[slug],
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
    const centerLogoSrc = logoMap[center.collection.slug];

    const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03050d, 0.035);

    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 80);
    camera.position.set(0, 8.1, 9.9);
    camera.lookAt(0, 0, 0);

    const runtimePlanets: PlanetRuntime[] = [];
    const orbitTrails: OrbitTrail[] = [];
    const sunGroup = new THREE.Group();
    sunGroup.rotation.x = BODY_FACE_TILT_X;
    sunGroup.rotation.z = BODY_FACE_TILT_Z;
    scene.add(sunGroup);

    const ambient = new THREE.AmbientLight(0xffffff, 0.78);
    const sunLight = new THREE.PointLight(0xffffff, 6.2, 18, 1.25);
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.15);
    rimLight.position.set(-4, 3, 7);
    scene.add(ambient, sunLight, rimLight);

    function hexToRgb(hex: number) {
      return {
        r: (hex >> 16) & 255,
        g: (hex >> 8) & 255,
        b: hex & 255,
      };
    }

    function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
      return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
    }

    function boostLogoColor({ r, g, b }: { r: number; g: number; b: number }) {
      const average = (r + g + b) / 3;
      const boost = (channel: number) => Math.min(Math.max(average + (channel - average) * 1.24 + 12, 0), 255);
      return {
        r: boost(r),
        g: boost(g),
        b: boost(b),
      };
    }

    function estimateLogoBaseColor(image: HTMLImageElement, fallback: number) {
      const sampleSize = 96;
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = sampleSize;
      sampleCanvas.height = sampleSize;
      const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
      if (!sampleContext) return hexToRgb(fallback);

      sampleContext.drawImage(image, 0, 0, sampleSize, sampleSize);
      const { data } = sampleContext.getImageData(0, 0, sampleSize, sampleSize);
      let r = 0;
      let g = 0;
      let b = 0;
      let weight = 0;

      for (let pixel = 0; pixel < data.length; pixel += 4) {
        const alpha = data[pixel + 3] / 255;
        const brightness = (data[pixel] + data[pixel + 1] + data[pixel + 2]) / 3;
        const saturation = Math.max(data[pixel], data[pixel + 1], data[pixel + 2]) - Math.min(data[pixel], data[pixel + 1], data[pixel + 2]);
        if (alpha < 0.35 || brightness < 20 || brightness > 244) continue;
        const pixelWeight = alpha * (0.65 + saturation / 255);
        r += data[pixel] * pixelWeight;
        g += data[pixel + 1] * pixelWeight;
        b += data[pixel + 2] * pixelWeight;
        weight += pixelWeight;
      }

      if (weight < 1) return hexToRgb(fallback);
      return { r: r / weight, g: g / weight, b: b / weight };
    }

    function estimateLogoBackgroundColor(image: HTMLImageElement, fallback: number) {
      const sampleSize = 96;
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = sampleSize;
      sampleCanvas.height = sampleSize;
      const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
      if (!sampleContext) return hexToRgb(fallback);

      sampleContext.drawImage(image, 0, 0, sampleSize, sampleSize);
      const { data } = sampleContext.getImageData(0, 0, sampleSize, sampleSize);
      let r = 0;
      let g = 0;
      let b = 0;
      let weight = 0;

      for (let y = 0; y < sampleSize; y += 1) {
        for (let x = 0; x < sampleSize; x += 1) {
          const edgeDistance = Math.min(x, y, sampleSize - 1 - x, sampleSize - 1 - y);
          if (edgeDistance > 14) continue;
          const offset = (y * sampleSize + x) * 4;
          const alpha = data[offset + 3] / 255;
          if (alpha < 0.35) continue;
          const edgeWeight = alpha * (1 + (14 - edgeDistance) / 14);
          r += data[offset] * edgeWeight;
          g += data[offset + 1] * edgeWeight;
          b += data[offset + 2] * edgeWeight;
          weight += edgeWeight;
        }
      }

      if (weight < 1) return hexToRgb(fallback);
      return { r: r / weight, g: g / weight, b: b / weight };
    }

    function paintEquatorLogoBand(
      context: CanvasRenderingContext2D,
      image: HTMLImageElement,
      width: number,
      height: number,
      options: {
        tileWidth: number;
        logoSize: number;
        alpha: number;
        centerTile?: boolean;
        centerU?: number;
        transparentBackground?: { r: number; g: number; b: number };
        logoPadding?: number;
        removeDarkBackground?: boolean;
        cropToVisibleContent?: boolean;
      },
    ) {
      const y = height * 0.5 - options.logoSize / 2;
      const source = options.cropToVisibleContent
        ? makeCroppedLogoCanvas(image, options.logoSize, options.logoPadding ?? 0)
        : options.transparentBackground
          ? makeLogoForegroundCanvas(image, options.logoSize, options.transparentBackground, options.logoPadding ?? 0, options.removeDarkBackground)
          : image;
      const drawWrappedLogo = (drawX: number) => {
        context.drawImage(source, drawX, y, options.logoSize, options.logoSize);
        if (drawX < 0) context.drawImage(source, drawX + width, y, options.logoSize, options.logoSize);
        if (drawX + options.logoSize > width) context.drawImage(source, drawX - width, y, options.logoSize, options.logoSize);
      };

      context.save();
      context.globalAlpha = options.alpha;
      const centerX = width * (options.centerU ?? 0.5);
      const firstX = options.centerTile
        ? centerX - options.tileWidth * 0.5 - Math.ceil(width / options.tileWidth) * options.tileWidth
        : -options.tileWidth;
      for (let x = firstX; x < width + options.tileWidth; x += options.tileWidth) {
        const drawX = x + (options.tileWidth - options.logoSize) / 2;
        drawWrappedLogo(drawX);
      }
      context.restore();
    }

    function makeLogoForegroundCanvas(
      image: HTMLImageElement,
      size: number,
      backgroundColor: { r: number; g: number; b: number },
      padding: number,
      removeDarkBackground = false,
    ) {
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = size;
      sourceCanvas.height = size;
      const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
      if (!sourceContext) return image;

      const drawSize = size - padding * 2;
      sourceContext.imageSmoothingEnabled = true;
      sourceContext.imageSmoothingQuality = "high";
      sourceContext.drawImage(image, padding, padding, drawSize, drawSize);
      const imageData = sourceContext.getImageData(0, 0, size, size);
      const { data } = imageData;

      for (let pixel = 0; pixel < data.length; pixel += 4) {
        const redDelta = data[pixel] - backgroundColor.r;
        const greenDelta = data[pixel + 1] - backgroundColor.g;
        const blueDelta = data[pixel + 2] - backgroundColor.b;
        const distance = Math.sqrt(redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta);
        const brightness = (data[pixel] + data[pixel + 1] + data[pixel + 2]) / 3;
        const saturation = Math.max(data[pixel], data[pixel + 1], data[pixel + 2]) - Math.min(data[pixel], data[pixel + 1], data[pixel + 2]);

        if (distance <= 44) {
          data[pixel + 3] = 0;
        } else if (distance < 112) {
          data[pixel + 3] = Math.round(data[pixel + 3] * ((distance - 44) / 68));
        }

        if (removeDarkBackground && brightness < 54 && saturation < 34) {
          data[pixel + 3] = 0;
        } else if (removeDarkBackground && brightness < 86 && saturation < 34) {
          data[pixel + 3] = Math.round(data[pixel + 3] * ((brightness - 54) / 32));
        }
      }

      sourceContext.putImageData(imageData, 0, 0);
      return sourceCanvas;
    }

    function makeCroppedLogoCanvas(image: HTMLImageElement, size: number, padding: number) {
      const scanCanvas = document.createElement("canvas");
      scanCanvas.width = image.naturalWidth || image.width;
      scanCanvas.height = image.naturalHeight || image.height;
      const scanContext = scanCanvas.getContext("2d", { willReadFrequently: true });
      if (!scanContext) return image;

      scanContext.drawImage(image, 0, 0, scanCanvas.width, scanCanvas.height);
      const { data } = scanContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
      let minX = scanCanvas.width;
      let minY = scanCanvas.height;
      let maxX = 0;
      let maxY = 0;

      for (let y = 0; y < scanCanvas.height; y += 1) {
        for (let x = 0; x < scanCanvas.width; x += 1) {
          const offset = (y * scanCanvas.width + x) * 4;
          const alpha = data[offset + 3];
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          const brightness = (r + g + b) / 3;
          const saturation = Math.max(r, g, b) - Math.min(r, g, b);
          if (alpha < 16 || (brightness < 46 && saturation < 38)) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (minX >= maxX || minY >= maxY) return image;

      const sourceWidth = maxX - minX + 1;
      const sourceHeight = maxY - minY + 1;
      const cropSize = Math.max(sourceWidth, sourceHeight);
      const sourceX = Math.max(0, minX - (cropSize - sourceWidth) / 2);
      const sourceY = Math.max(0, minY - (cropSize - sourceHeight) / 2);
      const clampedCropSize = Math.min(cropSize, scanCanvas.width - sourceX, scanCanvas.height - sourceY);

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = size;
      outputCanvas.height = size;
      const outputContext = outputCanvas.getContext("2d");
      if (!outputContext) return image;
      const drawSize = size - padding * 2;
      outputContext.imageSmoothingEnabled = true;
      outputContext.imageSmoothingQuality = "high";
      outputContext.drawImage(image, sourceX, sourceY, clampedCropSize, clampedCropSize, padding, padding, drawSize, drawSize);
      return outputCanvas;
    }

    function sealHorizontalTextureSeam(context: CanvasRenderingContext2D, width: number, height: number, stripWidth = 14) {
      const leftStrip = context.getImageData(0, 0, stripWidth, height);
      const rightStrip = context.getImageData(width - stripWidth, 0, stripWidth, height);
      const { data: leftData } = leftStrip;
      const { data: rightData } = rightStrip;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < stripWidth; x += 1) {
          const leftOffset = (y * stripWidth + x) * 4;
          const rightOffset = (y * stripWidth + (stripWidth - 1 - x)) * 4;

          for (let channel = 0; channel < 4; channel += 1) {
            const blended = Math.round((leftData[leftOffset + channel] + rightData[rightOffset + channel]) * 0.5);
            leftData[leftOffset + channel] = blended;
            rightData[rightOffset + channel] = blended;
          }
        }
      }

      context.putImageData(leftStrip, 0, 0);
      context.putImageData(rightStrip, width - stripWidth, 0);
    }

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

    function makeSunSurfaceTexture() {
      const width = 1024;
      const height = 512;
      const canvasTexture = document.createElement("canvas");
      canvasTexture.width = width;
      canvasTexture.height = height;
      const context = canvasTexture.getContext("2d");
      if (!context) return null;

      const paintBase = () => {
        const baseGradient = context.createLinearGradient(0, 0, 0, height);
        baseGradient.addColorStop(0, "#020202");
        baseGradient.addColorStop(0.2, "#020202");
        baseGradient.addColorStop(0.38, "#080808");
        baseGradient.addColorStop(0.5, "#111111");
        baseGradient.addColorStop(0.62, "#080808");
        baseGradient.addColorStop(0.8, "#020202");
        baseGradient.addColorStop(1, "#020202");
        context.fillStyle = baseGradient;
        context.fillRect(0, 0, width, height);

        const equatorGlow = context.createLinearGradient(0, height * 0.24, 0, height * 0.76);
        equatorGlow.addColorStop(0, "rgba(255, 255, 255, 0)");
        equatorGlow.addColorStop(0.45, "rgba(255, 255, 255, 0.12)");
        equatorGlow.addColorStop(0.55, "rgba(255, 255, 255, 0.12)");
        equatorGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
        context.fillStyle = equatorGlow;
        context.fillRect(0, 0, width, height);
      };

      paintBase();
      const texture = new THREE.CanvasTexture(canvasTexture);
      texture.colorSpace = THREE.SRGBColorSpace;

      const logoImage = new Image();
      logoImage.onload = () => {
        paintBase();
        paintEquatorLogoBand(context, logoImage, width, height, {
          tileWidth: width / 4,
          logoSize: 264,
          alpha: 0.98,
          centerTile: true,
          centerU: 0,
          transparentBackground: { r: 2, g: 2, b: 2 },
          logoPadding: 10,
        });

        const limbShade = context.createLinearGradient(width * 0.12, 0, width * 0.88, 0);
        limbShade.addColorStop(0, "rgba(0, 0, 0, 0.32)");
        limbShade.addColorStop(0.34, "rgba(0, 0, 0, 0)");
        limbShade.addColorStop(0.66, "rgba(0, 0, 0, 0)");
        limbShade.addColorStop(1, "rgba(0, 0, 0, 0.34)");
        context.fillStyle = limbShade;
        context.fillRect(0, 0, width, height);
        sealHorizontalTextureSeam(context, width, height);
        texture.needsUpdate = true;
        setIsLoading(false);
      };
      logoImage.onerror = () => setIsLoading(false);
      logoImage.src = centerLogoSrc;

      return texture;
    }

    const sunTexture = makeSunSurfaceTexture();
    if (sunTexture) sunTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const sunMaterial = new THREE.MeshBasicMaterial({
      map: sunTexture,
      color: 0xffffff,
      fog: false,
    });
    const sunRadius = 1.3125;
    const sun = new THREE.Mesh(new THREE.SphereGeometry(sunRadius, 96, 96), sunMaterial);
    sun.renderOrder = 2;
    sunGroup.add(sun);

    const sunGlowTexture = makeSunGlowTexture();
    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunGlowTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.62,
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
          color: 0xffffff,
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

    function makeAtmosphereTexture(accentRgb: string) {
      const size = 256;
      const canvasTexture = document.createElement("canvas");
      canvasTexture.width = size;
      canvasTexture.height = size;
      const context = canvasTexture.getContext("2d");
      if (!context) return null;

      const gradient = context.createRadialGradient(size * 0.5, size * 0.5, size * 0.02, size * 0.5, size * 0.5, size * 0.5);
      gradient.addColorStop(0, `rgba(255, 255, 255, 0.12)`);
      gradient.addColorStop(0.26, `rgba(${accentRgb}, 0.34)`);
      gradient.addColorStop(0.52, `rgba(${accentRgb}, 0.22)`);
      gradient.addColorStop(0.76, `rgba(${accentRgb}, 0.07)`);
      gradient.addColorStop(0.92, `rgba(${accentRgb}, 0.015)`);
      gradient.addColorStop(1, `rgba(${accentRgb}, 0)`);
      context.clearRect(0, 0, size, size);
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);

      const texture = new THREE.CanvasTexture(canvasTexture);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    function makePlanetSurfaceTexture(config: PlanetConfig) {
      const width = 1024;
      const height = 512;
      const isBattlePawss = config.slug === "battle-pawss";
      const canvasTexture = document.createElement("canvas");
      canvasTexture.width = width;
      canvasTexture.height = height;
      const context = canvasTexture.getContext("2d");
      if (!context) return null;

      const paintBase = (baseColor = hexToRgb(config.color), poleColor = baseColor) => {
        context.clearRect(0, 0, width, height);
        const backgroundHex = rgbToHex(isBattlePawss ? { r: 3, g: 5, b: 9 } : poleColor);
        const baseGradient = context.createLinearGradient(0, 0, 0, height);
        baseGradient.addColorStop(0, backgroundHex);
        baseGradient.addColorStop(1, backgroundHex);
        context.fillStyle = baseGradient;
        context.fillRect(0, 0, width, height);

        const surfaceColor = isBattlePawss ? hexToRgb(config.color) : boostLogoColor(baseColor);
        const accentGlow = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 0.58);
        accentGlow.addColorStop(0, `rgba(${Math.round(surfaceColor.r)}, ${Math.round(surfaceColor.g)}, ${Math.round(surfaceColor.b)}, ${isBattlePawss ? 0.2 : 0.16})`);
        accentGlow.addColorStop(0.6, `rgba(${Math.round(surfaceColor.r)}, ${Math.round(surfaceColor.g)}, ${Math.round(surfaceColor.b)}, ${isBattlePawss ? 0.08 : 0.05})`);
        accentGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = accentGlow;
        context.fillRect(0, 0, width, height);
      };

      paintBase();

      const texture = new THREE.CanvasTexture(canvasTexture);
      texture.colorSpace = THREE.SRGBColorSpace;

      const logoImage = new Image();
      logoImage.onload = () => {
        const baseColor = isBattlePawss ? hexToRgb(0x05070b) : estimateLogoBaseColor(logoImage, config.color);
        const poleColor = isBattlePawss ? hexToRgb(0x030509) : estimateLogoBackgroundColor(logoImage, config.color);
        const logoBackgroundColor = isBattlePawss ? estimateLogoBackgroundColor(logoImage, 0xffffff) : poleColor;
        paintBase(baseColor, poleColor);
        paintEquatorLogoBand(context, logoImage, width, height, {
          tileWidth: isBattlePawss ? width / 3 : width / 4,
          logoSize: isBattlePawss ? 224 : 292,
          alpha: 1,
          transparentBackground: isBattlePawss ? undefined : logoBackgroundColor,
          logoPadding: isBattlePawss ? 10 : 24,
          cropToVisibleContent: isBattlePawss,
        });

        const limbShade = context.createLinearGradient(width * 0.14, 0, width * 0.86, 0);
        limbShade.addColorStop(0, `rgba(0, 0, 0, ${isBattlePawss ? 0.24 : 0.12})`);
        limbShade.addColorStop(0.32, "rgba(0, 0, 0, 0)");
        limbShade.addColorStop(0.68, "rgba(0, 0, 0, 0)");
        limbShade.addColorStop(1, `rgba(0, 0, 0, ${isBattlePawss ? 0.28 : 0.16})`);
        context.fillStyle = limbShade;
        context.fillRect(0, 0, width, height);
        sealHorizontalTextureSeam(context, width, height);
        texture.needsUpdate = true;
      };
      logoImage.src = config.logo;

      return texture;
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

    function makeTrail(config: PlanetConfig, index: number) {
      const points: THREE.Vector3[] = [];
      const pointCount = 720;
      for (let i = 0; i < pointCount; i += 1) {
        const progress = i / pointCount;
        const angle = progress * Math.PI * 2;
        points.push(orbitPoint(config, index, angle));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        dashSize: 0.11,
        gapSize: 0.08,
        scale: 1,
      });
      const shaderStore: OrbitTrail["shaderStore"] = { current: null };
      material.onBeforeCompile = (shader) => {
        shader.uniforms.dashOffset = { value: 0 };
        shader.fragmentShader = `uniform float dashOffset;\n${shader.fragmentShader}`.replace(
          "mod( vLineDistance, totalSize )",
          "mod( vLineDistance + dashOffset, totalSize )",
        );
        shaderStore.current = shader;
      };
      const trail = new THREE.LineLoop(geometry, material);
      trail.computeLineDistances();
      trail.renderOrder = -2;
      scene.add(trail);
      orbitTrails.push({ line: trail, material, shaderStore, dashSpeed: config.orbitSpeed * 1.8 });
    }

    planets.forEach((config, index) => {
      makeTrail(config, index);

      const surfaceTexture = makePlanetSurfaceTexture(config);
      if (surfaceTexture) surfaceTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const group = new THREE.Group();
      group.userData = { slug: config.slug, route: config.route, name: config.name };

      const material = new THREE.MeshStandardMaterial({
        map: surfaceTexture,
        color: 0xffffff,
        metalness: 0.02,
        roughness: 0.34,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: surfaceTexture,
        emissiveIntensity: 0.34,
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(config.radius, 72, 72), material);
      sphere.userData = group.userData;
      group.add(sphere);

      const atmosphereTexture = makeAtmosphereTexture(config.accentRgb);
      const atmosphere = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: atmosphereTexture,
          color: 0xffffff,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      atmosphere.scale.setScalar(config.radius * 2.72);
      atmosphere.renderOrder = -1;
      group.add(atmosphere);

      scene.add(group);
      hitTargets.push(sphere);
      runtimePlanets.push({
        config,
        group,
        sphere,
        atmosphere,
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
      };

      setTransitionOverlay({ name: config.name, accent: config.accent, phase: "approach" });
      scheduleTransitionStep(TRANSITION_APPROACH_SECONDS * 1000, () => {
        setTransitionOverlay({ name: config.name, accent: config.accent, phase: "hold" });
      });
      scheduleTransitionStep(TRANSITION_EXPLODE_SECONDS * 1000, () => {
        setTransitionOverlay({ name: config.name, accent: config.accent, phase: "explode" });
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
    const projected = new THREE.Vector3();

    function animate(now: number) {
      if (!start) start = now;
      const time = (now - start) / 1000;
      const activeSlug = activeRef.current;
      const transition = landingTransition;
      if (transition && !transition.startTime) transition.startTime = time;
      const transitionElapsed = transition ? time - transition.startTime : 0;

      sunGroup.rotation.y = Math.PI * 0.5 + time * 0.28;
      sunGroup.rotation.x = BODY_FACE_TILT_X + Math.sin(time * 0.14) * 0.018;
      sunGroup.rotation.z = BODY_FACE_TILT_Z;
      const glowPulse = 1 + Math.sin(time * 1.4) * 0.035;
      sunGlow.scale.set(3.75 * glowPulse, 3.75 * glowPulse, 1);

      sunParticles.forEach((particle) => {
        const progress = (time * particle.speed + particle.phase) % 1;
        const distance = 1.34 + progress * 0.59;
        particle.sprite.position.copy(particle.direction).multiplyScalar(distance);
        particle.sprite.material.opacity = (1 - progress) * 0.46;
        particle.sprite.scale.setScalar(particle.size * (0.72 + progress * 1.05));
      });

      orbitTrails.forEach((trail) => {
        if (trail.shaderStore.current) trail.shaderStore.current.uniforms.dashOffset.value = -time * trail.dashSpeed;
      });

      const centerLabel = labelsRef.current[centerTransitionConfig.slug];
      if (centerLabel) {
        centerLabel.style.setProperty("--label-opacity", transition ? "0" : activeSlug === centerTransitionConfig.slug ? "1" : "0");
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

      const positions = runtimePlanets.map((planet, index) => {
        const { config } = planet;
        const isActive = activeSlug === config.slug;
        const speed = isActive ? config.orbitSpeed * 0.08 : config.orbitSpeed;
        const angle = config.phase + time * speed;
        const point = orbitPoint(config, index, angle);
        return { x: point.x, y: point.y, z: point.z, isActive };
      });

      runtimePlanets.forEach((planet, index) => {
        const { config, group, sphere, atmosphere } = planet;
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

        if (isTransitionPlanet && transition) {
          const approachProgress = THREE.MathUtils.clamp(transitionElapsed / TRANSITION_APPROACH_SECONDS, 0, 1);
          const easedApproach = easeInOutCubic(approachProgress);
          const targetPosition = new THREE.Vector3(0, -0.04, 2.1);
          group.position.copy(transition.fromPosition).lerp(targetPosition, easedApproach);
          group.scale.setScalar(THREE.MathUtils.lerp(transition.fromScale, transition.targetScale, easedApproach));
          sphere.rotation.y += config.spinSpeed * 0.075;
          sphere.rotation.x = BODY_FACE_TILT_X + Math.sin(time * 1.25) * 0.08;
          sphere.rotation.z = BODY_FACE_TILT_Z;
          sphere.material.emissiveIntensity = 0.62;
          atmosphere.material.opacity = transition.hasExploded ? 0 : 0.58;

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
          sphere.rotation.y += (isActive ? config.spinSpeed * 0.15 : config.spinSpeed) * 0.016;
          sphere.rotation.x = BODY_FACE_TILT_X + Math.sin(time * 0.18 + index) * 0.05;
          sphere.rotation.z = BODY_FACE_TILT_Z;
          sphere.material.emissiveIntensity = isActive ? 0.5 : 0.3 + closeness * 0.12;
          atmosphere.material.opacity = (isTransitioningOtherPlanet ? 0.08 : isActive ? 0.46 : 0.2 + closeness * 0.16) * overlapFade;
        }

        projected.copy(group.position).project(camera);
        const rect = stageElement.getBoundingClientRect();
        const label = labelsRef.current[config.slug];
        if (label) {
          const labelX = (projected.x * 0.5 + 0.5) * rect.width;
          const labelY = (-projected.y * 0.5 + 0.5) * rect.height;
          label.style.setProperty("--label-x", `${labelX}px`);
          label.style.setProperty("--label-y", `${labelY}px`);
          label.style.setProperty("--label-depth", String(0.72 + closeness * 0.34));
          label.style.setProperty("--label-opacity", transition ? "0" : isActive ? "1" : "0");
          label.style.setProperty("--label-accent", config.accent);
        }

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
        <p className="eyebrow">Mars Cats Voyage Rarity Hub</p>
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
          <span>3 chains</span>
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
        {isLoading && <span className="solarSystemLoading">Loading orbit</span>}
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
              style={{ "--planet-link-accent": planetThemeMap["mars-cats-voyage"].accent } as CSSProperties}
            >
              {center.collection.name}
            </button>
          )}
          {planets.map((planet) => (
            <button
              key={planet.slug}
              type="button"
              onClick={() => navigate(planet.route)}
              style={{ "--planet-link-accent": planet.accent } as CSSProperties}
            >
              {planet.name}
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
