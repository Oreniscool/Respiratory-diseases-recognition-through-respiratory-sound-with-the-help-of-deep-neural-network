import { Link } from "react-router-dom";
import Activity from "lucide-react/dist/esm/icons/activity.js";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand-col">
          <Link to="/" className="footer-brand">
            <Activity size={22} aria-hidden="true" />
            <span>RespiNet</span>
          </Link>
          <p className="footer-tagline">
            Respiratory sound classification research prototype using deep neural networks.
          </p>
          <p className="footer-disclaimer">
            Not a medical device. Not clinically validated. Must not be used to diagnose, rule out, screen for, or treat disease.
          </p>
        </div>

        <div className="footer-column">
          <h4>Research</h4>
          <Link to="/analyze">Analyze recording</Link>
          <Link to="/evidence">Evidence library</Link>
          <Link to="/evidence#method">Methodology</Link>
          <Link to="/evidence#dataset">Dataset provenance</Link>
        </div>

        <div className="footer-column">
          <h4>Reference</h4>
          <Link to="/learn">Disease reference</Link>
          <Link to="/learn#glossary">Acoustic glossary</Link>
          <Link to="/explainability">Explainability</Link>
          <Link to="/report">Research reports</Link>
        </div>

        <div className="footer-column">
          <h4>About</h4>
          <a href="https://bhatt-dhara.com/ICBHI_final_database/" target="_blank" rel="noreferrer">
            ICBHI Dataset
          </a>
          <Link to="/evidence#about">About RespiNet</Link>
          <a href="https://github.com" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {year} RespiNet Research. All rights reserved.</span>
        <span>Built for respiratory sound research · Not for clinical use</span>
      </div>
    </footer>
  );
}
