import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import Activity from "lucide-react/dist/esm/icons/activity.js";
import BookOpen from "lucide-react/dist/esm/icons/book-open.js";
import CircleUserRound from "lucide-react/dist/esm/icons/circle-user-round.js";
import Info from "lucide-react/dist/esm/icons/info.js";
import Menu from "lucide-react/dist/esm/icons/menu.js";
import X from "lucide-react/dist/esm/icons/x.js";

const NAV_ITEMS = [
  { to: "/", label: "Analyze" },
  { to: "/evidence", label: "Evidence library" },
  { to: "/learn", label: "Learn" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/" className="brand" aria-label="RespiNet Analyze">
          <Activity aria-hidden="true" />
          <span>RespiNet</span>
        </NavLink>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-link${isActive ? " is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-utilities">
          <NavLink to="/learn#glossary" className="utility-link">
            <BookOpen size={19} aria-hidden="true" />
            <span>Glossary</span>
          </NavLink>
          <NavLink to="/evidence#about" className="utility-link">
            <Info size={19} aria-hidden="true" />
            <span>About</span>
          </NavLink>
          <span className="utility-link utility-person" aria-label="Research workspace">
            <CircleUserRound size={20} aria-hidden="true" />
            <span>Researcher</span>
          </span>
        </div>

        <button
          type="button"
          className="mobile-menu-button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `mobile-nav-link${isActive ? " is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
