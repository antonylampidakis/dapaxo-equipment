import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type { FormEvent } from "react";

import { supabase } from "../lib/supabase";

import "./LocationsPage.css";

interface Location {
  id: string;
  name: string;
  location_type:
    | "STORAGE"
    | "VEHICLE"
    | "FACILITY"
    | "OTHER";
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type LocationType = Location["location_type"];

function locationTypeLabel(type: LocationType) {
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

interface LocationsPageProps {
  canAdmin: boolean;
}

interface LocationsPageProps {
  canAdmin: boolean;
}

export default function LocationsPage({
  canAdmin,
}: LocationsPageProps) {
  const [locations, setLocations] =
    useState<Location[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  /*
   * CREATE
   */
  const [showCreateModal, setShowCreateModal] =
    useState(false);

  /*
   * EDIT
   */
  const [editingLocation, setEditingLocation] =
    useState<Location | null>(null);

  /*
   * Κοινά form fields.
   */
  const [name, setName] =
    useState("");

  const [locationType, setLocationType] =
    useState<LocationType>("STORAGE");

  const [description, setDescription] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [changingStatusId, setChangingStatusId] =
    useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("locations")
      .select(`
        id,
        name,
        location_type,
        description,
        is_active,
        created_at,
        updated_at
      `)
      .order("is_active", {
        ascending: false,
      })
      .order("name", {
        ascending: true,
      });

    if (error) {
      console.error(error);

      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση των τοποθεσιών."
      );

      setLoading(false);
      return;
    }

    setLocations(
      (data ?? []) as Location[]
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  /*
   * CREATE MODAL
   */
  function openCreateModal() {
    setName("");
    setLocationType("STORAGE");
    setDescription("");
    setErrorMessage("");
    setEditingLocation(null);

    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (saving) {
      return;
    }

    setShowCreateModal(false);
  }

  /*
   * EDIT MODAL
   */
  function openEditModal(location: Location) {
    setName(location.name);
    setLocationType(location.location_type);
    setDescription(
      location.description ?? ""
    );

    setErrorMessage("");
    setShowCreateModal(false);
    setEditingLocation(location);
  }

  function closeEditModal() {
    if (saving) {
      return;
    }

    setEditingLocation(null);
  }

  /*
   * CREATE LOCATION
   */
  async function handleCreateLocation(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      setErrorMessage(
        "Συμπλήρωσε όνομα τοποθεσίας."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("locations")
      .insert({
        name: cleanName,
        location_type: locationType,
        description:
          description.trim() || null,
        is_active: true,
      });

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        setErrorMessage(
          "Υπάρχει ήδη τοποθεσία με αυτό το όνομα."
        );
      } else {
        setErrorMessage(
          "Δεν ήταν δυνατή η δημιουργία της τοποθεσίας."
        );
      }

      setSaving(false);
      return;
    }

    setSaving(false);
    setShowCreateModal(false);

    await loadLocations();
  }

  /*
   * UPDATE LOCATION
   */
  async function handleUpdateLocation(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingLocation) {
      return;
    }

    const cleanName = name.trim();

    if (!cleanName) {
      setErrorMessage(
        "Συμπλήρωσε όνομα τοποθεσίας."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("locations")
      .update({
        name: cleanName,
        location_type: locationType,
        description:
          description.trim() || null,
      })
      .eq("id", editingLocation.id);

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        setErrorMessage(
          "Υπάρχει ήδη τοποθεσία με αυτό το όνομα."
        );
      } else {
        setErrorMessage(
          "Δεν ήταν δυνατή η ενημέρωση της τοποθεσίας."
        );
      }

      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingLocation(null);

    await loadLocations();
  }

  /*
   * ACTIVATE / DEACTIVATE
   */
  async function handleToggleStatus(
    location: Location
  ) {
    const newStatus =
      !location.is_active;

    const actionLabel =
      newStatus
        ? "ενεργοποιήσεις"
        : "απενεργοποιήσεις";

    const confirmed = window.confirm(
      `Θέλεις σίγουρα να ${actionLabel} την τοποθεσία "${location.name}";`
    );

    if (!confirmed) {
      return;
    }

    setChangingStatusId(location.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("locations")
      .update({
        is_active: newStatus,
      })
      .eq("id", location.id);

    if (error) {
      console.error(error);

      setErrorMessage(
        newStatus
          ? "Δεν ήταν δυνατή η ενεργοποίηση της τοποθεσίας."
          : "Δεν ήταν δυνατή η απενεργοποίηση της τοποθεσίας."
      );

      setChangingStatusId(null);
      return;
    }

    setChangingStatusId(null);

    await loadLocations();
  }

  const activeLocations =
    locations.filter(
      (location) => location.is_active
    );

  const inactiveLocations =
    locations.filter(
      (location) => !location.is_active
    );

  return (
    <div className="locations-page">
      <div className="locations-header">
        <div>
          <h1>Τοποθεσίες</h1>

          <p>
            Διαχείριση αποθηκών, οχημάτων και
            εγκαταστάσεων.
          </p>
        </div>

        {canAdmin && (
          <button
            type="button"
            className="primary-button"
            onClick={openCreateModal}
          >
            + Νέα τοποθεσία
          </button>
        )}
      </div>

      {errorMessage &&
        !showCreateModal &&
        !editingLocation && (
          <p className="locations-error">
            {errorMessage}
          </p>
        )}

      {loading ? (
        <p>Φόρτωση τοποθεσιών...</p>
      ) : (
        <>
          <div className="locations-summary">
            <div className="location-summary-card">
              <span>Σύνολο</span>

              <strong>
                {locations.length}
              </strong>
            </div>

            <div className="location-summary-card">
              <span>Ενεργές</span>

              <strong>
                {activeLocations.length}
              </strong>
            </div>

            <div className="location-summary-card">
              <span>Ανενεργές</span>

              <strong>
                {inactiveLocations.length}
              </strong>
            </div>
          </div>

          {locations.length === 0 ? (
            <div className="locations-empty">
              <h2>
                Δεν υπάρχουν τοποθεσίες
              </h2>

              <p>
                Δημιούργησε την πρώτη
                τοποθεσία για να μπορείς να
                αναθέτεις εξοπλισμό.
              </p>
            </div>
          ) : (
            <div className="locations-list">
              {locations.map((location) => (
                <article
                  key={location.id}
                  className={`location-card ${
                    !location.is_active
                      ? "location-card-inactive"
                      : ""
                  }`}
                >
                  <div className="location-card-title">
                    <h2>
                      {location.name}
                    </h2>

                    <span
                      className={
                        location.is_active
                          ? "location-status-active"
                          : "location-status-inactive"
                      }
                    >
                      {location.is_active
                        ? "Ενεργή"
                        : "Ανενεργή"}
                    </span>
                  </div>

                  <span className="location-type-badge">
                    {locationTypeLabel(
                      location.location_type
                    )}
                  </span>

                  <p className="location-description">
                    {location.description ||
                      "Δεν υπάρχει περιγραφή."}
                  </p>

                  {canAdmin && (
                  <div className="location-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        openEditModal(location)
                      }
                      disabled={
                        changingStatusId ===
                        location.id
                      }
                    >
                      Επεξεργασία
                    </button>

                    <button
                      type="button"
                      className={
                        location.is_active
                          ? "location-deactivate-button"
                          : "secondary-button"
                      }
                      onClick={() =>
                        handleToggleStatus(
                          location
                        )
                      }
                      disabled={
                        changingStatusId ===
                        location.id
                      }
                    >
                      {changingStatusId ===
                      location.id
                        ? "Αποθήκευση..."
                        : location.is_active
                          ? "Απενεργοποίηση"
                          : "Επανενεργοποίηση"}
                    </button>
                  </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* CREATE MODAL */}
      {canAdmin && showCreateModal && (
        <div
          className="modal-backdrop"
          onMouseDown={closeCreateModal}
        >
          <div
            className="asset-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="asset-modal-header">
              <div>
                <h2>
                  Νέα τοποθεσία
                </h2>

                <p>
                  Δημιουργία νέας θέσης για
                  ανάθεση εξοπλισμού.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeCreateModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              className="asset-form"
              onSubmit={
                handleCreateLocation
              }
            >
              <LocationFormFields
                name={name}
                setName={setName}
                locationType={locationType}
                setLocationType={
                  setLocationType
                }
                description={description}
                setDescription={
                  setDescription
                }
                saving={saving}
              />

              {errorMessage && (
                <p className="asset-form-error">
                  {errorMessage}
                </p>
              )}

              <div className="asset-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeCreateModal}
                  disabled={saving}
                >
                  Ακύρωση
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    saving ||
                    !name.trim()
                  }
                >
                  {saving
                    ? "Αποθήκευση..."
                    : "Δημιουργία"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {canAdmin && editingLocation && (
        <div
          className="modal-backdrop"
          onMouseDown={closeEditModal}
        >
          <div
            className="asset-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="asset-modal-header">
              <div>
                <h2>
                  Επεξεργασία τοποθεσίας
                </h2>

                <p>
                  {editingLocation.name}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeEditModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              className="asset-form"
              onSubmit={
                handleUpdateLocation
              }
            >
              <LocationFormFields
                name={name}
                setName={setName}
                locationType={locationType}
                setLocationType={
                  setLocationType
                }
                description={description}
                setDescription={
                  setDescription
                }
                saving={saving}
              />

              {errorMessage && (
                <p className="asset-form-error">
                  {errorMessage}
                </p>
              )}

              <div className="asset-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeEditModal}
                  disabled={saving}
                >
                  Ακύρωση
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    saving ||
                    !name.trim()
                  }
                >
                  {saving
                    ? "Αποθήκευση..."
                    : "Αποθήκευση αλλαγών"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/*
 * Κοινά fields για Create και Edit.
 */
interface LocationFormFieldsProps {
  name: string;
  setName: (value: string) => void;

  locationType: LocationType;
  setLocationType:
    (value: LocationType) => void;

  description: string;
  setDescription: (value: string) => void;

  saving: boolean;
}

function LocationFormFields({
  name,
  setName,
  locationType,
  setLocationType,
  description,
  setDescription,
  saving,
}: LocationFormFieldsProps) {
  return (
    <>
      <div className="form-field">
        <label htmlFor="location-name">
          Όνομα *
        </label>

        <input
          id="location-name"
          type="text"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          placeholder="π.χ. Όχημα 1"
          disabled={saving}
          autoFocus
        />
      </div>

      <div className="form-field">
        <label htmlFor="location-type">
          Τύπος *
        </label>

        <select
          id="location-type"
          value={locationType}
          onChange={(event) =>
            setLocationType(
              event.target.value as LocationType
            )
          }
          disabled={saving}
        >
          <option value="STORAGE">
            Αποθήκη
          </option>

          <option value="VEHICLE">
            Όχημα
          </option>

          <option value="FACILITY">
            Εγκατάσταση
          </option>

          <option value="OTHER">
            Άλλο
          </option>
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="location-description">
          Περιγραφή
        </label>

        <textarea
          id="location-description"
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value
            )
          }
          rows={3}
          placeholder="Προαιρετική περιγραφή"
          disabled={saving}
        />
      </div>
    </>
  );
}