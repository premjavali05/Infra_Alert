import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

function Brand({ to = '/', onClick }) {
  return (
    <Link className="brand" to={to} onClick={onClick} aria-label="Infra-Alert home">
      <img src="/media/logo.png" alt="Infra-Alert" />
    </Link>
  );
}

export function Navbar({ links = [] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <nav className="nav-bar page-container" aria-label="Main navigation">
        <Brand onClick={close} />
        <ul className={`nav-links${open ? ' show' : ''}`}>
          {links.map((link) => (
            <li key={link.to}>
              <Link className={link.className || ''} to={link.to} onClick={(event) => {
                close();
                if (link.to.includes('#')) {
                  event.preventDefault();
                  const id = link.to.split('#')[1];
                  if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                }
              }}>
                {link.icon && <i className={link.icon} aria-hidden="true" />}
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <button className={`nav-toggle${open ? ' active' : ''}`} type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>
          <span /><span /><span />
        </button>
      </nav>
    </header>
  );
}

export function UserNavbar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* Leave the workspace even if the session has expired. */ }
    navigate('/');
  }

  return (
    <header className="site-header">
      <nav className="nav-bar page-container" aria-label="Citizen navigation">
        <Brand />
        <ul className={`nav-links${open ? ' show' : ''}`}>
          <li><Link to="/app" onClick={() => setOpen(false)}><i className="ri-home-2-line" aria-hidden="true" />Home</Link></li>
          <li><Link to="/dashboard" onClick={() => setOpen(false)}><i className="ri-dashboard-line" aria-hidden="true" />My complaints</Link></li>
          <li><button className="nav-logout" type="button" onClick={logout}><i className="ri-logout-box-r-line" aria-hidden="true" />Log out</button></li>
        </ul>
        <button className={`nav-toggle${open ? ' active' : ''}`} type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>
          <span /><span /><span />
        </button>
      </nav>
    </header>
  );
}

export function Alert({ message, type = 'error' }) {
  if (!message) return null;
  const isSuccess = type === 'success';
  return <div className={`alert alert-${type}`} role={isSuccess ? 'status' : 'alert'} aria-live={isSuccess ? 'polite' : 'assertive'}>
    <i className={isSuccess ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} aria-hidden="true" />
    <span>{message}</span>
  </div>;
}

export function StatusBadge({ status }) {
  return <span className={`status-badge status-${String(status || 'Pending').toLowerCase().replace(/\s+/g, '-')}`} aria-label={`Status: ${status || 'Pending'}`}>
    <span className="status-indicator" aria-hidden="true" />
    {status || 'Pending'}
  </span>;
}
