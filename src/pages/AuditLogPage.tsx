import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AuditLogPage.css";

type AuditLogRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_code: string | null;
  description: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;

  profiles:
    | {
        full_name: string | null;
        role: string;
      }
    | {
        full_name: string | null;
        role: string;
      }[]
    | null;
};

const ACTION_LABELS: Record<string, string> = {
  ASSET_UPDATED: "Ενημέρωση εξοπλισμού",
  ASSET_RETIRED: "Απόσυρση εξοπλισμού",
  ASSET_REACTIVATED: "Επανενεργοποίηση εξοπλισμού",

  ASSET_LOCATION_CHANGED: "Αλλαγή τοποθεσίας",
  ASSET_LOCATION_UNASSIGNED: "Αφαίρεση από τοποθεσία",

  MAINTENANCE_RECORDED: "Καταχώριση συντήρησης",

  STOCK_MOVEMENT_RECORDED: "Κίνηση αποθέματος",

  USER_CREATED: "Δημιουργία χρήστη",
  USER_ROLE_CHANGED: "Αλλαγή ρόλου χρήστη",
  USER_ACTIVATED: "Ενεργοποίηση χρήστη",
  USER_DEACTIVATED: "Απενεργοποίηση χρήστη",

  EQUIPMENT_MODEL_UPDATED: "Ενημέρωση μοντέλου εξοπλισμού",

  SERVICE_CREATED: "Αποστολή εξοπλισμού για Service",
  SERVICE_RETURNED: "Επιστροφή εξοπλισμού από Service",
  SERVICE_CANCELLED: "Ακύρωση Service",
};

const ENTITY_LABELS: Record<string, string> = {
  ASSET: "Εξοπλισμός",
  STOCK_ITEM: "Απόθεμα",
  USER: "Χρήστης",
  EQUIPMENT_MODEL: "Μοντέλο εξοπλισμού",
  SERVICE_CASE: "Service",
  MAINTENANCE: "Συντήρηση",
};

