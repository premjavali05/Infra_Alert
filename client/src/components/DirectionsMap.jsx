import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function DirectionsMap({ route }) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return undefined;
    const map = L.map(mapElement.current, { scrollWheelZoom: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
    }).addTo(map);
    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layersRef.current || !route?.geometry?.coordinates?.length) return;
    const layerGroup = layersRef.current;
    layerGroup.clearLayers();
    const routeLayer = L.geoJSON(route.geometry, {
      style: { color: '#0F766E', weight: 6, opacity: 0.85 }
    }).addTo(layerGroup);
    const origin = L.circleMarker([route.origin.latitude, route.origin.longitude], {
      radius: 8, color: '#fff', weight: 2, fillColor: '#15803D', fillOpacity: 1
    }).bindTooltip('Authority starting point').addTo(layerGroup);
    const destination = L.circleMarker([route.destination.latitude, route.destination.longitude], {
      radius: 8, color: '#fff', weight: 2, fillColor: '#B91C1C', fillOpacity: 1
    }).bindTooltip('Complaint location').addTo(layerGroup);
    const bounds = routeLayer.getBounds().extend(origin.getLatLng()).extend(destination.getLatLng());
    mapRef.current.fitBounds(bounds, { padding: [28, 28] });
    window.setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [route]);

  return <div className="directions-map" ref={mapElement} role="application" aria-label="Driving route to complaint location" />;
}
