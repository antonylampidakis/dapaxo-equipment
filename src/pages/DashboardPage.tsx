import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase";

import "./DashboardPage.css";

interface DashboardStats {
  activeAssets: number;
  totalStock: number;
  activeAssignments: number;
  problemAssets: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activeAssets: 0,
    totalStock: 0,
    activeAssignments: 0,
    problemAssets: 0,
  });

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setErrorMessage("");

      const [
        assetsResult,
        stockResult,
        assignmentsResult,
        problemsResult,
      ] = await Promise.all([
        supabase
          .from("assets")
          .select("*", { count: "exact", head: true })
          .eq("lifecycle_status", "ACTIVE"),

        supabase
          .from("stock_total_balance")
          .select("total_quantity"),

        supabase
          .from("asset_assignments")
          .select("*", { count: "exact", head: true })
          .is("ended_at", null),

        supabase
          .from("assets")
          .select("*", { count: "exact", head: true })
          .eq("lifecycle_status", "ACTIVE")
          .in("technical_status", [
            "HAS_ISSUE",
            "UNDER_REPAIR",
          ]),
      ]);

      if (assetsResult.error) {
        console.error(assetsResult.error);
        setErrorMessage("Αποτυχία φόρτωσης εξοπλισμού.");
        setLoading(false);
        return;
      }

      if (stockResult.error) {
        console.error(stockResult.error);
        setErrorMessage("Αποτυχία φόρτωσης αποθέματος.");
        setLoading(false);
        return;
      }

      if (assignmentsResult.error) {
        console.error(assignmentsResult.error);
        setErrorMessage("Αποτυχία φόρτωσης τοποθετήσεων.");
        setLoading(false);
        return;
      }

      if (problemsResult.error) {
        console.error(problemsResult.error);
        setErrorMessage(
          "Αποτυχία φόρτωσης τεχνικών καταστάσεων."
        );
        setLoading(false);
        return;
      }

      const totalStock = (stockResult.data ?? []).reduce(
        (sum, item) =>
          sum + Number(item.total_quantity ?? 0),
        0
      );

      setStats({
        activeAssets: assetsResult.count ?? 0,
        totalStock,
        activeAssignments: assignmentsResult.count ?? 0,
        problemAssets: problemsResult.count ?? 0,
      });

      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading) {
    return <p>Φόρτωση Dashboard...</p>;
  }

  if (errorMessage) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p className="dashboard-error">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Συνοπτική εικόνα του εξοπλισμού της ΔΑΠΑΧΟ.
          </p>
        </div>
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">
            Ενεργός Εξοπλισμός
          </span>

          <strong className="stat-value">
            {stats.activeAssets}
          </strong>

          <span className="stat-description">
            Καταγεγραμμένα ενεργά Assets
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-label">
            Συνολικό Απόθεμα
          </span>

          <strong className="stat-value">
            {stats.totalStock}
          </strong>

          <span className="stat-description">
            Συνολικές μονάδες Stock
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-label">
            Ενεργές Τοποθετήσεις
          </span>

          <strong className="stat-value">
            {stats.activeAssignments}
          </strong>

          <span className="stat-description">
            Assets εκτός ή εντός θέσης με ενεργή ανάθεση
          </span>
        </article>

        <article className="stat-card stat-card-warning">
          <span className="stat-label">
            Τεχνικά Θέματα
          </span>

          <strong className="stat-value">
            {stats.problemAssets}
          </strong>

          <span className="stat-description">
            Με θέμα ή σε επισκευή
          </span>
        </article>
      </section>
    </div>
  );
}