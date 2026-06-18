import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip as LeafletTooltip,
} from "react-leaflet";
import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  lat: number | null;
  lon: number | null;
  name: string;
  emptyLabel: string;
  /** Leaflet zoom. Lower shows more of the country; default frames the region. */
  zoom?: number;
  /** Wrapper classes; pass a height (e.g. "h-[300px]"). Defaults to h-[220px]. */
  className?: string;
}

/**
 * A stylized read-only locator map placing the building in Luxembourg from its
 * public coordinates. Dark or light CARTO basemap follows the theme, and a
 * CircleMarker (no image assets) avoids the Leaflet marker-icon bundling issue with
 * Vite. Scroll-zoom is off so the map never traps the page scroll.
 */
export default function LocatorMap({
  lat,
  lon,
  name,
  emptyLabel,
  zoom = 11,
  className,
}: Props) {
  const { theme } = useTheme();
  const box = cn(
    "overflow-hidden rounded-sm border border-line",
    className ?? "h-[220px]",
  );

  if (lat == null || lon == null) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-ink-800 px-4 text-center text-sm text-fg-faint",
          box,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  const pos: [number, number] = [lat, lon];
  const isLight = theme === "light";
  const tileUrl = isLight
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const markerColor = isLight ? "#E66E00" : "#FF7A00";
  const mapBg = isLight ? "#FFFFFF" : "#0A0E1A";

  return (
    <div className={box}>
      <MapContainer
        key={theme}
        center={pos}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: mapBg }}
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <CircleMarker
          center={pos}
          radius={8}
          pathOptions={{
            color: markerColor,
            weight: 2,
            fillColor: markerColor,
            fillOpacity: 0.45,
          }}
        >
          <LeafletTooltip>{name}</LeafletTooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
