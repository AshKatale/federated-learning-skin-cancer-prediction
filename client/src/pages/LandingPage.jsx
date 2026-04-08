import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

/* ─── SVG Icons ───────────────────────────────── */
const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const NetworkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
    <path d="M12 7v4M5 17l7-6M19 17l-7-6" />
  </svg>
);
const BrainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 017 4.5v1a2 2 0 01-2 2H4a2 2 0 00-2 2v1c0 1.1.9 2 2 2h1a2 2 0 012 2v1A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5v-1a2 2 0 012-2h1a2 2 0 002-2v-1a2 2 0 00-2-2h-1a2 2 0 01-2-2v-1A2.5 2.5 0 0014.5 2h-5z"/>
  </svg>
);
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="16" height="16">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

/* ─── Animated counter ─────────────────────── */
function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

/* ─── Floating particle background ──────────── */
function Particles() {
  return (
    <div className="lp-particles" aria-hidden="true">
      {[...Array(20)].map((_, i) => (
        <div key={i} className="lp-particle" style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 8}s`,
          animationDuration: `${6 + Math.random() * 8}s`,
          width: `${3 + Math.random() * 4}px`,
          height: `${3 + Math.random() * 4}px`,
          opacity: 0.15 + Math.random() * 0.25,
        }} />
      ))}
    </div>
  );
}

/* ─── Feature Card ───────────────────────────── */
function FeatureCard({ icon, title, description, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lp-feature-card${visible ? ' lp-visible' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="lp-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

/* ─── Stat counter ───────────────────────────── */
function StatItem({ value, suffix, label, start }) {
  const num = useCounter(value, 2000, start);
  return (
    <div className="lp-stat">
      <div className="lp-stat-value">{num.toLocaleString()}{suffix}</div>
      <div className="lp-stat-label">{label}</div>
    </div>
  );
}

/* ─── Step card ──────────────────────────────── */
function StepCard({ number, title, desc, delay }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lp-step${visible ? ' lp-visible' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="lp-step-num">{number}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

/* ─── Main Component ─────────────────────────── */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true); }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="lp-root">
      {/* ── NAV ── */}
      <nav className={`lp-nav${scrolled ? ' lp-nav-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <a href="#" className="lp-logo">
            <div className="lp-logo-icon">
              <ScanIcon />
            </div>
            <span>DermaAI</span>
          </a>

          <div className={`lp-nav-links${menuOpen ? ' open' : ''}`}>
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a>
            <a href="#privacy" onClick={() => setMenuOpen(false)}>Privacy</a>
            <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          </div>

          <div className="lp-nav-cta">
            <Link to="/login" className="lp-btn-ghost">Sign In</Link>
            <Link to="/signup" className="lp-btn-primary">Get Started <ArrowRightIcon /></Link>
          </div>

          <button className={`lp-hamburger${menuOpen ? ' active' : ''}`} onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu">
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <Particles />
        <div className="lp-hero-bg-glow" />
        <div className="lp-hero-inner">
          <div className="lp-badge-pill">
            <span className="lp-badge-dot" />
            Federated Learning · Privacy-First AI
          </div>

          <h1 className="lp-hero-title">
            AI-Powered Skin Cancer
            <br />
            <span className="lp-gradient-text">Detection at Scale</span>
          </h1>

          <p className="lp-hero-desc">
            DermaAI combines cutting-edge deep learning with privacy-preserving federated learning.
            Hospitals collaborate to train better models — without ever sharing patient data.
          </p>

          <div className="lp-hero-actions">
            <Link to="/signup" id="hero-cta-signup" className="lp-hero-btn-primary">
              Start for Free
              <ArrowRightIcon />
            </Link>
            <a href="#how-it-works" className="lp-hero-btn-ghost">
              See How It Works
            </a>
          </div>

          <div className="lp-hero-trust">
            <div className="lp-trust-avatars">
              {['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444'].map((c, i) => (
                <div key={i} className="lp-trust-avatar" style={{ background: c, zIndex: 5 - i }} />
              ))}
            </div>
          </div>
        </div>

        {/* Hero visual */}
        <div className="lp-hero-visual">
          <div className="lp-visual-card lp-vc-main">
            <div className="lp-vc-header">
              <div className="lp-vc-dot red" /><div className="lp-vc-dot yellow" /><div className="lp-vc-dot green" />
              <span>Live Analysis</span>
            </div>
            <div className="lp-vc-scan-area">
              <div className="lp-scan-img-placeholder">
                <div className="lp-scan-circle">
                  <ScanIcon />
                </div>
                <div className="lp-scan-line" />
              </div>
            </div>
            <div className="lp-vc-result">
              <div className="lp-result-row">
                <span>Melanocytic Nevi</span><span className="lp-result-pct lp-pct-safe">87.3%</span>
              </div>
              <div className="lp-result-bar"><div className="lp-result-bar-fill" style={{ width: '87%', background: '#10b981' }} /></div>
              <div className="lp-result-row" style={{ marginTop: 8 }}>
                <span>Melanoma</span><span className="lp-result-pct lp-pct-warn">9.2%</span>
              </div>
              <div className="lp-result-bar"><div className="lp-result-bar-fill" style={{ width: '9%', background: '#f59e0b' }} /></div>
              <div className="lp-risk-chip lp-risk-low">🟢 Low Risk</div>
            </div>
          </div>

          <div className="lp-visual-card lp-vc-privacy">
            <div className="lp-privacy-icon"><LockIcon /></div>
            <div>
              <div className="lp-fl-title">Data Never Leaves</div>
              <div className="lp-fl-sub">Zero data transfer · HIPAA</div>
            </div>
          </div>
        </div>
      </section>


      {/* ── FEATURES ── */}
      <section className="lp-features" id="features">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <div className="lp-section-tag">Capabilities</div>
            <h2>Everything you need for <span className="lp-gradient-text">clinical-grade</span> detection</h2>
            <p>From upload to diagnosis in seconds — backed by a federated model trained on diverse global datasets.</p>
          </div>
          <div className="lp-features-grid">
            <FeatureCard delay={0} icon={<ScanIcon />} title="Instant Dermoscopy Analysis" description="Upload a skin lesion image and receive a probability breakdown across 7 HAM10000 cancer classes in under 3 seconds." />
            <FeatureCard delay={100} icon={<NetworkIcon />} title="Federated Learning" description="Hospitals contribute to model training without sharing raw patient data. Gradients only — never images." />
            <FeatureCard delay={200} icon={<ShieldIcon />} title="HIPAA-Compliant Privacy" description="End-to-end encryption, on-device computation, and zero data centralisation make compliance effortless." />
            <FeatureCard delay={300} icon={<BrainIcon />} title="EfficientNet-B0 Backbone" description="Fine-tuned state-of-the-art architecture with weighted loss for imbalanced medical datasets." />
            <FeatureCard delay={100} icon={<ChartIcon />} title="Admin Analytics Dashboard" description="Monitor FL rounds, track global model convergence, and manage participating clients from one place." />
            <FeatureCard delay={200} icon={<LockIcon />} title="Role-Based Access Control" description="Separate doctor and admin roles with JWT-secured routes and protected API endpoints." />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-how" id="how-it-works">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <div className="lp-section-tag">Process</div>
            <h2>How <span className="lp-gradient-text">DermaAI</span> works</h2>
            <p>A simple, secure pipeline from image capture to federated insight.</p>
          </div>
          <div className="lp-steps">
            <StepCard number="01" delay={0}    title="Capture & Upload"       desc="Doctors upload dermoscopy images via the web portal or desktop app. Images are processed locally — nothing is sent to external servers." />
            <StepCard number="02" delay={150}  title="On-Device Inference"    desc="The global federated model runs locally, producing instant probabilistic predictions across all 7 skin cancer classes." />
            <StepCard number="03" delay={300}  title="Local Training"         desc="Optionally, participate in federated training. Your device trains on local data for one or more epochs and sends only weight updates." />
            <StepCard number="04" delay={450}  title="Global Aggregation"     desc="The FL server aggregates weight updates from all clients using FedAvg — improving the shared model without accessing raw data." />
          </div>
          <div className="lp-step-connector" aria-hidden="true" />
        </div>
      </section>

      {/* ── PRIVACY SECTION ── */}
      <section className="lp-privacy" id="privacy">
        <div className="lp-privacy-inner">
          <div className="lp-privacy-text">
            <div className="lp-section-tag lp-tag-light">Privacy by Design</div>
            <h2>Patient data stays where it belongs — <span className="lp-gradient-text-light">with you</span></h2>
            <p>We built DermaAI on the principle that AI should benefit patients without compromising their privacy. Traditional centralised approaches require hospitals to share sensitive images. We don't.</p>
            <ul className="lp-privacy-list">
              {[
                'Images never leave the hospital network',
                'Only model gradients are transmitted',
                'Differential privacy noise on updates',
                'Encrypted communication channels',
                'Audit logs for every training round',
                'Full HIPAA & GDPR compliance ready',
              ].map((item, i) => (
                <li key={i}><span className="lp-check"><CheckIcon /></span>{item}</li>
              ))}
            </ul>
          </div>
          <div className="lp-privacy-visual">
            <div className="lp-priv-diagram">
              <div className="lp-priv-center">
                <div className="lp-priv-icon"><NetworkIcon /></div>
                <div className="lp-priv-label">FL Server</div>
              </div>
              {['Hospital A', 'Hospital B', 'Clinic C', 'Lab D'].map((name, i) => (
                <div key={i} className="lp-priv-node" style={{ '--angle': `${i * 90}deg` }}>
                  <div className="lp-priv-node-inner"><ShieldIcon /></div>
                  <div className="lp-priv-node-label">{name}</div>
                  <div className="lp-priv-line" />
                </div>
              ))}
              <div className="lp-priv-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta">
        <div className="lp-cta-glow" />
        <div className="lp-cta-inner">
          <h2>Ready to transform <span className="lp-gradient-text-light">skin cancer detection</span>?</h2>
          <p>Join hundreds of medical institutions using federated AI to improve patient outcomes — without compromising privacy.</p>
          <div className="lp-cta-actions">
            <Link to="/signup" id="cta-final-signup" className="lp-hero-btn-primary lp-btn-large">
              Get Started Free
              <ArrowRightIcon />
            </Link>
            <Link to="/login" className="lp-hero-btn-ghost lp-btn-large lp-ghost-light">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <a href="#" className="lp-logo lp-logo-light">
              <div className="lp-logo-icon"><ScanIcon /></div>
              <span>DermaAI</span>
            </a>
            <p>Privacy-preserving federated learning for skin cancer detection.</p>
          </div>
          <div className="lp-footer-links">
            <div className="lp-footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#privacy">Privacy</a>
            </div>
            <div className="lp-footer-col">
              <h4>Account</h4>
              <Link to="/login">Sign In</Link>
              <Link to="/signup">Create Account</Link>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 DermaAI. Built with federated learning for a healthier world.</span>
        </div>
      </footer>
    </div>
  );
}
