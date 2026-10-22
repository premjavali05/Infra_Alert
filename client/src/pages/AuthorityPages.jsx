import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, categoryLabel } from '../api';
import { Alert, StatusBadge } from '../components/Shared';
import DirectionsMap from '../components/DirectionsMap';

function AuthorityNav() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* Leave the workspace even if the session has expired. */ }
    navigate('/');
  }
  return <header className="site-header"><nav className="nav-bar page-container" aria-label="Authority navigation">
    <Link className="brand" to="/" aria-label="Infra-Alert home"><img src="/media/logo.png" alt="Infra-Alert" /></Link>
    <ul className={`nav-links${open ? ' show' : ''}`}>
      <li><Link to="/authority/dashboard" onClick={() => setOpen(false)}><i className="ri-dashboard-line" aria-hidden="true" />Complaint workspace</Link></li>
      <li><button className="nav-logout" type="button" onClick={logout}><i className="ri-logout-box-r-line" aria-hidden="true" />Log out</button></li>
    </ul>
    <button className={`nav-toggle${open ? ' active' : ''}`} type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
  </nav></header>;
}

const statusRoutes = [
  { label: 'Pending', to: '/authority/dashboard', key: 'Pending' },
  { label: 'In progress', to: '/authority/status/in-progress', key: 'In Progress' },
  { label: 'Solved', to: '/authority/status/solved', key: 'Solved' },
  { label: 'Rejected', to: '/authority/status/rejected', key: 'Rejected' }
];

