import { Outlet } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";



import type { Profile } from "../types/profile";

import "./AppLayout.css";

interface AppLayoutProps {
  session: Session;
  profile: Profile;
}

export default function AppLayout({
  session,
  profile,
}: AppLayoutProps) {
  return (
    <div className="app-layout">
      <Sidebar profile={profile} />

      <div className="app-main-area">
        <Topbar
          session={session}
          profile={profile}
        />

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}