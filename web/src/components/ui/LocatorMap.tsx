import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip as LeafletTooltip,
} from "react-leaflet";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  lat: number | null;
  lon: number | null;
  name: string;
  emptyLabel: string;
}

/**
 * A small read-only locator map placing the building in Luxembourg from its public
 * coordinates. The CARTO basemap and marker follow the active theme (dark or light),
 * and a CircleMarker (no image assets) avoids the Leaflet marker-icon bundling issue
 * with Vite. Scroll-zoom is off so the map never traps the page scroll.
 */
export default function LocatorMap({ lat, lon, name, emptyLabel }: Props) {
  const { theme } = useTheme();

  if (lat == null || lon == null) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-line bg-ink-800 px-4 text-center text-sm text-fg-faint">
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
  const mapBg = isLight ? "#FFFFFF" : "#090D17";

  return (
    <div className="h-[220px] overflow-hidden rounded-lg border border-line">
      <MapContainer
        key={theme}
        center={pos}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: mapBg }}
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <CircleMarker
          center={pos}
          radius={9}
          pathOptions={{
            color: markerColor,
            weight: 2,
            fillColor: markerColor,
            fillOpacity: 0.35,
          }}
        >
          <LeafletTooltip>{name}</LeafletTooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