function getProfile(row: AuditLogRow) {
  if (Array.isArray(row.profiles)) {
    return row.profiles[0] ?? null;
  }

  return row.profiles;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("el-GR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatJson(value: Record<string, unknown> | null) {
  if (!value) {
    return "—";
  }

  return JSON.stringify(value, null, 2);
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");

  const [selectedRow, setSelectedRow] =
    useState<AuditLogRow | null>(null);

  async function loadAuditLog() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("audit_log")
      .select(`
        id,
        created_at,
        user_id,
        action,
        entity_type,
        entity_id,
        entity_code,
        description,
        old_data,
        new_data,
        profiles:user_id (
          full_name,
          role
        )
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Audit log load error:", error);
      setError(
        "Δεν ήταν δυνατή η φόρτωση του ιστορικού ενεργειών."
      );
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as unknown as AuditLogRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadAuditLog();
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("el");

    return rows.filter((row) => {
      const profile = getProfile(row);

      if (
        actionFilter !== "ALL" &&
        row.action !== actionFilter
      ) {
        return false;
      }

      if (
        entityFilter !== "ALL" &&
        row.entity_type !== entityFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchable = [
        profile?.full_name,
        profile?.role,
        row.action,
        ACTION_LABELS[row.action],
        row.entity_type,
        ENTITY_LABELS[row.entity_type],
        row.entity_code,
        row.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("el");

      return searchable.includes(normalizedSearch);
    });
  }, [rows, search, actionFilter, entityFilter]);

  const uniqueActions = useMemo(
    () => [...new Set(rows.map((row) => row.action))].sort(),
    [rows]
  );

  const uniqueEntities = useMemo(
    () =>
      [...new Set(rows.map((row) => row.entity_type))].sort(),
    [rows]
  );

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div>
          <h1>Audit Log</h1>
          <p>
            Ιστορικό κρίσιμων ενεργειών και αλλαγών του
            συστήματος.
          </p>
        </div>

        <button
          type="button"
          className="audit-refresh-button"
          onClick={() => void loadAuditLog()}
          disabled={loading}
        >
          Ανανέωση
        </button>
      </div>

      <div className="audit-stats">
        <div className="audit-stat-card">
          <span>Εγγραφές</span>
          <strong>{rows.length}</strong>
        </div>

        <div className="audit-stat-card">
          <span>Εμφανίζονται</span>
          <strong>{filteredRows.length}</strong>
        </div>

        <div className="audit-stat-card">
          <span>Τύποι ενεργειών</span>
          <strong>{uniqueActions.length}</strong>
        </div>
      </div>

      <div className="audit-filters">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Αναζήτηση χρήστη, κωδικού, ενέργειας..."
        />

        <select
          value={actionFilter}
          onChange={(event) =>
            setActionFilter(event.target.value)
          }
        >
          <option value="ALL">Όλες οι ενέργειες</option>

          {uniqueActions.map((action) => (
            <option key={action} value={action}>
              {ACTION_LABELS[action] ?? action}
            </option>
          ))}
        </select>

        <select
          value={entityFilter}
          onChange={(event) =>
            setEntityFilter(event.target.value)
          }
        >
          <option value="ALL">Όλοι οι τύποι</option>

          {uniqueEntities.map((entity) => (
            <option key={entity} value={entity}>
              {ENTITY_LABELS[entity] ?? entity}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="audit-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="audit-empty">
          Φόρτωση ιστορικού...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="audit-empty">
          Δεν βρέθηκαν εγγραφές.
        </div>
      ) : (
        <div className="audit-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Ημερομηνία</th>
                <th>Χρήστης</th>
                <th>Ενέργεια</th>
                <th>Αντικείμενο</th>
                <th>Κωδικός</th>
                <th>Περιγραφή</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const profile = getProfile(row);

                return (
                  <tr key={row.id}>
                    <td className="audit-date">
                      {formatDate(row.created_at)}
                    </td>

                    <td>
                      <div className="audit-user">
                        <strong>
                          {profile?.full_name ??
                            "Άγνωστος χρήστης"}
                        </strong>

                        {profile?.role && (
                          <span>{profile.role}</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="audit-action-badge">
                        {ACTION_LABELS[row.action] ??
                          row.action}
                      </span>
                    </td>

                    <td>
                      {ENTITY_LABELS[row.entity_type] ??
                        row.entity_type}
                    </td>

                    <td>
                      {row.entity_code ? (
                        <strong>{row.entity_code}</strong>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>
                      {row.description ?? "—"}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="audit-details-button"
                        onClick={() => setSelectedRow(row)}
                      >
                        Λεπτομέρειες
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow && (
        <div
          className="audit-modal-backdrop"
          onMouseDown={() => setSelectedRow(null)}
        >
          <div
            className="audit-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="audit-modal-header">
              <div>
                <h2>Λεπτομέρειες ενέργειας</h2>

                <p>
                  {formatDate(selectedRow.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRow(null)}
              >
                ×
              </button>
            </div>

            <div className="audit-modal-info">
              <div>
                <span>Χρήστης</span>
                <strong>
                  {getProfile(selectedRow)?.full_name ??
                    "Άγνωστος χρήστης"}
                </strong>
              </div>

              <div>
                <span>Ρόλος</span>
                <strong>
                  {getProfile(selectedRow)?.role ?? "—"}
                </strong>
              </div>

              <div>
                <span>Ενέργεια</span>
                <strong>
                  {ACTION_LABELS[selectedRow.action] ??
                    selectedRow.action}
                </strong>
              </div>

              <div>
                <span>Τύπος</span>
                <strong>
                  {ENTITY_LABELS[selectedRow.entity_type] ??
                    selectedRow.entity_type}
                </strong>
              </div>

              <div>
                <span>Κωδικός</span>
                <strong>
                  {selectedRow.entity_code ?? "—"}
                </strong>
              </div>

              <div>
                <span>Περιγραφή</span>
                <strong>
                  {selectedRow.description ?? "—"}
                </strong>
              </div>
            </div>

            <div className="audit-json-grid">
              <div>
                <h3>Πριν</h3>
                <pre>
                  {formatJson(selectedRow.old_data)}
                </pre>
              </div>

              <div>
                <h3>Μετά</h3>
                <pre>
                  {formatJson(selectedRow.new_data)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}