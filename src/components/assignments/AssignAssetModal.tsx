import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../../lib/supabase";

interface Location {
  id: string;
  name: string;
  location_type: string;
}

interface AssignAssetModalProps {
  assetId: string;
  assetCode: string;
  currentLocationId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function AssignAssetModal({
  assetId,
  assetCode,
  currentLocationId,
  onClose,
  onUpdated,
}: AssignAssetModalProps) {
  const [locations, setLocations] =
    useState<Location[]>([]);

  const [locationId, setLocationId] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadLocations() {
      setLoading(true);

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
        console.error(
          "Locations load error:",
          error
        );

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
        "Ο εξοπλισμός βρίσκεται ήδη σε αυτή την τοποθεσία."
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
      console.error(
        "Assignment error:",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );

      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onUpdated();
  }

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="asset-modal">
          <p>Φόρτωση...</p>
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
          >
            ×
          </button>
        </div>

        <form
          className="asset-form"
          onSubmit={handleSubmit}
        >
          <div className="form-field">
            <label htmlFor="assignment-location">
              Νέα τοποθεσία *
            </label>

            <select
              id="assignment-location"
              value={locationId}
              onChange={(event) =>
                setLocationId(
                  event.target.value
                )
              }
              disabled={saving}
            >
              <option value="">
                — Επίλεξε τοποθεσία —
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
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="assignment-notes">
              Σημειώσεις
            </label>

            <textarea
              id="assignment-notes"
              rows={3}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Προαιρετική αιτιολογία μετακίνησης"
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
              disabled={saving}
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