import { useState } from "react";
import { supabase } from "../../lib/supabase";

import "./CreateMaintenanceEventModal.css";

type TechnicalStatus =
  | "FUNCTIONAL"
  | "HAS_ISSUE"
  | "UNDER_REPAIR"
  | "OUT_OF_SERVICE";

type MaintenanceEventType =
  | "INSPECTION"
  | "ISSUE"
  | "REPAIR"
  | "MAINTENANCE"
  | "OTHER";

interface CreateMaintenanceEventModalProps {
  assetId: string;
  assetCode: string;
  currentTechnicalStatus: TechnicalStatus;

  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

const statusLabels: Record<TechnicalStatus, string> = {
  FUNCTIONAL: "Λειτουργικό",
  HAS_ISSUE: "Έχει πρόβλημα",
  UNDER_REPAIR: "Υπό επισκευή",
  OUT_OF_SERVICE: "Εκτός λειτουργίας",
};

export default function CreateMaintenanceEventModal({
  assetId,
  assetCode,
  currentTechnicalStatus,
  onClose,
  onCreated,
}: CreateMaintenanceEventModalProps) {
  const [eventType, setEventType] =
    useState<MaintenanceEventType>("INSPECTION");

  const [newStatus, setNewStatus] =
    useState<TechnicalStatus>(
      currentTechnicalStatus
    );

  const [description, setDescription] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!description.trim()) {
      setErrorMessage(
        "Η περιγραφή είναι υποχρεωτική."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.rpc(
      "record_maintenance_event",
      {
        p_asset_id: assetId,
        p_event_type: eventType,
        p_new_status: newStatus,
        p_description: description.trim(),
        p_notes: notes.trim() || null,
      }
    );

    if (error) {
      console.error(
        "Maintenance event error:",
        error
      );

      setErrorMessage(
        `${error.code}: ${error.message}`
      );

      setSaving(false);
      return;
    }

    setSaving(false);

    await onCreated();
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="maintenance-modal">
        <div className="maintenance-modal-header">
          <div>
            <h2>Νέο συμβάν συντήρησης</h2>

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
          className="maintenance-form"
          onSubmit={handleSubmit}
        >
          <div className="form-field">
            <label htmlFor="maintenance-event-type">
              Τύπος συμβάντος
            </label>

            <select
              id="maintenance-event-type"
              value={eventType}
              onChange={(event) =>
                setEventType(
                  event.target
                    .value as MaintenanceEventType
                )
              }
              disabled={saving}
            >
              <option value="INSPECTION">
                Έλεγχος
              </option>

              <option value="ISSUE">
                Βλάβη / Πρόβλημα
              </option>

              <option value="REPAIR">
                Επισκευή
              </option>

              <option value="MAINTENANCE">
                Συντήρηση
              </option>

              <option value="OTHER">
                Άλλο
              </option>
            </select>
          </div>

          <div className="maintenance-status-change">
            <div>
              <span>Τρέχουσα κατάσταση</span>

              <strong>
                {
                  statusLabels[
                    currentTechnicalStatus
                  ]
                }
              </strong>
            </div>

            <div className="maintenance-status-arrow">
              →
            </div>

            <div>
              <span>Νέα κατάσταση</span>

              <select
                value={newStatus}
                onChange={(event) =>
                  setNewStatus(
                    event.target
                      .value as TechnicalStatus
                  )
                }
                disabled={saving}
              >
                <option value="FUNCTIONAL">
                  Λειτουργικό
                </option>

                <option value="HAS_ISSUE">
                  Έχει πρόβλημα
                </option>

                <option value="UNDER_REPAIR">
                  Υπό επισκευή
                </option>

                <option value="OUT_OF_SERVICE">
                  Εκτός λειτουργίας
                </option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="maintenance-description">
              Περιγραφή *
            </label>

            <textarea
              id="maintenance-description"
              rows={4}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="π.χ. Πρόβλημα στο PTT"
              disabled={saving}
            />
          </div>

          <div className="form-field">
            <label htmlFor="maintenance-notes">
              Σημειώσεις
            </label>

            <textarea
              id="maintenance-notes"
              rows={3}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Προαιρετικές πρόσθετες πληροφορίες"
              disabled={saving}
            />
          </div>

          {errorMessage && (
            <p className="maintenance-form-error">
              {errorMessage}
            </p>
          )}

          <div className="maintenance-form-actions">
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
                ? "Καταχώριση..."
                : "Καταχώριση συμβάντος"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}