import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { NEIGHBORHOOD } from "./data.js";

const APPROX_LATLNG = [47.66780, -122.36430];
const APPROX_RADIUS_M = 200;

const HOUSE_PIN_SVG = `
<svg width="44" height="54" viewBox="0 0 44 54" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="ds" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
    </filter>
  </defs>
  <path d="M22 2 C11 2 2 11 2 22 C2 35 22 52 22 52 C22 52 42 35 42 22 C42 11 33 2 22 2 Z"
        fill="#2F4A3A" stroke="white" stroke-width="2.5" filter="url(#ds)"/>
  <path d="M22 13 L13 21 L13 31 L19 31 L19 25 L25 25 L25 31 L31 31 L31 21 Z"
        fill="white"/>
</svg>`;

const numberedPin = (n) => `
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="ds${n}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.3"/>
    </filter>
  </defs>
  <circle cx="16" cy="16" r="13" fill="white" stroke="#2F4A3A" stroke-width="2" filter="url(#ds${n})"/>
  <text x="16" y="20" font-family="Inter, sans-serif" font-size="12" font-weight="600"
        text-anchor="middle" fill="#2F4A3A">${n}</text>
</svg>`;

export default function MapPanel() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    L.circle(APPROX_LATLNG, {
      radius: APPROX_RADIUS_M,
      color: "#2F4A3A",
      weight: 0,
      fillColor: "#2F4A3A",
      fillOpacity: 0.14,
    }).addTo(map);

    const houseIcon = L.divIcon({
      className: "townhouse-pin",
      html: HOUSE_PIN_SVG,
      iconSize: [44, 54],
      iconAnchor: [22, 52],
    });
    L.marker(APPROX_LATLNG, { icon: houseIcon, interactive: false, zIndexOffset: 1000 }).addTo(map);

    const allPoints = [APPROX_LATLNG];
    NEIGHBORHOOD.forEach((p, i) => {
      const num = String(i + 1).padStart(2, "0");
      const icon = L.divIcon({
        className: "neighborhood-pin",
        html: numberedPin(num),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([p.lat, p.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div class="map-popup"><div class="map-popup-title">${p.name}</div><div class="map-popup-meta">${p.type} · ${p.dist}</div></div>`,
          { closeButton: false, offset: [0, -8] }
        );
      allPoints.push([p.lat, p.lng]);
    });

    map.fitBounds(allPoints, { padding: [40, 40] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <>
      <div ref={containerRef} className="map-leaflet" />
      <div className="map-disclosure">Approximate location. Exact address provided after booking.</div>
    </>
  );
}
