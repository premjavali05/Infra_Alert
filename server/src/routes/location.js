import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { query } from '../db.js';

const router = Router();
const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
const OSM_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1';
const cache = new Map();
let requestQueue = Promise.resolve();
let lastNominatimRequestAt = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cacheKey(latitude, longitude) {
  // Round coordinates enough to cache repeated clicks at roughly the same location.
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

async function reverseWithNominatim(latitude, longitude) {
  const key = cacheKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { address: cached.address, addressDetails: cached.addressDetails || null };

  // Nominatim's public server asks applications to remain at or below 1 request/second.
  // Queue requests in this server process, and cache results to limit repeated calls.
  const task = requestQueue.then(async () => {
    const elapsed = Date.now() - lastNominatimRequestAt;
    if (elapsed < 1100) await wait(1100 - elapsed);
    lastNominatimRequestAt = Date.now();

    const url = new URL(NOMINATIM_ENDPOINT);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18');

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Infra-Alert/1.0 (local civic grievance reporting application)',
        'Referer': process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173/'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Nominatim returned HTTP ${response.status}.`);
    const data = await response.json();
    const raw = data?.address || {};
    const addressDetails = {
      building: raw.building || raw.house_name || '',
      houseNumber: raw.house_number || '',
      road: raw.road || raw.residential || raw.pedestrian || raw.footway || '',
      neighbourhood: raw.neighbourhood || raw.quarter || '',
      suburb: raw.suburb || raw.city_district || raw.district || '',
      city: raw.city || raw.town || raw.village || raw.municipality || raw.hamlet || '',
      town: raw.town || '',
      village: raw.village || '',
      locality: raw.locality || '',
      district: raw.state_district || raw.district || raw.county || raw.city_district || '',
      state: raw.state || '',
      postcode: raw.postcode || '',
      country: raw.country || '',
      countryCode: raw.country_code || ''
    };
    const address = data?.display_name || [
      addressDetails.building, addressDetails.houseNumber, addressDetails.road,
      addressDetails.neighbourhood, addressDetails.suburb, addressDetails.city,
      addressDetails.district, addressDetails.state, addressDetails.postcode, addressDetails.country
    ].filter(Boolean).join(', ') || null;
    const result = { address, addressDetails };
    cache.set(key, { ...result, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    // Bound in-memory cache growth for long-running development sessions.
    if (cache.size > 1000) cache.delete(cache.keys().next().value);
    return result;
  });
  requestQueue = task.catch(() => {});
  return task;
}

async function reverseWithGoMaps(latitude, longitude, key) {
  const url = new URL('https://maps.gomaps.pro/maps/api/geocode/json');
  url.searchParams.set('latlng', `${latitude},${longitude}`);
  url.searchParams.set('key', key);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`GoMaps returned HTTP ${response.status}.`);
  const data = await response.json();
  if (data?.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) {
    throw new Error(`GoMaps geocoding status: ${data.status}.`);
  }
  const result = data?.results?.[0];
  if (!result) return { address: null, addressDetails: null };
  const components = result.address_components || [];
  const get = (...types) => components.find(component => types.some(type => component.types.includes(type)))?.long_name || '';
  return {
    address: result.formatted_address || null,
    addressDetails: {
      building: get('premise'), houseNumber: get('street_number'), road: get('route'),
      neighbourhood: get('neighborhood'), suburb: get('sublocality', 'sublocality_level_1'),
      city: get('locality', 'postal_town'), town: get('postal_town'), village: '',
      locality: get('sublocality'), district: get('administrative_area_level_2'),
      state: get('administrative_area_level_1'), postcode: get('postal_code'),
      country: get('country'), countryCode: components.find(c => c.types.includes('country'))?.short_name || ''
    }
  };
}

function normalizeLocationIqAddress(raw = {}) {
  return {
    building: raw.building || raw.name || '',
    houseNumber: raw.house_number || '',
    road: raw.road || '',
    neighbourhood: raw.neighbourhood || '',
    suburb: raw.suburb || '',
    city: raw.city || raw.city_district || '',
    town: raw.city || '',
    village: '',
    locality: raw.city_district || '',
    district: raw.county || raw.state_district || '',
    state: raw.state || '',
    postcode: raw.postcode || '',
    country: raw.country || '',
    countryCode: raw.country_code || ''
  };
}

async function locationIqRequest(path, params, key) {
  const url = new URL(`${LOCATIONIQ_BASE_URL}/${path}`);
  url.searchParams.set('key', key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.error || `LocationIQ returned HTTP ${response.status}.`;
    throw new Error(detail);
  }
  return data;
}

async function reverseWithLocationIq(latitude, longitude, key) {
  const data = await locationIqRequest('reverse', {
    lat: latitude,
    lon: longitude,
    format: 'json',
    addressdetails: 1,
    normalizeaddress: 1
  }, key);
  return {
    address: data?.display_name || null,
    addressDetails: normalizeLocationIqAddress(data?.address)
  };
}

async function geocodeWithLocationIq(address, key) {
  const data = await locationIqRequest('search', {
    q: address,
    format: 'json',
    addressdetails: 1,
    normalizeaddress: 1,
    limit: 1,
    countrycodes: 'in'
  }, key);
  const result = Array.isArray(data) ? data[0] : null;
  if (!result) return null;
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    address: result.display_name || address
  };
}

async function routeWithLocationIq(origin, destination, key) {
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const data = await locationIqRequest(`directions/driving/${coordinates}`, {
    geometries: 'geojson',
    overview: 'full',
    steps: true
  }, key);
  if (data?.code !== 'Ok' || !Array.isArray(data.routes) || !data.routes.length) {
    throw new Error(data?.message || 'LocationIQ could not find a driving route between these points.');
  }
  const route = data.routes[0];
  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
    steps: (route.legs || []).flatMap(leg => leg.steps || []).map(step => ({
      instruction: step.maneuver?.instruction || step.name || '',
      distance: step.distance,
      duration: step.duration
    }))
  };
}

