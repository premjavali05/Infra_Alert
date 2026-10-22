import { Link } from 'react-router-dom';
import { Navbar } from '../components/Shared';

const categories = [
  { title: 'Street lights', image: '/media/street.jpg', icon: 'ri-lightbulb-line', copy: 'Report damaged or malfunctioning street lighting in your area.' },
  { title: 'Roads & potholes', image: '/media/pothole.jpg', icon: 'ri-road-map-line', copy: 'Bring road damage and potholes to the attention of local services.' },
  { title: 'Waste & sanitation', image: '/media/garbage1.jpg', icon: 'ri-recycle-line', copy: 'Share concerns about garbage collection and public cleanliness.' },
  { title: 'Electricity', image: '/media/home.jpg', icon: 'ri-flashlight-line', copy: 'Submit a report about a home electricity concern.' }
];

export default function Home() {
  return (
    <div className="home-page">
      <Navbar links={[
        { to: '/#about', label: 'About' },
        { to: '/#services', label: 'What you can report' },
        { to: '/#contact', label: 'Contact' },
        { to: '/login/user', label: 'Sign in' },
        { to: '/login/authority', label: 'Authority access', className: 'nav-primary-link' }
      ]} />
      <main>
        <section className="hero-section">
          <div className="hero-inner page-container">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" />A clearer way to report local issues</span>
              <h1>Better streets start with <span>being heard.</span></h1>
              <p>Infra-Alert gives residents a place to report infrastructure concerns and follow their complaint, while helping authorities manage cases in one workspace.</p>
              <div className="hero-actions">
                <Link className="button button-primary" to="/login/user">Report an issue <i className="ri-arrow-right-line" aria-hidden="true" /></Link>
                <Link className="button button-secondary" to="/login/user"><i className="ri-search-line" aria-hidden="true" /> Track a complaint</Link>
              </div>
              <div className="hero-footnote"><i className="ri-shield-check-line" aria-hidden="true" /> Sign in to submit a report or view your complaint history.</div>
            </div>
            <div className="hero-visual">
              <img src="/media/hero2.png" alt="Residents and local services working together on neighborhood infrastructure" />
              <div className="visual-caption"><span className="visual-caption-icon"><i className="ri-map-pin-2-line" aria-hidden="true" /></span><span><strong>Local concerns, clearly reported</strong><small>From submission to status updates</small></span></div>
            </div>
          </div>
          <div className="hero-bottom page-container">
            <span>One place to report and follow up</span>
            <span className="hero-bottom-line" />
            <span>For residents and authorities</span>
          </div>
        </section>

        <section className="intro-section section-pad" id="about">
          <div className="page-container intro-grid">
            <div>
              <span className="section-kicker">About Infra-Alert</span>
              <h2>Make local infrastructure concerns easier to communicate.</h2>
            </div>
            <div className="intro-copy">
              <p>Infra-Alert is a community-focused platform for reporting and tracking municipal infrastructure issues. Residents can share concerns about street lights, electricity, potholes, and garbage collection, then follow the status of their complaints.</p>
              <p>Authorities can review and manage complaints assigned to their department. The goal is a clearer connection between the people who notice an issue and the teams responsible for it.</p>
              <Link className="text-link" to="/register/user">Create a resident account <i className="ri-arrow-right-line" aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section className="services-section section-pad" id="services">
          <div className="page-container">
            <div className="section-heading">
              <div><span className="section-kicker">What you can report</span><h2>Everyday issues. A straightforward way to speak up.</h2></div>
              <p>Choose a concern to begin. You can provide the location and supporting details when you submit your complaint.</p>
            </div>
            <div className="service-grid">
              {categories.map((category, index) => (
                <article className="service-card" key={category.title}>
                  <div className="service-image"><img src={category.image} alt="" /><span className="service-number">0{index + 1}</span></div>
                  <div className="service-content"><span className="service-icon"><i className={category.icon} aria-hidden="true" /></span><h3>{category.title}</h3><p>{category.copy}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="steps-section section-pad">
          <div className="page-container steps-layout">
            <div className="steps-intro"><span className="section-kicker">How it works</span><h2>A clear path from concern to follow-up.</h2><p>Use your account to create a report with the information authorities need to review it.</p><Link className="button button-primary" to="/login/user">Get started <i className="ri-arrow-right-line" aria-hidden="true" /></Link></div>
            <ol className="steps-list">
              <li><span>01</span><div><h3>Choose the issue</h3><p>Select the relevant category and department for your report.</p></div></li>
              <li><span>02</span><div><h3>Share the details</h3><p>Add a description, supporting photo, and a confirmed map location.</p></div></li>
              <li><span>03</span><div><h3>Follow the status</h3><p>Return to your complaint history to see available status updates.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="contact-section section-pad" id="contact">
          <div className="page-container contact-panel">
            <div><span className="section-kicker">Get in touch</span><h2>Questions about using Infra-Alert?</h2><p>Contact the support team using the details below.</p></div>
            <div className="contact-items">
              <a href="mailto:support@infra-alert.com"><i className="ri-mail-line" aria-hidden="true" /><span><small>Email</small>support@infra-alert.com</span></a>
              <a href="tel:+919380122673"><i className="ri-phone-line" aria-hidden="true" /><span><small>Phone</small>+91 9380122673</span></a>
              <p><i className="ri-map-pin-line" aria-hidden="true" /><span><small>Location</small>Tilakwadi, Belagavi, Karnataka, India</span></p>
              <p><i className="ri-time-line" aria-hidden="true" /><span><small>Hours</small>Monday - Friday: 9 AM to 5 PM</span></p>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="page-container footer-main">
          <div><img src="/media/logo.png" alt="Infra-Alert" /><p>A clearer way to report and follow local infrastructure concerns.</p></div>
          <div className="footer-nav"><Link to="/login/user">Resident sign in</Link><Link to="/register/user">Create account</Link><Link to="/login/authority">Authority access</Link><a href="#contact">Contact</a></div>
        </div>
        <div className="page-container footer-bottom"><span>© {new Date().getFullYear()} Infra-Alert</span><span>Community reporting and complaint follow-up</span></div>
      </footer>
    </div>
  );
}
