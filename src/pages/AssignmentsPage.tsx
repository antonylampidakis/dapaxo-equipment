import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import AssignAssetModal from "../components/assignments/AssignAssetModal";

interface Asset {
  id: string;
  asset_code: string;
  lifecycle_status: "ACTIVE" | "RETIRED";

  categories: {
    name: string;
  } | null;

  equipment_models: {
    model_name: string | null;

    manufacturers: {
      name: string;
    } | null;
  } | null;
}

interface Location {
  id: string;
  name: string;
  location_type: string;
}

interface Assignment {
  id: string;
  asset_id: string;
  location_id: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

interface CurrentAsset {
  asset: Asset;
  assignment: Assignment | null;
  location: Location | null;
}

interface AssignmentsPageProps {
  canOperate: boolean;
}

export default function AssignmentsPage({
  canOperate,
}: AssignmentsPageProps) {
  const [assets, setAssets] =
    useState<Asset[]>([]);

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [locationFilter, setLocationFilter] =
    useState("");

  const [selectedAsset, setSelectedAsset] =
    useState<{
      id: string;
      code: string;
      currentLocationId: string | null;
    } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const [
      { data: assetData, error: assetError },
      {
        data: locationData,
        error: locationError,
      },
      {
        data: assignmentData,
        error: assignmentError,
      },
    ] = await Promise.all([
      supabase
  .from("assets")
  .select(`
    id,
    asset_code,
    lifecycle_status,
    categories (
      name
    ),
    equipment_models (
      model_name,
      manufacturers (
        name
      )
    )
  `)
  .order("asset_code"),

      supabase
        .from("locations")
        .select(`
          id,
          name,
          location_type
        `)
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("asset_assignments")
        .select(`
          id,
          asset_id,
          location_id,
          started_at,
          ended_at,
          notes
        `)
        .order(
          "started_at",
          { ascending: false }
        ),
    ]);

    if (assetError) {
      console.error(assetError);
      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση του εξοπλισμού."
      );
      setLoading(false);
      return;
    }

