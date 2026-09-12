import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../../lib/supabase";

interface Location {
  id: string;
  name: string;
  location_type: string;
}

interface ChangeAssetLocationModalProps {
  assetId: string;
  assetCode: string;
  currentLocationId: string | null;
  onClose: () => void;
  onChanged: () => void;
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

export default function ChangeAssetLocationModal({
  assetId,
  assetCode,
  currentLocationId,
  onClose,
  onChanged,
}: ChangeAssetLocationModalProps) {
  const [locations, setLocations] =
    useState<Location[]>([]);

  const [locationId, setLocationId] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [loadingLocations, setLoadingLocations] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadLocations() {
      setLoadingLocations(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("locations")
        .select(`
          id,
          name,
          location_type
        `)
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error(error);

        setErrorMessage(
          "Δεν ήταν δυνατή η φόρτωση των τοποθεσιών."
        );

        setLoadingLocations(false);
        return;
      }

      setLocations(
        (data ?? []) as Location[]
      );

      setLoadingLocations(false);
    }

    loadLocations();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!locationId) {
      setErrorMessage(
        "Επίλεξε τοποθεσία."
      );
      return;
    }

    if (locationId === currentLocationId) {
      setErrorMessage(
        "Το Asset βρίσκεται ήδη σε αυτή την τοποθεσία."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.rpc(
      "assign_asset_to_location",
      {
        p_asset_id: assetId,
        p_location_id: locationId,
        p_notes: notes.trim() || null,
      }
    );

    if (error) {
      console.error(error);

      setErrorMessage(
        "Δεν ήταν δυνατή η αλλαγή τοποθεσίας."
      );

      setSaving(false);
      return;
    }

    setSaving(false);

    onChanged();
  }

  if (loadingLocations) {
    return (
      <div className="modal-backdrop">
        <div className="asset-modal">
          <p>Φόρτωση τοποθεσιών...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="asset-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="asset-modal-header">
          <div>
            <h2>Αλλαγή τοποθεσίας</h2>

            <p>
              Εξοπλισμός:{" "}
              <strong>{assetCode}</strong>
            </p>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Κλείσιμο"
          >
            ×
          </button>
        </div>

        <form
          className="asset-form"
          onSubmit={handleSubmit}
        >
          <div className="form-field">
            <label htmlFor="asset-location">
              Νέα τοποθεσία *
            </label>

            <select
              id="asset-location"
              value={locationId}
              onChange={(event) =>
                setLocationId(
                  event.target.value
                )
              }
              disabled={saving}
              required
            >
              <option value="">
                — Επιλογή τοποθεσίας —
              </option>

              {locations.map((location) => (
                <option
                  key={location.id}
                  value={location.id}
                  disabled={
                    location.id ===
                    currentLocationId
                  }
                >
                  {location.name} —{" "}
                  {locationTypeLabel(
                    location.location_type
                  )}
                  {location.id ===
                  currentLocationId
                    ? " (τρέχουσα)"
                    : ""}
                </option>
              ))}
            </select>

            {locations.length === 0 && (
              <small>
                Δεν υπάρχουν ενεργές
                τοποθεσίες.
              </small>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="assignment-notes">
              Σημειώσεις
            </label>

            <textarea
              id="assignment-notes"
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              rows={3}
              placeholder="Προαιρετικές σημειώσεις για τη μετακίνηση"
              disabled={saving}
            />
          </div>

          {errorMessage && (
            <p className="asset-form-error">
              {errorMessage}
            </p>
          )}

          <div className="asset-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Ακύρωση
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={
                saving ||
                !locationId ||
                locationId === currentLocationId
              }
            >
              {saving
                ? "Αποθήκευση..."
                : "Αλλαγή τοποθεσίας"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}