router.post('/reverse-geocode', requireRole('citizen'), async (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  }

  const configuredProvider = String(process.env.GEOCODING_PROVIDER || '').toLowerCase();
  const mapsKey = process.env.GEOCODING_API_KEY;
  const locationIqKey = process.env.LOCATIONIQ_API_KEY;
  const provider = configuredProvider || (locationIqKey ? 'locationiq' : mapsKey ? 'gomaps' : 'nominatim');

  if (provider === 'none') return res.json({ address: null, configured: false, provider: 'none' });

  try {
    if (provider === 'gomaps') {
      if (!mapsKey) return res.json({ address: null, configured: false, provider: 'gomaps' });
      const result = await reverseWithGoMaps(latitude, longitude, mapsKey);
      return res.json({ ...result, configured: true, provider: 'gomaps' });
    }

    if (provider === 'locationiq') {
      if (!locationIqKey) return res.status(503).json({ error: 'LocationIQ is selected but LOCATIONIQ_API_KEY is not configured on the server.' });
      const result = await reverseWithLocationIq(latitude, longitude, locationIqKey);
      return res.json({
        ...result,
        configured: true,
        provider: 'locationiq',
        attribution: 'LocationIQ',
        attributionUrl: 'https://locationiq.com/attribution'
      });
    }

    if (provider === 'nominatim') {
      const result = await reverseWithNominatim(latitude, longitude);
      return res.json({
        ...result,
        configured: true,
        provider: 'nominatim',
        attribution: OSM_ATTRIBUTION,
        attributionUrl: OSM_ATTRIBUTION_URL
      });
    }

    return res.status(500).json({ error: 'Unsupported GEOCODING_PROVIDER. Use locationiq, nominatim, gomaps, or none.' });
  } catch (error) {
    console.error('[location] Reverse geocoding failed:', error.message);
    return res.status(502).json({ error: 'Location coordinates were captured, but the address could not be resolved. The coordinates can still be saved.' });
  }
});

router.post('/directions', requireRole('authority'), async (req, res) => {
  const cid = String(req.body.cid || '').trim();
  const originAddress = String(req.body.originAddress || '').trim();
  const hasLatitude = req.body.originLatitude !== '' && req.body.originLatitude != null;
  const hasLongitude = req.body.originLongitude !== '' && req.body.originLongitude != null;
  if (!cid || (!originAddress && !(hasLatitude && hasLongitude))) {
    return res.status(400).json({ error: 'Complaint ID and either a starting address or both starting coordinates are required.' });
  }
  if (originAddress.length > 300) return res.status(400).json({ error: 'The starting address must be 300 characters or fewer.' });
  if (hasLatitude !== hasLongitude) return res.status(400).json({ error: 'Enter both starting latitude and longitude.' });

  const key = process.env.LOCATIONIQ_API_KEY;
  if (!key) return res.status(503).json({ error: 'LocationIQ directions are unavailable until LOCATIONIQ_API_KEY is configured on the server.' });

  try {
    const complaintResult = await query(
      `SELECT c.cid, c.category, c.dept, c.state, c.city, l.latitude, l.longitude, l.address
       FROM complaint c
       LEFT JOIN LATERAL (
         SELECT latitude, longitude, address FROM save_location
         WHERE pno = c.phno AND img_url = c.img_url
         LIMIT 1
       ) l ON true
       WHERE c.cid = $1`,
      [cid]
    );
    const complaint = complaintResult.rows[0];
    if (!complaint) return res.status(404).json({ error: 'Complaint not found in your department scope.' });
    const user = req.session.user;
    if (complaint.category !== user.category || complaint.dept !== user.department || complaint.state !== user.state || complaint.city !== user.city) {
      return res.status(404).json({ error: 'Complaint not found in your department scope.' });
    }
    const destination = {
      latitude: Number(complaint.latitude),
      longitude: Number(complaint.longitude)
    };
    if (!Number.isFinite(destination.latitude) || !Number.isFinite(destination.longitude)) {
      return res.status(409).json({ error: 'This complaint has no saved map coordinates for routing.' });
    }

    let origin;
    if (hasLatitude && hasLongitude) {
      const latitude = Number(req.body.originLatitude);
      const longitude = Number(req.body.originLongitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return res.status(400).json({ error: 'Enter valid starting coordinates.' });
      }
      origin = { latitude, longitude, address: 'Manually entered coordinates' };
    } else {
      origin = await geocodeWithLocationIq(originAddress, key);
      if (!origin) return res.status(422).json({ error: 'LocationIQ could not find the authority starting address. Try a more specific address.' });
    }
    const route = await routeWithLocationIq(origin, destination, key);
    return res.json({
      origin,
      destination: {
        latitude: destination.latitude,
        longitude: destination.longitude,
        address: complaint.address || `${complaint.city}, ${complaint.state}`
      },
      ...route,
      provider: 'locationiq',
      attribution: '© LocationIQ © OpenStreetMap contributors',
      attributionUrl: 'https://locationiq.com/attribution'
    });
  } catch (error) {
    console.error('[location] Directions request failed:', error.message);
    return res.status(502).json({ error: 'Directions could not be generated. Verify the starting address and try again.' });
  }
});

export default router;
