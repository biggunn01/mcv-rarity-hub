"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CollectionSummary } from "@/lib/types";

const logoMap: Record<string, string> = {
  "mars-cats-voyage": "/collection-logos/mcv-official-logo.png",
  "mars-alien-cats": "/collection-logos/mars-alien-cats.avif",
  "mars-cats-in-spacesuits": "/collection-logos/mars-cats-in-spacesuits.avif",
  "mars-cats-snipers": "/collection-logos/mars-cats-snipers.avif",
  metazoku: "/collection-logos/metazoku.avif",
  "battle-pawss": "/collection-logos/battle-pawss.avif",
  "cream-cats": "/collection-logos/cream-cats.webp",
};

const planetBaseMap: Record<string, string> = {
  "mars-alien-cats": "#06070d",
  "mars-cats-in-spacesuits": "#162c3b",
  "mars-cats-snipers": "#0d1412",
  metazoku: "#eff000",
  "battle-pawss": "#5f45d7",
  "cream-cats": "#f2ca72",
};

type Props = {
  collections: CollectionSummary[];
};

type OrbitGeometry = {
  rx: number;
  ry: number;
  phase: number;
  duration: number;
  size: number;
};

const orbitCenter = { x: 50, y: 53 };
const orbitGeometry: OrbitGeometry[] = [
  { rx: 28, ry: 10, phase: 194, duration: 68.4, size: 110 },
  { rx: 35, ry: 13, phase: 314, duration: 79.2, size: 102 },
  { rx: 42, ry: 16, phase: 88, duration: 88.2, size: 104 },
  { rx: 48, ry: 19, phase: 22, duration: 97.2, size: 116 },
  { rx: 34, ry: 28, phase: 112, duration: 106.2, size: 100 },
  { rx: 41, ry: 32, phase: 252, duration: 115.2, size: 108 },
  { rx: 48, ry: 35, phase: 156, duration: 124.2, size: 98 },
];

function AtomizedText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`atomizedText ${className}`} aria-hidden="true">
      {text.split("").map((letter, index) => (
        <span
          className="atomChar"
          key={`${letter}-${index}`}
          style={
            {
              "--atom-index": index,
              "--atom-x": `${((index % 7) - 3) * 9}px`,
              "--atom-y": `${((index % 5) - 2) * 8}px`,
            } as CSSProperties
          }
        >
          {letter === " " ? "\u00a0" : letter}
        </span>
      ))}
    </span>
  );
}

