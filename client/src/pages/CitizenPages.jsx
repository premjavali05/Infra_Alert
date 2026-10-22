import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, categoryLabel } from '../api';
import { Alert, UserNavbar, StatusBadge } from '../components/Shared';
import { departments } from '../data/departments';
import LocationPicker from '../components/LocationPicker';

const STATES = [
  ['AP','Andhra Pradesh'],['AR','Arunachal Pradesh'],['AS','Assam'],['BR','Bihar'],['CG','Chhattisgarh'],['GA','Goa'],['GJ','Gujarat'],['HR','Haryana'],['HP','Himachal Pradesh'],['JK','Jammu and Kashmir'],['JH','Jharkhand'],['KA','Karnataka'],['KL','Kerala'],['MP','Madhya Pradesh'],['MH','Maharashtra'],['MN','Manipur'],['ML','Meghalaya'],['MZ','Mizoram'],['NL','Nagaland'],['OD','Odisha'],['PB','Punjab'],['RJ','Rajasthan'],['SK','Sikkim'],['TN','Tamil Nadu'],['TS','Telangana'],['TR','Tripura'],['UK','Uttarakhand'],['UP','Uttar Pradesh'],['WB','West Bengal'],['AN','Andaman and Nicobar Islands'],['CH','Chandigarh'],['DN','Dadra and Nagar Haveli'],['DD','Daman and Diu'],['DL','Delhi'],['LD','Lakshadweep'],['PY','Puducherry']
];

const categories = [
  { id: 'home_electricity', title: 'Home electricity', image: '/media/home.jpg', icon: 'ri-flashlight-line', description: 'Electricity concerns at home' },
  { id: 'street_lights', title: 'Street lights', image: '/media/street.jpg', icon: 'ri-lightbulb-line', description: 'Street lighting and fixtures' },
  { id: 'potholes', title: 'Potholes', image: '/media/pothole.jpg', icon: 'ri-road-map-line', description: 'Road damage and potholes' },
  { id: 'garbage', title: 'Garbage', image: '/media/garbage1.jpg', icon: 'ri-recycle-line', description: 'Garbage collection and disposal' }
];

export function CitizenHome() {
  const [name, setName] = useState('');
  useEffect(() => { api('/auth/me').then(r => setName(r.user?.name || '')).catch(() => {}); }, []);

  return <div className="app-page citizen-home">
    <UserNavbar />
    <main className="page-container app-main">
      <section className="welcome-panel">
        <div><span className="section-kicker">Resident workspace</span><h1>{name ? `Welcome, ${name}` : 'Report a local concern'}</h1><p>Choose a category to start a complaint. You can add details, supporting evidence, and a confirmed map location in the next step.</p></div>
        <Link className="button button-primary" to="/dashboard"><i className="ri-file-list-3-line" aria-hidden="true" /> View complaint history</Link>
      </section>
      <div className="section-heading dashboard-section-heading"><div><span className="section-kicker">Start a report</span><h2>What needs attention?</h2></div><p>Select the category that best describes the issue.</p></div>
      <div className="category-grid">
        {categories.map((category) => <article className="category-card" key={category.id}>
          <Link to={`/complaint?category=${category.id}`} className="category-card-link" aria-label={`Raise a ${category.title} complaint`}>
            <div className="category-image"><img src={category.image} alt="" /><span className="category-icon"><i className={category.icon} aria-hidden="true" /></span></div>
            <div className="category-card-body"><span className="category-description">{category.description}</span><h3>{category.title}</h3><span className="category-action">Raise complaint <i className="ri-arrow-right-line" aria-hidden="true" /></span></div>
          </Link>
        </article>)}
      </div>
      <div className="privacy-note"><i className="ri-information-line" aria-hidden="true" /><p>Choose the map location carefully and include clear details so your report can be reviewed.</p></div>
    </main>
  </div>;
}

