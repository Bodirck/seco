import { useEffect, useRef, useState, type ReactNode } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "../../lib/cn";

interface Props {
  lat: number | null;
  lon: number | null;
  name: string;
  className?: string;
  /** Shown when there are no coordinates or the 3D map fails to load. */
  fallback?: ReactNode;
}

// OpenFreeMap "fiord" style: free, no API key, with 3D building extrusions. The
// map shows the real OSM building stock around the coordinates; the pitch makes
// them stand up. Attribution is added automatically by MapLibre.
const STYLE_URL = "https://tiles.openfreemap.org/styles/fiord";

/**
 * A tilted 3D view of the building's surroundings, from the real coordinates we
 * already store. It is a true map of the OSM building stock at that location (we
 * do not store the exact footprint polygon), so it reads as a 3D massing of the
 * block. Degrades to the stylized scan frame if the tiles fail to load.
 *
 * The map mounts into a directly-sized container (not an absolutely-positioned
 * one) and calls resize() on load, so it renders reliably even under React 18
 * StrictMode's mount, unmount, remount cycle in development.
 */
export default function Building3D({ lat, lon, name, className, fallback = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (el == null || lat == null || lon == null) return;

    let map: maplibregl.Map | null = null;
    try {
      map = new maplibregl.Map({
        container: el,
        style: STYLE_URL,
        center: [lon, lat],
        zoom: 16.5,
        pitch: 55,
        bearing: -20,
      });
      const m = map;
      m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      m.on("load", () => {
        m.resize();
        new maplibregl.Marker({ color: "#ff8a3d" }).setLngLat([lon, lat]).addTo(m);
      });
      m.on("error", (e) => {
        // A tile or style network failure should degrade to the fallback, not a
        // blank panel. Log it so it is diagnosable from the console.
        console.error("Building3D map error:", (e as { error?: unknown }).error ?? e);
        setFailed(true);
      });
    } catch (err) {
      console.error("Building3D init failed:", err);
      setFailed(true);
    }

    return () => {
      map?.remove();
    };
  }, [lat, lon]);

  if (lat == null || lon == null || failed) return <>{fallback}</>;

  return (
    <div
      ref={containerRef}
      aria-label={`3D view around ${name}`}
      className={cn("overflow-hidden rounded-sm border border-line bg-ink-800", className)}
    />
  );
}