export function OrbitLanding({ collections }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<CollectionSummary | null>(null);
  const [pausedPlanet, setPausedPlanet] = useState<{ slug: string; angle: number } | null>(null);
  const [now, setNow] = useState(0);
  const center = collections.find((entry) => entry.collection.slug === "mars-cats-voyage");
  const orbiting = collections.filter((entry) => entry.collection.slug !== "mars-cats-voyage");
  const planetGeometry = useMemo(
    () => orbiting.map((entry, index) => ({ entry, geometry: orbitGeometry[index % orbitGeometry.length] })),
    [orbiting],
  );

  useEffect(() => {
    let frame = 0;

    function animate(time: number) {
      setNow(time / 1000);
      frame = window.requestAnimationFrame(animate);
    }

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function currentAngle(entry: CollectionSummary, geometry: OrbitGeometry) {
    if (pausedPlanet?.slug === entry.collection.slug) {
      return pausedPlanet.angle;
    }

    return geometry.phase + (now / geometry.duration) * 360;
  }

  function pausePlanet(entry: CollectionSummary, geometry: OrbitGeometry) {
    setPausedPlanet({ slug: entry.collection.slug, angle: currentAngle(entry, geometry) });
  }

  function planetPoint(angle: number, geometry: OrbitGeometry, trailStep = 0) {
    const radians = (angle * Math.PI) / 180;
    return {
      x: orbitCenter.x - trailStep * 0.72 + Math.cos(radians) * geometry.rx,
      y:
        orbitCenter.y +
        Math.sin(radians) * geometry.ry +
        Math.sin(((angle + trailStep * 14) * Math.PI) / 180) * trailStep * 0.09,
    };
  }

  function trailPath(entry: CollectionSummary, geometry: OrbitGeometry) {
    const headAngle = currentAngle(entry, geometry);
    return Array.from({ length: 58 }, (_, step) => {
      const pastSeconds = step * 1.85;
      const angle = headAngle - (pastSeconds / geometry.duration) * 360;
      const point = planetPoint(angle, geometry, step);
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    }).join(" ");
  }

  function landOnCollection(entry: CollectionSummary) {
    setSelected(entry);
    window.setTimeout(() => {
      router.push(`/collections/${entry.collection.slug}`);
    }, 3450);
  }

  return (
    <section className={`orbitHero ${selected ? "isLanding" : ""}`} aria-label="MCV rarity collection selector">
      <div className="starField" aria-hidden="true" />
      <div className="nebula nebulaOne" aria-hidden="true" />
      <div className="nebula nebulaTwo" aria-hidden="true" />

      <div className="orbitCopy">
        <p className="eyebrow">Mars Cats Voyage Rarity Hub</p>
        <h1>Choose a collection. Drop into the rarity table.</h1>
        <p className="lede">
          Real imported rarity data for the MCV ecosystem, ranked across traits, trait counts, listings, and collection-specific scoring rules.
        </p>
      </div>

      <div className="orbitStage">
        <div className="solarMist" aria-hidden="true" />
        <svg className="sunTrajectory" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M -34 66 C -10 62 10 58 28 54.5 C 38 52.7 45 52.2 50 53" pathLength="1" />
        </svg>
        <svg className="orbitTrails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {planetGeometry.map(({ entry, geometry }) => (
            <polyline
              key={`trail-${entry.collection.slug}`}
              points={trailPath(entry, geometry)}
              pathLength="1"
            />
          ))}
        </svg>

        {center && (
          <button className="centerLogo logoButton" type="button" onClick={() => landOnCollection(center)}>
            <Image src={logoMap[center.collection.slug]} alt="" fill sizes="188px" priority />
            <span>{center.collection.name}</span>
          </button>
        )}

        {planetGeometry.map(({ entry, geometry }, index) => {
          const angle = currentAngle(entry, geometry);
          const { x, y } = planetPoint(angle, geometry);
          const isBehindSun = y < orbitCenter.y;

          return (
            <button
              className={`orbitItem logoButton ${selected?.collection.slug === entry.collection.slug ? "isSelected" : ""}`}
              key={entry.collection.slug}
              type="button"
              aria-label={`Open ${entry.collection.name}`}
              onClick={() => landOnCollection(entry)}
              onMouseEnter={() => pausePlanet(entry, geometry)}
              onMouseLeave={() => setPausedPlanet(null)}
              onFocus={() => pausePlanet(entry, geometry)}
              onBlur={() => setPausedPlanet(null)}
              style={
                {
                  "--planet-x": `${x}%`,
                  "--planet-y": `${y}%`,
                  "--planet-size": `${geometry.size}px`,
                  "--planet-mobile-size": `${Math.max(68, geometry.size - 24)}px`,
                  "--planet-z": isBehindSun ? 2 : 6 + index,
                  "--planet-texture": `url(${logoMap[entry.collection.slug]})`,
                  "--planet-base": planetBaseMap[entry.collection.slug] ?? "#101722",
                } as CSSProperties
              }
            >
              <span className="orbitLogo">
                <span className="planetSurface" aria-hidden="true" />
              </span>
              <AtomizedText text={entry.collection.name} className="planetHoverName" />
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="landingOverlay" aria-hidden="true">
          <div className="landingPlanet">
            <span className="landingPlanetShell">
              <Image src={logoMap[selected.collection.slug]} alt="" fill sizes="560px" />
            </span>
          </div>
          <AtomizedText text={selected.collection.name} className="landingTitle" />
          <span className="landingShockwave" />
          <span className="landingStreak landingStreakOne" />
          <span className="landingStreak landingStreakTwo" />
          <span className="landingStreak landingStreakThree" />
        </div>
      )}
    </section>
  );
}
