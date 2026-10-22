import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Alert } from '../components/Shared';
import { departments } from '../data/departments';

const states = [
  ['AP','Andhra Pradesh'],['AR','Arunachal Pradesh'],['AS','Assam'],['BR','Bihar'],['CG','Chhattisgarh'],['GA','Goa'],['GJ','Gujarat'],['HR','Haryana'],['HP','Himachal Pradesh'],['JK','Jammu and Kashmir'],['JH','Jharkhand'],['KA','Karnataka'],['KL','Kerala'],['MP','Madhya Pradesh'],['MH','Maharashtra'],['MN','Manipur'],['ML','Meghalaya'],['MZ','Mizoram'],['NL','Nagaland'],['OD','Odisha'],['PB','Punjab'],['RJ','Rajasthan'],['SK','Sikkim'],['TN','Tamil Nadu'],['TS','Telangana'],['TR','Tripura'],['UK','Uttarakhand'],['UP','Uttar Pradesh'],['WB','West Bengal'],['AN','Andaman and Nicobar Islands'],['CH','Chandigarh'],['DN','Dadra and Nagar Haveli'],['DD','Daman and Diu'],['DL','Delhi'],['LD','Lakshadweep'],['PY','Puducherry']
];
const categoryOptions = [
  ['home_electricity','Home Electricity (Electricity Board)'],['street_lights','Street Lights (Municipal Corporation)'],['potholes','Potholes (Municipal Corporation)'],['garbage','Garbage (Municipal Corporation)']
];

function AuthBrand() {
  return <Link className="auth-brand" to="/" aria-label="Infra-Alert home"><img src="/media/logo.png" alt="Infra-Alert" /></Link>;
}

function AuthFrame({ children, title, subtitle }) {
  return <main className="auth-page">
    <header className="auth-header"><div className="page-container"><AuthBrand /><Link to="/" className="auth-return"><i className="ri-arrow-left-line" aria-hidden="true" /> Back to home</Link></div></header>
    <div className="auth-main page-container">
      <aside className="auth-aside"><span className="auth-aside-mark"><i className="ri-community-line" aria-hidden="true" /></span><span className="section-kicker">Infra-Alert</span><h1>{title}</h1><p>{subtitle}</p><div className="auth-aside-note"><i className="ri-shield-check-line" aria-hidden="true" /><span>Your information is used to support your account and complaint workflow.</span></div></aside>
      <section className="auth-card">{children}</section>
    </div>
    <footer className="auth-footer page-container"><span>Infra-Alert</span><span>Public infrastructure reporting</span></footer>
  </main>;
}

function SplitLogin({ authority = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = authority ? 'Authority sign in' : 'Welcome back';
  const identifierLabel = authority ? 'Employee ID' : 'Phone number';
  const registerPath = authority ? '/register/authority' : '/register/user';

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (authority) {
        await api('/auth/login/authority', { method: 'POST', body: { eid: form.identifier, password: form.password } });
      } else {
        await api('/auth/login/user', { method: 'POST', body: { phno: form.identifier, password: form.password } });
      }
      navigate(authority ? '/authority/dashboard' : '/app');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <AuthFrame title={authority ? 'A workspace for responsive service.' : 'Your neighborhood, in focus.'} subtitle={authority ? 'Sign in to review and manage complaints assigned to your department.' : 'Sign in to report a local concern and follow its status.'}>
    {location.state?.message && <Alert message={location.state.message} type="success" />}
    <div className="auth-card-heading"><span className="section-kicker">{authority ? 'Authority portal' : 'Resident portal'}</span><h2>{title}</h2><p>Enter your account details to continue.</p></div>
    <form className="form-stack" onSubmit={submit}>
      <div className="form-field"><label htmlFor="login-identifier">{identifierLabel}</label><input id="login-identifier" autoComplete={authority ? 'username' : 'tel'} value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} placeholder={authority ? 'Enter your employee ID' : 'Enter your phone number'} required /></div>
      <div className="form-field"><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" required /></div>
      <Alert message={error} />
      <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <i className="ri-arrow-right-line" aria-hidden="true" /></button>
    </form>
    <p className="auth-switch">New to Infra-Alert? <Link to={registerPath}>Create an account</Link></p>
  </AuthFrame>;
}

export function UserLogin() { return <SplitLogin />; }
export function AuthorityLogin() { return <SplitLogin authority />; }

function UserRegisterForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phno: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { await api('/auth/register/user', { method: 'POST', body: form }); navigate('/login/user', { state: { message: 'Account created. Please sign in.' } }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <AuthFrame title="A clearer line to local services." subtitle="Create a resident account to submit infrastructure concerns and follow your complaint history.">
    <div className="auth-card-heading"><span className="section-kicker">Resident portal</span><h2>Create your account</h2><p>Enter your details to get started.</p></div>
    <form className="form-stack" onSubmit={submit}>
      <div className="form-field"><label htmlFor="user-name">Name</label><input id="user-name" autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
      <div className="form-field"><label htmlFor="user-phone">Phone number</label><input id="user-phone" type="tel" autoComplete="tel" pattern="[0-9]{10}" value={form.phno} onChange={e => setForm({ ...form, phno: e.target.value })} aria-describedby="user-phone-help" required /><small id="user-phone-help">Enter a 10-digit phone number.</small></div>
      <div className="form-field"><label htmlFor="user-email">Email</label><input id="user-email" type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
      <div className="form-field"><label htmlFor="user-password">Password</label><input id="user-password" type="password" autoComplete="new-password" minLength="4" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} aria-describedby="user-password-help" required /><small id="user-password-help">Use at least 4 characters.</small></div>
      <Alert message={error} />
      <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <i className="ri-arrow-right-line" aria-hidden="true" /></button>
    </form>
    <p className="auth-switch">Already registered? <Link to="/login/user">Sign in</Link></p>
  </AuthFrame>;
}

function AuthorityRegisterForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ eid: '', name: '', phno: '', email: '', state: '', category: '', department: '', city: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => departments?.[form.category]?.[form.state] || [], [form.category, form.state]);
  function change(field, value) {
    setForm(prev => ({ ...prev, [field]: value, ...(field === 'state' || field === 'category' ? { department: '' } : {}) }));
  }
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { await api('/auth/register/authority', { method: 'POST', body: form }); navigate('/login/authority'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <AuthFrame title="A workspace for responsive service." subtitle="Register your department account to review and manage complaints in your area.">
    <div className="auth-card-heading"><span className="section-kicker">Authority portal</span><h2>Create an authority account</h2><p>Provide your employee and department details.</p></div>
    <form className="form-stack" onSubmit={submit}>
      <div className="form-field"><label htmlFor="authority-eid">Employee ID</label><input id="authority-eid" autoComplete="username" value={form.eid} onChange={e => change('eid', e.target.value)} required /></div>
      <div className="form-field"><label htmlFor="authority-name">Name</label><input id="authority-name" autoComplete="name" value={form.name} onChange={e => change('name', e.target.value)} required /></div>
      <div className="form-row">
        <div className="form-field"><label htmlFor="authority-phone">Phone number</label><input id="authority-phone" type="tel" autoComplete="tel" pattern="[0-9]{10}" value={form.phno} onChange={e => change('phno', e.target.value)} required /></div>
        <div className="form-field"><label htmlFor="authority-email">Work email</label><input id="authority-email" type="email" autoComplete="email" value={form.email} onChange={e => change('email', e.target.value)} required /></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label htmlFor="authority-state">State</label><select id="authority-state" value={form.state} onChange={e => change('state', e.target.value)} required><option value="">Select state</option>{states.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div>
        <div className="form-field"><label htmlFor="authority-category">Category</label><select id="authority-category" value={form.category} onChange={e => change('category', e.target.value)} required><option value="">Select category</option>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      </div>
      <div className="form-field"><label htmlFor="authority-department">Department</label><select id="authority-department" value={form.department} onChange={e => change('department', e.target.value)} required><option value="">Select department</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select>{form.state && form.category && !options.length && <small>No departments are listed for this state and category.</small>}</div>
      <div className="form-row">
        <div className="form-field"><label htmlFor="authority-city">City</label><input id="authority-city" autoComplete="address-level2" value={form.city} onChange={e => change('city', e.target.value)} required /></div>
        <div className="form-field"><label htmlFor="authority-password">Password</label><input id="authority-password" type="password" autoComplete="new-password" minLength="4" value={form.password} onChange={e => change('password', e.target.value)} required /></div>
      </div>
      <Alert message={error} />
      <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create authority account'} <i className="ri-arrow-right-line" aria-hidden="true" /></button>
    </form>
    <p className="auth-switch">Already registered? <Link to="/login/authority">Sign in</Link></p>
  </AuthFrame>;
}

export function UserRegister() { return <UserRegisterForm />; }
export function AuthorityRegister() { return <AuthorityRegisterForm />; }
