import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LocationPicker({ position, onConfirm, onSelect, onLocationStatus, busy = false }) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const initialPoint = position
    ? { lat: Number(position.latitude), lng: Number(position.longitude) }
    : null;
  const selectedRef = useRef(initialPoint);
  const onConfirmRef = useRef(onConfirm);
  const onSelectRef = useRef(onSelect);
  const onLocationStatusRef = useRef(onLocationStatus);
  const busyRef = useRef(busy);
  const [selected, setSelected] = useState(initialPoint);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
    onSelectRef.current = onSelect;
    onLocationStatusRef.current = onLocationStatus;
    busyRef.current = busy;
    if (markerRef.current) {
      if (busy) markerRef.current.dragging.disable();
      else markerRef.current.dragging.enable();
    }
  }, [busy, onConfirm, onSelect]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return undefined;
    let active = true;
    let selectedByUser = false;

    const start = selectedRef.current;
    const map = L.map(mapElement.current, { scrollWheelZoom: true })
      .setView(start ? [start.lat, start.lng] : [20.5937, 78.9629], start ? 17 : 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
    }).addTo(map);

    const pin = L.divIcon({
      className: 'infra-alert-map-pin',
      html: '<span aria-hidden="true"></span>',
      iconSize: [26, 30],
      iconAnchor: [13, 29]
    });
    const addMarker = (point) => {
      if (!markerRef.current) {
        markerRef.current = L.marker([point.lat, point.lng], { draggable: !busyRef.current, icon: pin }).addTo(map);
        markerRef.current.bindTooltip('Drag this pin to the exact complaint location');
        markerRef.current.on('dragend', () => {
          if (!busyRef.current) selectPoint(markerRef.current.getLatLng());
        });
      }
      markerRef.current.setLatLng([point.lat, point.lng]);
    };

    const selectPoint = (point) => {
      selectedByUser = true;
      const next = { lat: Number(point.lat), lng: Number(point.lng) };
      selectedRef.current = next;
      setSelected(next);
      addMarker(next);
      onSelectRef.current?.({ latitude: next.lat, longitude: next.lng });
    };
    if (start) addMarker(start);
    map.on('click', (event) => {
      if (!busyRef.current) selectPoint(event.latlng);
    });
    if (!start && navigator.geolocation) {
      onLocationStatusRef.current?.('Finding your current device location…');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!active || !mapRef.current || selectedByUser) return;
          const point = { lat: position.coords.latitude, lng: position.coords.longitude };
          selectedRef.current = point;
          setSelected(point);
          addMarker(point);
          map.setView([point.lat, point.lng], 17);
          onLocationStatusRef.current?.('Map centered on your device location. Adjust the pin if needed, then confirm it.');
        },
        () => {
          if (active) onLocationStatusRef.current?.('Could not access device location. Pan and zoom the map to place the pin manually.');
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    } else if (!start) {
      onLocationStatusRef.current?.('Device location is unavailable. Pan and zoom the map to place the pin manually.');
    }

    mapRef.current = map;
    const resizeId = window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      active = false;
      window.clearTimeout(resizeId);
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  return <section className="location-picker" aria-label="Adjust complaint location on map">
    <p className="location-picker-heading"><strong>Pin the complaint location on the map</strong></p>
    <p className="location-picker-help">The map first tries your device location. Adjust it by zooming and panning, clicking the exact spot, or dragging the pin. Confirm the pin to look up its address; coordinates identify the selected point.</p>
    <div className="location-picker-map" ref={mapElement} role="application" aria-label="Map to select complaint location" />
    {selected
      ? <p className="location-picker-coordinates">Selected point: {selected.lat.toFixed(7)}, {selected.lng.toFixed(7)}</p>
      : <p className="location-picker-coordinates">No point selected. Click the map to place a pin.</p>}
    <button type="button" className="button button-secondary location-button location-confirm-button" disabled={!selected || busy} onClick={() => onConfirmRef.current?.({ latitude: selectedRef.current.lat, longitude: selectedRef.current.lng })}>
      {busy ? 'Looking Up Address…' : 'Use This Pin and Look Up Address'}
    </button>
    <p className="location-picker-attribution">Map data &copy; OpenStreetMap contributors.</p>
  </section>;
}