export function AuthorityDashboard() {
  const location = useLocation();
  const statusPath = location.pathname.includes('/status/') ? location.pathname.split('/').at(-1) : 'pending';
  const activeStatus = ({ pending: 'Pending', 'in-progress': 'In Progress', solved: 'Solved', rejected: 'Rejected' })[statusPath] || 'Pending';
  const [complaints, setComplaints] = useState([]);
  const [cid, setCid] = useState('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busyCid, setBusyCid] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ status: activeStatus });
      if (filter.trim()) params.set('cid', filter.trim());
      const data = await api(`/complaints/authority?${params.toString()}`);
      setComplaints(data.complaints || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [statusPath, filter]);

  async function changeStatus(id, action) {
    setBusyCid(id); setError('');
    try { await api(`/complaints/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { action } }); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusyCid(''); }
  }
  function onFilter(e) { e.preventDefault(); setFilter(cid); }

  return <div className="app-page authority-dashboard">
    <AuthorityNav />
    <main className="page-container app-main">
      {location.state?.message && <Alert message={location.state.message} type="success" />}
      <section className="page-heading authority-heading">
        <div><span className="section-kicker">Authority workspace</span><h1>Complaint management</h1><p>Review reports assigned to your department and update their status.</p></div>
        <form className="filter-form" onSubmit={onFilter} role="search"><label className="sr-only" htmlFor="complaint-filter">Filter by complaint ID</label><i className="ri-search-line" aria-hidden="true" /><input id="complaint-filter" type="search" value={cid} onChange={e => setCid(e.target.value)} placeholder="Search complaint ID" /><button className="button button-secondary" type="submit">Search</button></form>
      </section>
      {error && <div className="retry-row"><Alert message={error} /><button className="button button-secondary" type="button" onClick={load}>Refresh complaints <i className="ri-refresh-line" aria-hidden="true" /></button></div>}
      <section className="surface-card authority-workspace">
        <nav className="status-navigation" aria-label="Filter complaints by status">
          {statusRoutes.map(status => <Link key={status.key} className={`status-tab${activeStatus === status.key ? ' active' : ''}`} to={status.to} aria-current={activeStatus === status.key ? 'page' : undefined}>{status.label}<span className="status-tab-indicator" /></Link>)}
        </nav>
        <div className="card-heading authority-table-heading"><div><span className="section-kicker">{activeStatus} cases</span><h2>Complaints</h2></div><span className="record-count">{complaints.length} {complaints.length === 1 ? 'record' : 'records'}</span></div>
        {loading ? <div className="loading-state" role="status"><span className="loading-spinner" />Loading complaints…</div> : complaints.length ? <div className="table-scroll"><table className="complaint-table authority-table">
          <caption className="sr-only">{activeStatus} complaints assigned to your authority account</caption>
          <thead><tr><th scope="col">No.</th><th scope="col">Complaint</th><th scope="col">Date</th><th scope="col">Category</th><th scope="col">Department</th><th scope="col">Contact</th><th scope="col">Location</th><th scope="col">Report</th>{activeStatus === 'Pending' && <><th scope="col">Start</th><th scope="col">Resolve</th><th scope="col">Reject</th></>}{activeStatus === 'In Progress' && <><th scope="col">Resolve</th><th scope="col">Reject</th></>}{activeStatus === 'Solved' && <th scope="col">Resolution</th>}<th scope="col">Status</th></tr></thead>
          <tbody>{complaints.map((c, index) => <tr key={c.cid}>
            <td>{index + 1}</td><td><strong className="complaint-id">{c.cid}</strong><Link className="row-secondary-link" to={`/authority/solve/${encodeURIComponent(c.cid)}`}>Directions &amp; details</Link></td>
            <td>{String(c.date).slice(0, 10)}</td><td>{categoryLabel(c.category)}</td><td>{c.dept}</td><td>{c.phno || '—'}</td><td>{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
            <td><a className="table-action" href={`/api/complaints/${encodeURIComponent(c.cid)}/report.pdf`} title={`Download report for complaint ${c.cid}`} aria-label={`Download report for complaint ${c.cid}`}><i className="ri-file-download-line" aria-hidden="true" /> PDF</a></td>
            {activeStatus === 'Pending' && <>
              <td><button className="icon-action action-progress" type="button" disabled={busyCid === c.cid} aria-label={`Move complaint ${c.cid} to in progress`} title="Move to In Progress" onClick={() => changeStatus(c.cid, 'in-progress')}><i className="ri-play-circle-line" aria-hidden="true" /></button></td>
              <td><Link className="icon-action action-resolve" to={`/authority/solve/${encodeURIComponent(c.cid)}`} aria-label={`Resolve complaint ${c.cid}`} title="Upload resolution"><i className="ri-check-double-line" aria-hidden="true" /></Link></td>
              <td><button className="icon-action action-reject" type="button" disabled={busyCid === c.cid} aria-label={`Reject complaint ${c.cid}`} title="Reject complaint" onClick={() => changeStatus(c.cid, 'reject')}><i className="ri-close-line" aria-hidden="true" /></button></td>
            </>}
            {activeStatus === 'In Progress' && <>
              <td><Link className="icon-action action-resolve" to={`/authority/solve/${encodeURIComponent(c.cid)}`} aria-label={`Resolve complaint ${c.cid}`} title="Upload resolution"><i className="ri-check-double-line" aria-hidden="true" /></Link></td>
              <td><button className="icon-action action-reject" type="button" disabled={busyCid === c.cid} aria-label={`Reject complaint ${c.cid}`} title="Reject complaint" onClick={() => changeStatus(c.cid, 'reject')}><i className="ri-close-line" aria-hidden="true" /></button></td>
            </>}
            {activeStatus === 'Solved' && <td>{c.solved_url ? <a className="table-action" href={c.solved_url} target="_blank" rel="noreferrer" title={`View resolution image for complaint ${c.cid}`}><i className="ri-image-line" aria-hidden="true" /> View image</a> : <span className="muted-value">Not available</span>}</td>}
            <td><StatusBadge status={c.status} /></td>
          </tr>)}</tbody>
        </table></div> : !error && <div className="empty-state"><span className="empty-state-icon"><i className="ri-inbox-line" aria-hidden="true" /></span><h3>No {activeStatus.toLowerCase()} complaints found</h3><p>There are no complaints to show for this status and search.</p></div>}
      </section>
    </main>
  </div>;
}

export function SolveComplaint() {
  const { cid } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [complaint, setComplaint] = useState(null);
  const [location, setLocation] = useState(null);
  const [originAddress, setOriginAddress] = useState('');
  const [origin, setOrigin] = useState(null);
  const [originStatus, setOriginStatus] = useState('');
  const [directions, setDirections] = useState(null);
  const [directionsError, setDirectionsError] = useState('');
  const [directionsBusy, setDirectionsBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const originRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setComplaint(null);
    setLocation(null);
    api(`/complaints/${encodeURIComponent(cid)}`)
      .then(d => { if (active) { setComplaint(d.complaint); setLocation(d.location); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [cid, retryCount]);

  async function getDirections(event) {
    event.preventDefault();
    setDirectionsError('');
    setDirections(null);
    if (!origin && !originAddress.trim()) {
      setDirectionsError('Use your device location or enter a starting address.');
      return;
    }
    setDirectionsBusy(true);
    try {
      const result = await api('/location/directions', {
        method: 'POST',
        body: {
          cid,
          originAddress: origin ? '' : originAddress,
          originLatitude: origin?.latitude ?? '',
          originLongitude: origin?.longitude ?? ''
        }
      });
      setDirections(result);
    } catch (err) {
      setDirectionsError(err.message);
    } finally {
      setDirectionsBusy(false);
    }
  }

  function useDeviceLocation() {
    const requestId = ++originRequestRef.current;
    setOrigin(null);
    setOriginStatus('');
    setDirectionsError('');
    setDirections(null);
    if (!navigator.geolocation) {
      setOriginStatus('Device location is not supported in this browser. Enter a starting address instead.');
      return;
    }
    setDirectionsBusy(true);
    setOriginStatus('Finding your current device location…');
    navigator.geolocation.getCurrentPosition(
      position => {
        if (requestId !== originRequestRef.current) return;
        setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setOriginStatus('Current device location is ready to use as the route starting point.');
        setDirectionsBusy(false);
      },
      error => {
        if (requestId !== originRequestRef.current) return;
        setOriginStatus(error.code === 1
          ? 'Location permission was denied. Enter a starting address to get directions.'
          : 'Could not determine your device location. Enter a starting address to get directions.');
        setDirectionsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  async function submit(e) {
    e.preventDefault(); setError('');
    if (!file) { setError('Upload the resolution image before submitting.'); return; }
    const data = new FormData(); data.append('img', file);
    setBusy(true);
    try { await api(`/complaints/${encodeURIComponent(cid)}/solve`, { method: 'POST', body: data }); navigate('/authority/status/solved', { state: { message: `Complaint ${cid} marked solved.` } }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="app-page solve-page">
    <AuthorityNav />
    <main className="page-container app-main narrow-main">
      <div className="page-breadcrumb"><Link to="/authority/dashboard">Complaint workspace</Link><i className="ri-arrow-right-s-line" aria-hidden="true" /><span>Complaint {cid}</span></div>
      {loading ? <div className="loading-state" role="status"><span className="loading-spinner" />Loading complaint details…</div> : error && !complaint ? <section className="surface-card error-state"><Alert message={error} /><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setRetryCount(count => count + 1)}>Try again <i className="ri-refresh-line" aria-hidden="true" /></button><Link className="button button-secondary" to="/authority/dashboard">Back to complaints</Link></div></section> : <>
        <section className="page-heading solve-heading"><span className="section-kicker">{complaint?.status === 'Solved' ? 'Resolved case' : 'Case management'}</span><h1>{complaint?.status === 'Solved' ? 'Complaint details' : 'Resolve this complaint'}</h1>{complaint && <p>Complaint {complaint.cid} · {[complaint.city, complaint.state].filter(Boolean).join(', ')}</p>}</section>
        {complaint && <section className="surface-card complaint-detail-card">
          <div className="card-heading"><div><span className="section-kicker">Case overview</span><h2>Complaint {complaint.cid}</h2></div><StatusBadge status={complaint.status} /></div>
          <dl className="detail-grid">
            <div><dt>Reported on</dt><dd>{String(complaint.date).slice(0, 10) || '—'}</dd></div>
            <div><dt>Category</dt><dd>{categoryLabel(complaint.category)}</dd></div>
            <div><dt>Department</dt><dd>{complaint.dept || '—'}</dd></div>
            <div><dt>Contact</dt><dd>{complaint.phno || '—'}</dd></div>
            <div><dt>Location</dt><dd>{[complaint.city, complaint.state].filter(Boolean).join(', ') || '—'}</dd></div>
            {complaint.description && <div className="detail-full"><dt>Description</dt><dd>{complaint.description}</dd></div>}
          </dl>
          <div className="detail-links">{complaint.img_url && <a className="table-action" href={complaint.img_url} target="_blank" rel="noreferrer"><i className="ri-image-line" aria-hidden="true" /> View submitted evidence</a>}<a className="table-action" href={`/api/complaints/${encodeURIComponent(complaint.cid)}/report.pdf`}><i className="ri-file-download-line" aria-hidden="true" /> Download complaint report</a>{complaint.solved_url && <a className="table-action" href={complaint.solved_url} target="_blank" rel="noreferrer"><i className="ri-check-double-line" aria-hidden="true" /> View resolution image</a>}</div>
        </section>}
        {complaint && <section className="surface-card authority-directions">
          <div className="card-heading"><div><span className="section-kicker">Location support</span><h2>Directions to complaint</h2></div><span className="directions-heading-icon"><i className="ri-map-pin-line" aria-hidden="true" /></span></div>
          {location?.latitude != null && location?.longitude != null ? <>
            <p className="complaint-pin">Complaint pin: <strong>{location.address || `${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`}</strong></p>
            <button className="button button-secondary" type="button" onClick={useDeviceLocation} disabled={directionsBusy}><i className="ri-crosshair-2-line" aria-hidden="true" />{directionsBusy && !directions ? 'Finding device location…' : origin ? 'Refresh current device location' : 'Use current device location'}</button>
            {originStatus && <p className="inline-status" role="status">{originStatus}</p>}
            <form className="directions-form" onSubmit={getDirections}>
              <div className="form-field"><label htmlFor="authority-origin">Or enter a starting address</label><input id="authority-origin" value={originAddress} onChange={event => {
                originRequestRef.current += 1;
                setOriginAddress(event.target.value);
                setOrigin(null);
                setOriginStatus('');
                setDirectionsBusy(false);
              }} maxLength="300" placeholder="Enter your office or starting address" /><small>{origin ? 'Device location selected. Entering an address will switch to the manual starting point.' : 'For accurate routing, enter a specific address if device location is unavailable.'}</small></div>
              <button className="button button-primary" type="submit" disabled={directionsBusy}>{directionsBusy ? 'Finding route…' : 'Get directions'} <i className="ri-arrow-right-line" aria-hidden="true" /></button>
            </form>
            {directionsError && <Alert message={directionsError} />}
            {directions && <>
              <p className="directions-summary"><i className="ri-route-line" aria-hidden="true" /> Driving route: {(directions.distance / 1000).toFixed(1)} km · {Math.round(directions.duration / 60)} min (estimated)</p>
              <DirectionsMap route={directions} />
              <p className="directions-links"><a href={`https://www.google.com/maps/dir/?api=1&origin=${directions.origin.latitude},${directions.origin.longitude}&destination=${directions.destination.latitude},${directions.destination.longitude}&travelmode=driving`} target="_blank" rel="noreferrer">Open route in Google Maps</a><span> · </span><a href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${directions.origin.latitude}%2C${directions.origin.longitude}%3B${directions.destination.latitude}%2C${directions.destination.longitude}`} target="_blank" rel="noreferrer">Open route in OpenStreetMap</a></p>
              <p className="location-picker-attribution">Route and estimated travel time provided by <a href={directions.attributionUrl} target="_blank" rel="noreferrer">{directions.attribution}</a>.</p>
            </>}
          </> : <p className="inline-status">No complaint map coordinates are available for directions.</p>}
        </section>}
        {complaint?.status !== 'Solved' && complaint && <form onSubmit={submit} className="surface-card solve-upload-form">
          <div className="form-section-heading"><span className="step-number"><i className="ri-check-line" aria-hidden="true" /></span><div><h2>Submit resolution evidence</h2><p>Upload the image or document confirming the completed work.</p></div></div>
          <div className="form-field"><label htmlFor="img">Resolution image <span className="required-mark">*</span></label><input type="file" name="img" id="img" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} required /><small>{file ? file.name : 'Choose an image or PDF from your device.'}</small></div>
          <Alert message={error} />
          <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Uploading resolution…' : 'Upload resolution'} <i className="ri-arrow-right-line" aria-hidden="true" /></button><Link to="/authority/dashboard" className="button button-secondary">Cancel</Link></div>
        </form>}
        {complaint?.status === 'Solved' && <Link to="/authority/status/solved" className="button button-secondary return-link"><i className="ri-arrow-left-line" aria-hidden="true" /> Back to solved complaints</Link>}
      </>}
    </main>
  </div>;
}