export function ComplaintForm() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const requestedCategory = search.get('category');
  const categoryFromUrl = categories.some(category => category.id === requestedCategory) ? requestedCategory : '';
  const [form, setForm] = useState({ name: '', date: '', state: '', category: categoryFromUrl, dept: '', city: '', district: '', description: '' });
  const [coordinates, setCoordinates] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationAttribution, setLocationAttribution] = useState(null);
  const [addressReviewed, setAddressReviewed] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => departments?.[form.category]?.[form.state] || [], [form.category, form.state]);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function change(field, value) {
    setForm(old => ({ ...old, [field]: value, ...(field === 'state' || field === 'category' ? { dept: '' } : {}) }));
  }

  async function confirmMapLocation(point) {
    const loc = {
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      accuracy: null,
      manual: true,
      address: null,
      addressDetails: null
    };
    setLocationStatus('capturing');
    setLocationMessage('Confirming the selected map point and looking up its address…');
    setLocationAttribution(null);
    setAddressReviewed(false);

    let addressResolved = false;
    let lookupError = null;
    try {
      const resolved = await api('/location/reverse-geocode', {
        method: 'POST',
        body: { latitude: loc.latitude, longitude: loc.longitude }
      });
      if (resolved.address) {
        loc.address = resolved.address;
        addressResolved = true;
      }
      loc.addressDetails = resolved.addressDetails || null;
      if (resolved.attribution && resolved.attributionUrl) {
        setLocationAttribution({ text: resolved.attribution, url: resolved.attributionUrl });
      }
    } catch (error) {
      lookupError = error;
    }

    setCoordinates(loc);
    setLocationStatus(addressResolved ? 'resolved' : 'captured');
    setLocationMessage(addressResolved
      ? 'Map pin confirmed. Review the provider address below against the map; the pin coordinates remain the precise location.'
      : `${lookupError ? `${lookupError.message} ` : 'No address was returned. '}The coordinates are retained and no guessed address will be used.`);
  }

  async function submit(e) {
    e.preventDefault(); setMessage('');
    if (!coordinates) { setMessage('Select and confirm the complaint location on the map.'); return; }
    if (coordinates.address && !addressReviewed) { setMessage('Review the address suggestion against the map before submitting.'); return; }
    if (!file) { setMessage('Please upload a photo or PDF related to the complaint.'); return; }
    setBusy(true);
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    data.append('img_url', file);
    data.append('formData', JSON.stringify(coordinates ? [coordinates] : []));
    try { await api('/complaints', { method: 'POST', body: data }); navigate('/dashboard', { state: { message: 'Complaint submitted successfully.' } }); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return <div className="app-page complaint-page">
    <UserNavbar />
    <main className="page-container app-main narrow-main">
      <div className="page-breadcrumb"><Link to="/app">Resident workspace</Link><i className="ri-arrow-right-s-line" aria-hidden="true" /><span>New complaint</span></div>
      <section className="page-heading"><span className="section-kicker">Complaint submission</span><h1>Tell us what needs attention</h1><p>Provide the issue details and confirm its location on the map.</p></section>
      <form className="surface-card complaint-form" onSubmit={submit}>
        <section className="form-section">
          <div className="form-section-heading"><span className="step-number">01</span><div><h2>Complaint details</h2><p>Describe the issue and choose the responsible department.</p></div></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="name">Name <span className="required-mark">*</span></label><input id="name" name="name" autoComplete="name" value={form.name} onChange={e => change('name', e.target.value)} required /></div>
            <div className="form-field"><label htmlFor="date">Date <span className="required-mark">*</span></label><input id="date" name="date" type="date" value={form.date} onChange={e => change('date', e.target.value)} required /></div>
            <div className="form-field"><label htmlFor="state">State <span className="required-mark">*</span></label><select id="state" value={form.state} onChange={e => change('state', e.target.value)} required><option value="">Select state</option>{STATES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
            <div className="form-field"><label htmlFor="category">Category <span className="required-mark">*</span></label><select id="category" value={form.category} onChange={e => change('category', e.target.value)} required><option value="">Select a category</option>{categories.map(category => <option key={category.id} value={category.id}>{categoryLabel(category.id)}</option>)}</select><small>{form.category ? 'You can change the selected category before submitting.' : 'Choose the type of issue you are reporting.'}</small></div>
            <div className="form-field form-field-full"><label htmlFor="department">Department <span className="required-mark">*</span></label><select id="department" value={form.dept} onChange={e => change('dept', e.target.value)} required><option value="">Select department</option>{options.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div className="form-field"><label htmlFor="city">City <span className="required-mark">*</span></label><input id="city" autoComplete="address-level2" value={form.city} onChange={e => change('city', e.target.value)} required /></div>
            <div className="form-field"><label htmlFor="district">District <span className="required-mark">*</span></label><input id="district" autoComplete="address-level1" value={form.district} onChange={e => change('district', e.target.value)} required /></div>
            <div className="form-field form-field-full"><label htmlFor="description">Description <span className="required-mark">*</span></label><textarea id="description" rows="5" value={form.description} onChange={e => change('description', e.target.value)} required /><small>Include useful details that can help identify the concern.</small></div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-heading"><span className="step-number">02</span><div><h2>Confirm the location</h2><p>Place the pin at the exact point of the issue.</p></div></div>
          <LocationPicker
            position={coordinates}
            onConfirm={confirmMapLocation}
            onSelect={() => {
              setCoordinates(null);
              setLocationStatus('idle');
              setLocationAttribution(null);
              setAddressReviewed(false);
              setLocationMessage('Pin moved. Confirm it to look up the address for the newly selected point.');
            }}
            busy={locationStatus === 'capturing'}
          />
          {locationMessage && <p className={`location-note ${locationStatus === 'error' ? 'location-error' : ''}`} role="status">{locationMessage}</p>}
          {coordinates && <div className="location-details">
            <p className="location-note location-address"><strong>Address lookup for this pin (verify against the map):</strong> {coordinates.address || 'No address was returned.'}</p>
            {coordinates.addressDetails && <p className="location-note location-components">{[
              coordinates.addressDetails.building || coordinates.addressDetails.houseNumber,
              coordinates.addressDetails.road,
              coordinates.addressDetails.neighbourhood || coordinates.addressDetails.suburb,
              coordinates.addressDetails.city || coordinates.addressDetails.town || coordinates.addressDetails.village || coordinates.addressDetails.locality,
              coordinates.addressDetails.district,
              coordinates.addressDetails.state,
              coordinates.addressDetails.postcode,
              coordinates.addressDetails.country
            ].filter(Boolean).filter((part, index, parts) => parts.indexOf(part) === index).join(' · ')}</p>}
            <p className="location-note">Coordinates: {coordinates.latitude.toFixed(7)}, {coordinates.longitude.toFixed(7)}</p>
            <p className="location-note">The map pin coordinates identify the selected point. A mapped street address is a provider suggestion and can be incomplete or outdated.</p>
          </div>}
          {coordinates?.address && <label className="location-address-review"><input type="checkbox" checked={addressReviewed} onChange={e => setAddressReviewed(e.target.checked)} />I checked that this address suggestion matches the selected pin on the map.</label>}
          {locationAttribution && <p className="location-attribution">Address data: <a href={locationAttribution.url} target="_blank" rel="noreferrer">{locationAttribution.text}</a></p>}
        </section>

        <section className="form-section">
          <div className="form-section-heading"><span className="step-number">03</span><div><h2>Add supporting evidence</h2><p>Attach a photo that helps explain the issue.</p></div></div>
          <label className="upload-dropzone" htmlFor="img_url">
            <span className="upload-icon"><i className="ri-upload-cloud-2-line" aria-hidden="true" /></span>
            <span><strong>{file ? file.name : 'Choose a photo to upload'}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Image files accepted · Select a file from your device'}</small></span>
            <span className="button button-secondary upload-browse">Browse files</span>
            <input id="img_url" name="img_url" type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} required />
          </label>
          {previewUrl && <div className="evidence-preview"><img src={previewUrl} alt="Preview of the selected complaint evidence" /><span>Photo preview</span></div>}
        </section>

        <div className="form-actions"><Alert message={message} type={message.includes('successfully') ? 'success' : 'error'} /><button className="button button-primary" type="submit" name="submit" disabled={busy}>{busy ? 'Submitting complaint…' : 'Submit complaint'} <i className="ri-arrow-right-line" aria-hidden="true" /></button><span className="form-required-note"><span className="required-mark">*</span> Required fields</span></div>
      </form>
    </main>
  </div>;
}

export function CitizenDashboard() {
  const location = useLocation();
  const [complaints, setComplaints] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    api('/complaints/mine').then(data => { if (mounted) setComplaints(data.complaints || []); }).catch(err => { if (mounted) setError(err.message); }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [reloadCount]);

  const inProgressCount = complaints.filter(c => c.status === 'In Progress').length;
  const solvedCount = complaints.filter(c => c.status === 'Solved').length;

  return <div className="app-page dashboard-page">
    <UserNavbar />
    <main className="page-container app-main">
      <div className="page-heading dashboard-heading"><div><span className="section-kicker">Resident workspace</span><h1>Your complaint history</h1><p>Review submitted reports and follow their current status.</p></div><Link className="button button-primary" to="/app"><i className="ri-add-line" aria-hidden="true" /> New complaint</Link></div>
      {location.state?.message && <Alert message={location.state.message} type="success" />}
      {error && <div className="retry-row"><Alert message={error} /><button className="button button-secondary" type="button" onClick={() => setReloadCount(count => count + 1)}>Try again <i className="ri-refresh-line" aria-hidden="true" /></button></div>}
      {!loading && !error && <div className="metric-grid" aria-label="Complaint summary">
        <article className="metric-card"><span className="metric-icon metric-icon-navy"><i className="ri-file-list-3-line" aria-hidden="true" /></span><div><span>Total reports</span><strong>{complaints.length}</strong></div></article>
        <article className="metric-card"><span className="metric-icon metric-icon-amber"><i className="ri-time-line" aria-hidden="true" /></span><div><span>In progress</span><strong>{inProgressCount}</strong></div></article>
        <article className="metric-card"><span className="metric-icon metric-icon-green"><i className="ri-checkbox-circle-line" aria-hidden="true" /></span><div><span>Resolved</span><strong>{solvedCount}</strong></div></article>
      </div>}
      <section className="surface-card history-card">
        <div className="card-heading"><div><span className="section-kicker">Your reports</span><h2>Complaint history</h2></div><span className="record-count">{complaints.length} {complaints.length === 1 ? 'complaint' : 'complaints'}</span></div>
        {loading ? <div className="loading-state" role="status"><span className="loading-spinner" />Loading your complaints…</div> : complaints.length ? <div className="table-scroll"><table className="complaint-table">
          <caption className="sr-only">Your submitted complaints and their current status</caption>
          <thead><tr><th scope="col">No.</th><th scope="col">ID</th><th scope="col">Submitted</th><th scope="col">Phone</th><th scope="col">Category</th><th scope="col">Department</th><th scope="col">Location</th><th scope="col">Evidence</th><th scope="col">Report</th><th scope="col">Status</th><th scope="col">Resolution</th></tr></thead>
          <tbody>{complaints.map((c, index) => <tr key={c.cid}>
            <td>{index + 1}</td><td><strong className="complaint-id">{c.cid}</strong></td><td>{String(c.date).slice(0, 10)}</td><td>{c.phno}</td><td>{categoryLabel(c.category)}</td><td>{c.dept}</td><td>{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
            <td>{c.img_url ? <a className="table-action" href={c.img_url} target="_blank" rel="noreferrer" title={`View evidence for complaint ${c.cid}`}><i className="ri-image-line" aria-hidden="true" /> View image</a> : <span className="muted-value">Not available</span>}</td>
            <td><a className="table-action" href={`/api/complaints/${encodeURIComponent(c.cid)}/report.pdf`} title={`Download report for complaint ${c.cid}`} aria-label={`Download report for complaint ${c.cid}`}><i className="ri-file-download-line" aria-hidden="true" /> PDF</a></td>
            <td><StatusBadge status={c.status} /></td><td>{c.solved_url ? <a className="table-action" href={c.solved_url} target="_blank" rel="noreferrer" title={`View resolution image for complaint ${c.cid}`}><i className="ri-image-line" aria-hidden="true" /> View image</a> : <span className="muted-value">Not available</span>}</td>
          </tr>)}</tbody>
        </table></div> : !error && <div className="empty-state"><span className="empty-state-icon"><i className="ri-file-list-3-line" aria-hidden="true" /></span><h3>No complaints yet</h3><p>Your submitted complaints will appear here, along with their latest status.</p><Link className="button button-primary" to="/app"><i className="ri-add-line" aria-hidden="true" /> Submit your first complaint</Link></div>}
      </section>
    </main>
  </div>;
}
