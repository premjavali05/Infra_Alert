import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api';
import Home from './pages/Home';
import { AuthorityLogin, AuthorityRegister, UserLogin, UserRegister } from './pages/AuthPages';
import { CitizenDashboard, CitizenHome, ComplaintForm } from './pages/CitizenPages';
import { AuthorityDashboard, SolveComplaint } from './pages/AuthorityPages';

function RequireRole({ role, children }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, user: null });
  useEffect(() => {
    let alive = true;
    api('/auth/me').then(({ user }) => { if (alive) setState({ loading: false, user }); })
      .catch(() => { if (alive) setState({ loading: false, user: null }); });
    return () => { alive = false; };
  }, []);
  if (state.loading) return <main className="gate-loading" role="status"><span className="loading-spinner" />Loading your Infra-Alert workspace…</main>;
  if (!state.user) return <Navigate to={role === 'authority' ? '/login/authority' : '/login/user'} replace state={{ from: location.pathname }} />;
  if (state.user.role !== role) return <Navigate to={state.user.role === 'authority' ? '/authority/dashboard' : '/app'} replace />;
  return children;
}

function NotFound() {
  return <main className="not-found"><Link className="not-found-brand" to="/" aria-label="Infra-Alert home"><img src="/media/logo.png" alt="Infra-Alert" /></Link><span className="section-kicker">404 · Page not found</span><h1>This page isn’t here.</h1><p>The link may be out of date, or the page may have moved.</p><Link className="button button-primary" to="/"><i className="ri-arrow-left-line" aria-hidden="true" /> Back to home</Link></main>;
}

export default function App() {
  return <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login/user" element={<UserLogin />} />
      <Route path="/login/authority" element={<AuthorityLogin />} />
      <Route path="/register/user" element={<UserRegister />} />
      <Route path="/register/authority" element={<AuthorityRegister />} />
      <Route path="/app" element={<RequireRole role="citizen"><CitizenHome /></RequireRole>} />
      <Route path="/complaint" element={<RequireRole role="citizen"><ComplaintForm /></RequireRole>} />
      <Route path="/dashboard" element={<RequireRole role="citizen"><CitizenDashboard /></RequireRole>} />
      <Route path="/authority/dashboard" element={<RequireRole role="authority"><AuthorityDashboard /></RequireRole>} />
      <Route path="/authority/status/:status" element={<RequireRole role="authority"><AuthorityDashboard /></RequireRole>} />
      <Route path="/authority/solve/:cid" element={<RequireRole role="authority"><SolveComplaint /></RequireRole>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>;
}