    if (locationError) {
      console.error(locationError);
      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση των τοποθεσιών."
      );
      setLoading(false);
      return;
    }

    if (assignmentError) {
      console.error(assignmentError);
      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση των χρεώσεων."
      );
      setLoading(false);
      return;
    }

    setAssets(
      (assetData ?? []) as unknown as Asset[]
    );

    setLocations(
      (locationData ?? []) as Location[]
    );

    setAssignments(
      (assignmentData ?? []) as Assignment[]
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

const activeAssets = useMemo(
  () =>
    assets.filter(
      (asset) => asset.lifecycle_status === "ACTIVE"
    ),
  [assets]
);

  const currentAssets =
    useMemo<CurrentAsset[]>(() => {
      return activeAssets.map((asset) => {
        const assignment =
          assignments.find(
            (item) =>
              item.asset_id === asset.id &&
              item.ended_at === null
          ) ?? null;

        const location = assignment
          ? locations.find(
              (item) =>
                item.id ===
                assignment.location_id
            ) ?? null
          : null;

        return {
          asset,
          assignment,
          location,
        };
      });
    }, [
  activeAssets,
  assignments,
  locations,
]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLocaleLowerCase("el-GR");

    return currentAssets.filter((item) => {
      if (
        statusFilter === "ASSIGNED" &&
        !item.assignment
      ) {
        return false;
      }

      if (
        statusFilter === "UNASSIGNED" &&
        item.assignment
      ) {
        return false;
      }

      if (
        locationFilter &&
        item.location?.id !== locationFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const text = [
        item.asset.asset_code,
        item.asset.categories?.name,
        item.asset.equipment_models
          ?.manufacturers?.name,
        item.asset.equipment_models
          ?.model_name,
        item.location?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("el-GR");

      return text.includes(normalizedSearch);
    });
  }, [
    currentAssets,
    search,
    statusFilter,
    locationFilter,
  ]);

  const stats = useMemo(() => {
    const assigned =
      currentAssets.filter(
        (item) => item.assignment
      ).length;

    return {
      total: currentAssets.length,
      assigned,
      unassigned:
        currentAssets.length - assigned,
    };
  }, [currentAssets]);

  if (loading) {
    return (
      <div className="stock-page">
        <h1>Χρεώσεις / Τοποθετήσεις</h1>
        <p>Φόρτωση δεδομένων...</p>
      </div>
    );
  }

  return (
    <div className="stock-page">
      <div className="stock-page-header">
        <div>
          <h1>Χρεώσεις / Τοποθετήσεις</h1>
          <p>
            Τρέχουσα θέση και ιστορικό
            τοποθετήσεων εξοπλισμού.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadData}
        >
          Ανανέωση
        </button>
      </div>

      {errorMessage && (
        <div className="stock-page-error">
          {errorMessage}
        </div>
      )}

      <div className="stock-stats">
        <div className="stock-stat-card">
          <span>Ενεργά Assets</span>
          <strong>{stats.total}</strong>
          <small>Σύνολο εξοπλισμού</small>
        </div>

        <div className="stock-stat-card">
          <span>Χρεωμένα</span>
          <strong>{stats.assigned}</strong>
          <small>Με ενεργή τοποθεσία</small>
        </div>

        <div className="stock-stat-card">
          <span>Μη χρεωμένα</span>
          <strong>{stats.unassigned}</strong>
          <small>Χωρίς ενεργή τοποθεσία</small>
        </div>
      </div>

      <section className="stock-list-card">
        <div className="stock-list-heading">
          <div>
            <h2>Τρέχουσες τοποθετήσεις</h2>
            <p>
              {filteredAssets.length} από{" "}
              {currentAssets.length} Assets
            </p>
          </div>
        </div>

        <div className="stock-filters">
          <div className="stock-search">
            <label htmlFor="assignment-search">
              Αναζήτηση
            </label>

            <input
              id="assignment-search"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Κωδικός, κατηγορία, μοντέλο..."
            />
          </div>

          <div className="stock-filter">
            <label htmlFor="assignment-status">
              Κατάσταση
            </label>

            <select
              id="assignment-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="">Όλα</option>
              <option value="ASSIGNED">
                Χρεωμένα
              </option>
              <option value="UNASSIGNED">
                Μη χρεωμένα
              </option>
            </select>
          </div>

          <div className="stock-filter">
            <label htmlFor="assignment-location">
              Τοποθεσία
            </label>

            <select
              id="assignment-location"
              value={locationFilter}
              onChange={(event) =>
                setLocationFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                Όλες οι τοποθεσίες
              </option>

              {locations.map((location) => (
                <option
                  key={location.id}
                  value={location.id}
                >
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="stock-table-wrapper">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Κωδικός</th>
                <th>Κατηγορία</th>
                <th>Μοντέλο</th>
                <th>Τρέχουσα τοποθεσία</th>
                <th>Από</th>
                {canOperate && <th></th>}
              </tr>
            </thead>

            <tbody>
              {filteredAssets.map((item) => {
                const manufacturer =
                  item.asset.equipment_models
                    ?.manufacturers?.name;

                const model =
                  item.asset.equipment_models
                    ?.model_name;

                const modelText = [
                  manufacturer,
                  model,
                ]
                  .filter(Boolean)
                  .join(" — ");

                return (
                  <tr key={item.asset.id}>
                    <td>
                      <strong>
                        {item.asset.asset_code}
                      </strong>
                    </td>

                    <td>
                      {item.asset.categories
                        ?.name ?? "—"}
                    </td>

                    <td>
                      {modelText || "—"}
                    </td>

                    <td>
                      {item.location ? (
                        <strong>
                          {item.location.name}
                        </strong>
                      ) : (
                        <span className="stock-muted">
                          Μη χρεωμένο
                        </span>
                      )}
                    </td>

                    <td>
                      {item.assignment
                        ? new Date(
                            item.assignment
                              .started_at
                          ).toLocaleString(
                            "el-GR"
                          )
                        : "—"}
                    </td>

                    {canOperate && (
                      <td>
                        <button
                          type="button"
                          className="stock-action-button"
                          onClick={() =>
                            setSelectedAsset({
                              id: item.asset.id,
                              code:
                                item.asset
                                  .asset_code,
                              currentLocationId:
                                item.location?.id ??
                                null,
                            })
                          }
                        >
                          {item.assignment
                            ? "Αλλαγή"
                            : "Τοποθέτηση"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stock-list-card">
        <div className="stock-list-heading">
          <div>
            <h2>Ιστορικό τοποθετήσεων</h2>
            <p>
              {assignments.length} συνολικές
              εγγραφές
            </p>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="stock-empty">
            Δεν υπάρχει ακόμη ιστορικό
            τοποθετήσεων.
          </div>
        ) : (
          <div className="stock-table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Τοποθεσία</th>
                  <th>Έναρξη</th>
                  <th>Λήξη</th>
                  <th>Σημειώσεις</th>
                </tr>
              </thead>

              <tbody>
                {assignments.map(
                  (assignment) => {
                    const asset =
                      assets.find(
                        (item) =>
                          item.id ===
                          assignment.asset_id
                      );

                    const location =
                      locations.find(
                        (item) =>
                          item.id ===
                          assignment.location_id
                      );

                    return (
                      <tr key={assignment.id}>
                        <td>
                          <strong>
                            {asset?.asset_code ??
                              "—"}
                          </strong>
                        </td>

                        <td>
                          {location?.name ?? "—"}
                        </td>

                        <td>
                          {new Date(
                            assignment.started_at
                          ).toLocaleString(
                            "el-GR"
                          )}
                        </td>

                        <td>
                          {assignment.ended_at
                            ? new Date(
                                assignment.ended_at
                              ).toLocaleString(
                                "el-GR"
                              )
                            : "Ενεργή"}
                        </td>

                        <td>
                          {assignment.notes ||
                            "—"}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canOperate && selectedAsset && (
        <AssignAssetModal
          assetId={selectedAsset.id}
          assetCode={selectedAsset.code}
          currentLocationId={
            selectedAsset.currentLocationId
          }
          onClose={() =>
            setSelectedAsset(null)
          }
          onUpdated={async () => {
            setSelectedAsset(null);
            await loadData();
          }}
        />
      )}
    </div>
  );
}