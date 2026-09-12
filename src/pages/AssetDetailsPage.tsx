import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AssetPhotoGallery from "../components/assets/AssetPhotoGallery";
import ChangeAssetLocationModal from "../components/assets/ChangeAssetLocationModal";
import EditAssetModal from "../components/assets/EditAssetModal";
import { supabase } from "../lib/supabase";
import AssetQrLabel from "../components/assets/AssetQrLabel";

import CreateMaintenanceEventModal from "../components/maintenance/CreateMaintenanceEventModal";

import "./AssetDetailsPage.css";

type TechnicalStatus =
  | "FUNCTIONAL"
  | "HAS_ISSUE"
  | "UNDER_REPAIR"
  | "OUT_OF_SERVICE";

interface AssetDetails {
  id: string;
  asset_code: string;

  category_id: string;
  equipment_model_id: string | null;

  serial_number: string | null;
  technical_status: TechnicalStatus;
  lifecycle_status: string;
  notes: string | null;
  created_at: string;

  categories: {
    name: string;
    prefix: string;
  } | null;

  equipment_models: {
    model_name: string | null;

    manufacturers: {
      name: string;
    } | null;
  } | null;

  qr_token: string;
}

interface AssetAssignment {
  id: string;
  asset_id: string;
  location_id: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;

  locations: {
    id: string;
    name: string;
    location_type: string;
  } | null;
}

interface MaintenanceEvent {
  id: string;
  event_type:
    | "INSPECTION"
    | "ISSUE"
    | "REPAIR"
    | "MAINTENANCE"
    | "OTHER";

  event_date: string;
  description: string;

  previous_status:
    | "FUNCTIONAL"
    | "HAS_ISSUE"
    | "UNDER_REPAIR"
    | "OUT_OF_SERVICE";

  new_status:
    | "FUNCTIONAL"
    | "HAS_ISSUE"
    | "UNDER_REPAIR"
    | "OUT_OF_SERVICE";

  notes: string | null;

  created_by: string | null;

  profiles: {
    full_name: string | null;
  } | null;
}

function maintenanceEventTypeLabel(type: string) {
  switch (type) {
    case "INSPECTION":
      return "Έλεγχος";

    case "ISSUE":
      return "Βλάβη / Πρόβλημα";

    case "REPAIR":
      return "Επισκευή";

    case "MAINTENANCE":
      return "Συντήρηση";

    case "OTHER":
      return "Άλλο";

    default:
      return type;
  }
}

function technicalStatusLabel(status: string) {
  switch (status) {
    case "FUNCTIONAL":
      return "Λειτουργικό";

    case "HAS_ISSUE":
      return "Με θέμα";

    case "UNDER_REPAIR":
      return "Σε επισκευή";

    case "OUT_OF_SERVICE":
      return "Εκτός χρήσης";

    default:
      return status;
  }
}

function lifecycleLabel(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Ενεργό";

    case "RETIRED":
      return "Αποσυρμένο";

    default:
      return status;
  }
}

