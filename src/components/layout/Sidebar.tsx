import { NavLink } from "react-router-dom";

import type { Profile } from "../../types/profile";

import "./Sidebar.css";

interface SidebarProps {
  profile: Profile;
}

export default function Sidebar({
  profile,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1 className="sidebar-brand-title">
          ΔΑΠΑΧΟ
        </h1>

        <p className="sidebar-brand-subtitle">
          Διαχείριση Εξοπλισμού
        </p>
      </div>

      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink
              to="/"
              end
              className="sidebar-link"
            >
              Dashboard
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/assets"
              className="sidebar-link"
            >
              Εξοπλισμός
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/stock"
              className="sidebar-link"
            >
              Απόθεμα
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/locations"
              className="sidebar-link"
            >
              Τοποθεσίες
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/assignments"
              className="sidebar-link"
            >
              Χρεώσεις / Τοποθετήσεις
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/maintenance"
              className="sidebar-link"
            >
              Συντήρηση
            </NavLink>
          </li>
        </ul>

        {profile.role === "ADMIN" && (
          <>
            <div className="sidebar-section-label">
              Διαχείριση
            </div>

            <ul>
              <li>
                <NavLink
                  to="/admin"
                  className="sidebar-link"
                >
                  Ρυθμίσεις συστήματος
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/audit"
                  className="sidebar-link"
                >
                  Ιστορικό ενεργειών
                </NavLink>
              </li>
            </ul>
          </>
        )}
      </nav>
    </aside>
  );
}