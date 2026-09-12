import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { supabase } from "./lib/supabase";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AssetsPage from "./pages/AssetsPage";
import StockPage from "./pages/StockPage";
import LocationsPage from "./pages/LocationsPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import MaintenancePage from "./pages/MaintenancePage";
import AdminPage from "./pages/AdminPage";
import AuditLogPage from "./pages/AuditLogPage";
import AssetDetailsPage from "./pages/AssetDetailsPage";
import PublicAssetQrPage from "./pages/PublicAssetQrPage";

import AppLayout from "./layouts/AppLayout";

import type { Profile } from "./types/profile";

function App() {
  const location = useLocation();

  const [session, setSession] =
    useState<Session | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [profileError, setProfileError] =
    useState("");

  /*
   * =========================================================
   * PUBLIC ROUTES
   * =========================================================
   *
   * Τα QR routes δεν απαιτούν authentication.
   */
  const isPublicQrRoute =
    location.pathname.startsWith("/q/");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);

        if (!newSession) {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!session) {
        setProfile(null);
        return;
      }

      setProfileLoading(true);
      setProfileError("");

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, role, is_active"
        )
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error(error);

        setProfile(null);

        setProfileError(
          "Δεν ήταν δυνατή η φόρτωση του προφίλ."
        );

        setProfileLoading(false);
        return;
      }

      setProfile(data as Profile);
      setProfileLoading(false);
    }

    void loadProfile();
  }, [session]);

  /*
   * =========================================================
   * PUBLIC QR PAGE
   * =========================================================
   */
  if (isPublicQrRoute) {
    return (
      <Routes>
        <Route
          path="/q/:token"
          element={<PublicAssetQrPage />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    );
  }

  /*
   * =========================================================
   * AUTHENTICATION
   * =========================================================
   */

  if (authLoading) {
    return <p>Έλεγχος σύνδεσης...</p>;
  }

  if (!session) {
    return <LoginPage />;
  }

  /*
   * =========================================================
   * PROFILE
   * =========================================================
   */

  if (profileLoading) {
    return <p>Φόρτωση προφίλ...</p>;
  }

  if (profileError || !profile) {
    return (
      <main>
        <h1>Σφάλμα</h1>

        <p>
          {profileError ||
            "Δεν βρέθηκε προφίλ χρήστη."}
        </p>

        <button
          type="button"
          onClick={() =>
            supabase.auth.signOut()
          }
        >
          Αποσύνδεση
        </button>
      </main>
    );
  }

  if (!profile.is_active) {
    return (
      <main>
        <h1>
          Ο λογαριασμός είναι ανενεργός
        </h1>

        <button
          type="button"
          onClick={() =>
            supabase.auth.signOut()
          }
        >
          Αποσύνδεση
        </button>
      </main>
    );
  }


const canOperate =
  profile.role === "OPERATOR" ||
  profile.role === "ADMIN";

const canAdmin =
  profile.role === "ADMIN";

  /*
   * =========================================================
   * AUTHENTICATED APPLICATION
   * =========================================================
   */

  return (
    <Routes>
      <Route
        element={
          <AppLayout
            session={session}
            profile={profile}
          />
        }
      >
        <Route
          index
          element={<DashboardPage />}
        />

       <Route
  path="assets"
  element={
    <AssetsPage canOperate={canOperate} />
  }
/>

<Route
  path="assets/:id"
  element={
    <AssetDetailsPage
      canOperate={canOperate}
    />
  }
/>

<Route
  path="stock"
  element={
    <StockPage canOperate={canOperate} />
  }
/>

<Route
  path="locations"
  element={
    <LocationsPage canAdmin={canAdmin} />
  }
/>

<Route
  path="assignments"
  element={
    <AssignmentsPage
      canOperate={canOperate}
    />
  }
/>

<Route
  path="maintenance"
  element={
    <MaintenancePage
      canOperate={canOperate}
    />
  }
/>

        {canAdmin && (
          <>
            <Route
              path="admin"
              element={<AdminPage />}
            />

            <Route
              path="audit"
              element={<AuditLogPage />}
            />
          </>
        )}

        <Route
          path="*"
          element={
            <Navigate to="/" replace />
          }
        />
      </Route>
    </Routes>
  );
}

export default App;