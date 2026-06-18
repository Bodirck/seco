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
 * coordinates. Uses a CircleMarker (no image assets) to avoid the well-known Leaflet
 * marker-icon bundling issue with Vite. Scroll-zoom is off so the map never traps the
 * page scroll.
 */
export default function LocatorMap({ lat, lon, name, emptyLabel }: Props) {
  if (lat == null || lon == null) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  const pos: [number, number] = [lat, lon];

  return (
    <div className="h-[220px] overflow-hidden rounded-lg border border-slate-200">
      <MapContainer
        center={pos}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <CircleMarker
          center={pos}
          radius={9}
          pathOptions={{
            color: "#2563eb",
            weight: 2,
            fillColor: "#3b82f6",
            fillOpacity: 0.5,
          }}
        >
          <LeafletTooltip>{name}</LeafletTooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
