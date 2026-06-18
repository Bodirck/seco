import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip as LeafletTooltip,
} from "react-leaflet";

interface Props {
  lat: number | null;
  lon: number | null;
  name: string;
  emptyLabel: string;
}

/**
 * A small read-only locator map placing the building in Luxembourg from its public
 * coordinates. Dark CARTO basemap to fit the First Light theme, and a CircleMarker
 * (no image assets) to avoid the Leaflet marker-icon bundling issue with Vite.
 * Scroll-zoom is off so the map never traps the page scroll.
 */
export default function LocatorMap({ lat, lon, name, emptyLabel }: Props) {
  if (lat == null || lon == null) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-line bg-ink-800 px-4 text-center text-sm text-fg-faint">
        {emptyLabel}
      </div>
    );
  }

  const pos: [number, number] = [lat, lon];

  return (
    <div className="h-[220px] overflow-hidden rounded-lg border border-line">
      <MapContainer
        center={pos}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: "#090D17" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <CircleMarker
          center={pos}
          radius={9}
          pathOptions={{
            color: "#22D3EE",
            weight: 2,
            fillColor: "#22D3EE",
            fillOpacity: 0.35,
          }}
        >
          <LeafletTooltip>{name}</LeafletTooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
