import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Activity from "lucide-react/dist/esm/icons/activity.js";
import BookOpen from "lucide-react/dist/esm/icons/book-open.js";
import CircleUserRound from "lucide-react/dist/esm/icons/circle-user-round.js";
import Info from "lucide-react/dist/esm/icons/info.js";
import Menu from "lucide-react/dist/esm/icons/menu.js";
import X from "lucide-react/dist/esm/icons/x.js";

const NAV_ITEMS = [
  { to: "/analyze", label: "Analyze" },
  { to: "/evidence", label: "Evidence library" },
  { to: "/learn", label: "Learn" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="site-header-inner">
        <NavLink to="/" className="brand" aria-label="RespiNet Home">
          <motion.span
            whileHover={{ rotate: [0, -6, 6, -3, 0] }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{ display: "inline-flex" }}
          >
            <Activity aria-hidden="true" />
          </motion.span>
          <span>RespiNet</span>
        </NavLink>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Mobile navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `mobile-nav-link${isActive ? " is-active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
