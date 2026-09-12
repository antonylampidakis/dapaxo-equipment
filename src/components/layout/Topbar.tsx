import type { Session } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";
import type { Profile } from "../../types/profile";

import "./Topbar.css";

interface TopbarProps {
  session: Session;
  profile: Profile;
}

export default function Topbar({
  session,
  profile,
}: TopbarProps) {
  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <header className="topbar">
      <div className="topbar-title">
        Σύστημα Διαχείρισης Εξοπλισμού
      </div>

      <div className="topbar-user">
        <div className="topbar-user-info">
          <span className="topbar-email">
            {profile.full_name || session.user.email}
          </span>

          <span className="topbar-role">
            {profile.role}
          </span>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
        >
          Αποσύνδεση
        </button>
      </div>
    </header>
  );
}