function locationTypeLabel(type: string) {
  switch (type) {
    case "STORAGE":
      return "Αποθήκη";

    case "VEHICLE":
      return "Όχημα";

    case "FACILITY":
      return "Εγκατάσταση";

    case "OTHER":
      return "Άλλο";

    default:
      return type;
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("el-GR");
}

interface AssetDetailsPageProps {
  canOperate: boolean;
}

export default function AssetDetailsPage({
  canOperate,
}: AssetDetailsPageProps) {
  const { id } = useParams<{ id: string }>();

  const [asset, setAsset] =
    useState<AssetDetails | null>(null);

  const [assignments, setAssignments] =
    useState<AssetAssignment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [showLocationModal, setShowLocationModal] =
    useState(false);

  const [showEditModal, setShowEditModal] =
  useState(false);


  const [changingLifecycle, setChangingLifecycle] =
  useState(false);

  const [lifecycleError, setLifecycleError] =
    useState("");

  const [showMaintenanceModal, setShowMaintenanceModal] =
    useState(false);

  const [maintenanceEvents, setMaintenanceEvents] =
    useState<MaintenanceEvent[]>([]);

  const [unassigningLocation, setUnassigningLocation] =
    useState(false);

  const [unassignError, setUnassignError] =
    useState("");

  async function handleMaintenanceCreated() {
    setShowMaintenanceModal(false);

    await loadAsset();
  }
  /*
   * Κοινή function φόρτωσης.
   *
   * Τη χρησιμοποιούμε:
   * - στην πρώτη φόρτωση της σελίδας
   * - μετά από αλλαγή τοποθεσίας
   */
  const loadAsset = useCallback(async () => {
    if (!id) {
      setErrorMessage(
        "Δεν βρέθηκε αναγνωριστικό εξοπλισμού."
      );

      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    /*
     * 1. Φόρτωση Asset.
     */
    const {
  data: assetData,
  error: assetError,
} = await supabase
  .from("assets")
  .select(`
    id,
    asset_code,
    qr_token,
    category_id,
    equipment_model_id,
    serial_number,
    technical_status,
    lifecycle_status,
    notes,
    created_at,
    categories (
      name,
      prefix
    ),
    equipment_models (
      model_name,
      manufacturers (
        name
      )
    )
  `)
  .eq("id", id)
  .single();

    if (assetError) {
      console.error(assetError);

      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση του εξοπλισμού."
      );

      setLoading(false);
      return;
    }

    /*
     * 2. Φόρτωση ιστορικού αναθέσεων.
     */
    const {
      data: assignmentData,
      error: assignmentError,
    } = await supabase
      .from("asset_assignments")
      .select(`
        id,
        asset_id,
        location_id,
        started_at,
        ended_at,
        notes,
        locations (
          id,
          name,
          location_type
        )
      `)
      .eq("asset_id", id)
      .order("started_at", {
        ascending: false,
      });

    if (assignmentError) {
      console.error(assignmentError);

      setErrorMessage(
        "Ο εξοπλισμός φορτώθηκε, αλλά δεν ήταν δυνατή η φόρτωση των αναθέσεων."
      );

      setLoading(false);
      return;
    }

/*
 * 3. Φόρτωση ιστορικού συντήρησης.
 */
const {
  data: maintenanceData,
  error: maintenanceError,
} = await supabase
  .from("maintenance_events")
  .select(`
    id,
    event_type,
    event_date,
    description,
    previous_status,
    new_status,
    notes,
    created_by,
    profiles (
      full_name
    )
  `)
  .eq("asset_id", id)
  .order("event_date", {
    ascending: false,
  });

if (maintenanceError) {
  console.error(
    "Maintenance history error:",
    maintenanceError
  );

  setErrorMessage(
    "Ο εξοπλισμός φορτώθηκε, αλλά δεν ήταν δυνατή η φόρτωση του ιστορικού συντήρησης."
  );

  setLoading(false);
  return;
}

setAsset(
  assetData as unknown as AssetDetails
);

setAssignments(
  (assignmentData ?? []) as unknown as AssetAssignment[]
);

setMaintenanceEvents(
  (maintenanceData ?? []) as unknown as MaintenanceEvent[]
);

setLoading(false);

    setAsset(
      assetData as unknown as AssetDetails
    );

    setAssignments(
      (assignmentData ?? []) as unknown as AssetAssignment[]
    );

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadAsset();
  }, [loadAsset]);



  /*
   * Λόγω του partial UNIQUE index στη DB
   * μπορεί να υπάρχει το πολύ μία ενεργή
   * ανάθεση ανά Asset.
   */
  const currentAssignment =
    assignments.find(
      (assignment) =>
        assignment.ended_at === null
    ) ?? null;

  /*
   * Εκτελείται όταν το modal ολοκληρώσει
   * επιτυχώς την RPC.
   */
  async function handleLocationChanged() {
    setShowLocationModal(false);

    await loadAsset();
  }

  async function handleUnassignLocation() {
  if (!asset || !currentAssignment) {
    return;
  }

  const locationName =
    currentAssignment.locations?.name ??
    "την τρέχουσα τοποθεσία";

  const confirmed = window.confirm(
    `Θέλεις σίγουρα να αποδεσμεύσεις το ${asset.asset_code} από "${locationName}";\n\n` +
      "Η τρέχουσα ανάθεση θα κλείσει, αλλά θα παραμείνει στο ιστορικό."
  );

  if (!confirmed) {
    return;
  }

  setUnassigningLocation(true);
  setUnassignError("");

  const { error } = await supabase.rpc(
    "unassign_asset_from_location",
    {
      p_asset_id: asset.id,
      p_notes: null,
    }
  );

  if (error) {
    console.error(
      "Unassign asset error:",
      error
    );

    setUnassignError(
      `${error.code}: ${error.message}`
    );

    setUnassigningLocation(false);
    return;
  }

  setUnassigningLocation(false);

  await loadAsset();
}

  async function handleAssetUpdated() {
    setShowEditModal(false);

    await loadAsset();
  }

  async function handleRetireAsset() {
  if (!asset) {
    return;
  }

  const confirmed = window.confirm(
    `Θέλεις σίγουρα να αποσύρεις το ${asset.asset_code};\n\n` +
      "Η ενεργή ανάθεση τοποθεσίας θα κλείσει και ο εξοπλισμός θα χαρακτηριστεί ως αποσυρμένος."
  );

  if (!confirmed) {
    return;
  }

  setChangingLifecycle(true);
  setLifecycleError("");

  const { error } = await supabase.rpc(
    "retire_asset",
    {
      p_asset_id: asset.id,
    }
  );

  if (error) {
    console.error("Retire asset error:", error);

    setLifecycleError(
      `${error.code}: ${error.message}`
    );

    setChangingLifecycle(false);
    return;
  }

  setChangingLifecycle(false);

  await loadAsset();
}

async function handleReactivateAsset() {
  if (!asset) {
    return;
  }

  const confirmed = window.confirm(
    `Θέλεις να επανενεργοποιήσεις το ${asset.asset_code};\n\n` +
      "Δεν θα επανέλθει αυτόματα η προηγούμενη τοποθεσία."
  );

  if (!confirmed) {
    return;
  }

  setChangingLifecycle(true);
  setLifecycleError("");

  const { error } = await supabase.rpc(
    "reactivate_asset",
    {
      p_asset_id: asset.id,
    }
  );

  if (error) {
    console.error(
      "Reactivate asset error:",
      error
    );

    setLifecycleError(
      `${error.code}: ${error.message}`
    );

    setChangingLifecycle(false);
    return;
  }

  setChangingLifecycle(false);

  await loadAsset();
}

  if (loading) {
    return <p>Φόρτωση εξοπλισμού...</p>;
  }

  if (errorMessage || !asset) {
    return (
      <div>
        <p className="asset-details-error">
          {errorMessage ||
            "Ο εξοπλισμός δεν βρέθηκε."}
        </p>

        <Link to="/assets">
          ← Επιστροφή στον εξοπλισμό
        </Link>
      </div>
    );
  }

  return (
    <div className="asset-details-page">
      <Link
        to="/assets"
        className="asset-back-link"
      >
        ← Επιστροφή στον εξοπλισμό
      </Link>

      <div className="asset-details-header">
        <div>
          <span className="asset-code-label">
            {asset.asset_code}
          </span>

          <h1>
            {asset.equipment_models
              ?.manufacturers?.name ?? ""}{" "}
            {asset.equipment_models
              ?.model_name ??
              asset.categories?.name ??
              "Εξοπλισμός"}
          </h1>

          <p>
            {asset.categories?.prefix} —{" "}
            {asset.categories?.name}
          </p>
        </div>

        {canOperate && (
  <div className="asset-header-actions">
    <button
      type="button"
      className="primary-button"
      onClick={() => setShowEditModal(true)}
      disabled={changingLifecycle}
    >
      Επεξεργασία
    </button>

    {asset.lifecycle_status === "ACTIVE" && (
      <button
        type="button"
        className="secondary-button"
        onClick={() => setShowMaintenanceModal(true)}
        disabled={changingLifecycle}
      >
        Νέο συμβάν συντήρησης
      </button>
    )}

    {asset.lifecycle_status === "ACTIVE" ? (
      <button
        type="button"
        className="asset-retire-button"
        onClick={handleRetireAsset}
        disabled={changingLifecycle}
      >
        {changingLifecycle
          ? "Απόσυρση..."
          : "Απόσυρση"}
      </button>
    ) : (
      <button
        type="button"
        className="asset-reactivate-button"
        onClick={handleReactivateAsset}
        disabled={changingLifecycle}
      >
        {changingLifecycle
          ? "Επανενεργοποίηση..."
          : "Επανενεργοποίηση"}
      </button>
    )}
  </div>
)}

{lifecycleError && (
  <p className="asset-details-error">
    {lifecycleError}
  </p>
)}
      </div>

      <div className="asset-details-grid">
        <section className="asset-details-card">
          <h2>Βασικά στοιχεία</h2>

          <div className="detail-row">
            <span>Κωδικός</span>

            <strong>
              {asset.asset_code}
            </strong>
          </div>

          <div className="detail-row">
            <span>Κατηγορία</span>

            <strong>
              {asset.categories?.name ?? "—"}
            </strong>
          </div>

          <div className="detail-row">
            <span>Κατασκευαστής</span>

            <strong>
              {asset.equipment_models
                ?.manufacturers?.name ?? "—"}
            </strong>
          </div>

          <div className="detail-row">
            <span>Μοντέλο</span>

            <strong>
              {asset.equipment_models
                ?.model_name ?? "—"}
            </strong>
          </div>

          <div className="detail-row">
            <span>Serial Number</span>

            <strong>
              {asset.serial_number ?? "—"}
            </strong>
          </div>
        </section>

        <section className="asset-details-card">
          <h2>Κατάσταση</h2>

          <div className="detail-row">
            <span>
              Τεχνική κατάσταση
            </span>

            <strong>
              {technicalStatusLabel(
                asset.technical_status
              )}
            </strong>
          </div>

          <div className="detail-row">
            <span>Κύκλος ζωής</span>

            <strong>
              {lifecycleLabel(
                asset.lifecycle_status
              )}
            </strong>
          </div>

          <div className="detail-row">
            <span>Καταχωρίστηκε</span>

            <strong>
              {formatDateTime(
                asset.created_at
              )}
            </strong>
          </div>
        </section>
      </div>

      <AssetPhotoGallery
        assetId={asset.id}
        canOperate={canOperate}
      />

      <section className="asset-details-card asset-notes-card">
        <h2>Σημειώσεις</h2>

        <p>
          {asset.notes ||
            "Δεν υπάρχουν σημειώσεις."}
        </p>
      </section>

{/* ΙΣΤΟΡΙΚΟ ΣΥΝΤΗΡΗΣΗΣ */}
<section className="asset-details-card maintenance-history-card">
  <div className="maintenance-history-header">
    <div>
      <h2>Ιστορικό συντήρησης</h2>

      <p className="muted-text">
        Τεχνικοί έλεγχοι, βλάβες, επισκευές και συντηρήσεις.
      </p>
    </div>

    {canOperate &&
      asset.lifecycle_status === "ACTIVE" && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => setShowMaintenanceModal(true)}
        >
          Νέο συμβάν
        </button>
      )}
  </div>

  {maintenanceEvents.length === 0 ? (
    <p className="muted-text">
      Δεν υπάρχουν ακόμη καταχωρισμένα συμβάντα συντήρησης.
    </p>
  ) : (
    <div className="maintenance-history">
      {maintenanceEvents.map((event) => (
        <div
          key={event.id}
          className="maintenance-history-item"
        >
          <div className="maintenance-history-top">
            <div>
              <strong>
                {maintenanceEventTypeLabel(event.event_type)}
              </strong>

              <span className="maintenance-event-date">
                {formatDateTime(event.event_date)}
              </span>
            </div>

            <div className="maintenance-status-transition">
              <span>
                {technicalStatusLabel(event.previous_status)}
              </span>

              <span>→</span>

              <strong>
                {technicalStatusLabel(event.new_status)}
              </strong>
            </div>
          </div>

          <p className="maintenance-description">
            {event.description}
          </p>

          {event.notes && (
            <p className="maintenance-notes">
              {event.notes}
            </p>
          )}

          <div className="maintenance-history-meta">
            Καταχώριση από:{" "}
            <strong>
              {event.profiles?.full_name ||
                "Χρήστης συστήματος"}
            </strong>
          </div>
        </div>
      ))}
    </div>
  )}
</section>


      <div className="asset-future-grid">
        {/* ΤΡΕΧΟΥΣΑ ΤΟΠΟΘΕΣΙΑ */}
        <section className="asset-details-card">
          <div className="asset-location-header">
  <h2>
    Τρέχουσα τοποθεσία
  </h2>

  {canOperate &&
    asset.lifecycle_status === "ACTIVE" && (
    <div className="asset-location-actions">
      <button
        type="button"
        className="secondary-button"
        onClick={() =>
          setShowLocationModal(true)
        }
        disabled={unassigningLocation}
      >
        {currentAssignment
          ? "Αλλαγή τοποθεσίας"
          : "Ανάθεση τοποθεσίας"}
      </button>

      {currentAssignment && (
        <button
          type="button"
          className="asset-unassign-button"
          onClick={handleUnassignLocation}
          disabled={unassigningLocation}
        >
          {unassigningLocation
            ? "Αποδέσμευση..."
            : "Αποδέσμευση"}
        </button>
      )}
    </div>
  )}
</div>

{unassignError && (
  <p className="asset-details-error">
    {unassignError}
  </p>
)}

          {currentAssignment ? (
            <div className="current-location">
              <strong className="current-location-name">
                {currentAssignment.locations
                  ?.name ??
                  "Άγνωστη τοποθεσία"}
              </strong>

              {currentAssignment.locations && (
                <span className="current-location-type">
                  {locationTypeLabel(
                    currentAssignment
                      .locations
                      .location_type
                  )}
                </span>
              )}

              <p className="muted-text">
                Από{" "}
                {formatDateTime(
                  currentAssignment
                    .started_at
                )}
              </p>

              {currentAssignment.notes && (
                <p>
                  {currentAssignment.notes}
                </p>
              )}
            </div>
          ) : (
            <p className="muted-text">
              Δεν υπάρχει ενεργή ανάθεση.
            </p>
          )}
        </section>

        {/* ΙΣΤΟΡΙΚΟ */}
        <section className="asset-details-card">
          <h2>
            Ιστορικό τοποθεσιών
          </h2>

          {assignments.length === 0 ? (
            <p className="muted-text">
              Δεν υπάρχουν ακόμη
              καταχωρισμένες αναθέσεις.
            </p>
          ) : (
            <div className="assignment-history">
              {assignments.map(
                (assignment) => (
                  <div
                    key={assignment.id}
                    className="assignment-history-item"
                  >
                    <div className="assignment-history-top">
                      <strong>
                        {assignment.locations
                          ?.name ??
                          "Άγνωστη τοποθεσία"}
                      </strong>

                      {assignment.ended_at ===
                        null && (
                        <span className="assignment-current-badge">
                          Τρέχουσα
                        </span>
                      )}
                    </div>

                    {assignment.locations && (
                      <span className="assignment-location-type">
                        {locationTypeLabel(
                          assignment
                            .locations
                            .location_type
                        )}
                      </span>
                    )}

                    <div className="assignment-dates">
                      <span>
                        Από:{" "}
                        {formatDateTime(
                          assignment
                            .started_at
                        )}
                      </span>

                      <span>
                        Έως:{" "}
                        {assignment.ended_at
                          ? formatDateTime(
                              assignment
                                .ended_at
                            )
                          : "Σήμερα"}
                      </span>
                    </div>

                    {assignment.notes && (
                      <p className="assignment-notes">
                        {assignment.notes}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      <AssetQrLabel
  assetCode={asset.asset_code}
  qrToken={asset.qr_token}
/>
      
      {/* MODAL ΕΠΕΞΕΡΓΑΣΙΑΣ ASSET */}
      {canOperate && showEditModal && (
        <EditAssetModal
          assetId={asset.id}
          assetCode={asset.asset_code}
          categoryId={asset.category_id}
          currentModelId={asset.equipment_model_id}
          currentSerialNumber={asset.serial_number}
          currentNotes={asset.notes}
          onClose={() =>
            setShowEditModal(false)
          }
          onUpdated={
            handleAssetUpdated
          }
        />
      )}


      {/* MODAL ΑΛΛΑΓΗΣ ΤΟΠΟΘΕΣΙΑΣ */}
      {canOperate && showLocationModal && (
        <ChangeAssetLocationModal
          assetId={asset.id}
          assetCode={asset.asset_code}
          currentLocationId={
            currentAssignment
              ?.location_id ?? null
          }
          onClose={() =>
            setShowLocationModal(false)
          }
          onChanged={
            handleLocationChanged
          }
        />
      )}

      {/* MODAL ΝΕΟΥ ΣΥΜΒΑΝΤΟΣ ΣΥΝΤΗΡΗΣΗΣ */}
      {canOperate && showMaintenanceModal && (
        <CreateMaintenanceEventModal
          assetId={asset.id}
          assetCode={asset.asset_code}
          currentTechnicalStatus={asset.technical_status}
          onClose={() =>
            setShowMaintenanceModal(false)
          }
          onCreated={handleMaintenanceCreated}
        />
      )}
    </div>
  );
}