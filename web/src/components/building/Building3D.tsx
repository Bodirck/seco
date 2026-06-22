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

// OpenFreeMap "fiord" style: free, no API key, with 3D building extrusions baked
// in. The map shows the real OSM building shapes around the coordinates; tilting
// (pitch) makes them stand up. Attribution is added automatically by MapLibre.
const STYLE_URL = "https://tiles.openfreemap.org/styles/fiord";

/**
 * A tilted 3D view of the building's surroundings, using the real coordinates we
 * already store. It is a true map of the OSM building stock at that location, not
 * the exact footprint (we do not store the polygon), so it reads as a 3D massing
 * of the block. Degrades to the stylized scan frame if the tiles fail to load.
 */
export default function Building3D({ lat, lon, name, className, fallback = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (lat == null || lon == null || !containerRef.current) return;

    let map: maplibregl.Map | null = null;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [lon, lat],
        zoom: 16.5,
        pitch: 55,
        bearing: -20,
      });
      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "top-right",
      );
      const marker = new maplibregl.Marker({ color: "#ff8a3d" }).setLngLat([lon, lat]);
      map.on("load", () => {
        map?.resize();
        if (map) marker.addTo(map);
      });
      // A tile or style network failure should degrade to the fallback, not leave
      // a blank panel. Only react to genuine load errors.
      map.on("error", (e) => {
        if (e && (e as { error?: unknown }).error) setFailed(true);
      });
    } catch {
      setFailed(true);
    }

    return () => {
      map?.remove();
    };
  }, [lat, lon]);

  if (lat == null || lon == null) return <>{fallback}</>;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        aria-label={`3D view around ${name}`}
        className="absolute inset-0 overflow-hidden rounded-sm border border-line bg-ink-800"
      />
      {failed && <div className="absolute inset-0">{fallback}</div>}
    </div>
  );
}
