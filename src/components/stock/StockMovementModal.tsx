import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../../lib/supabase";

type MovementType =
  | "RECEIPT"
  | "TRANSFER"
  | "WRITE_OFF"
  | "ADJUSTMENT";

interface Location {
  id: string;
  name: string;
}

interface StockMovementModalProps {
  stockItemId: string;
  stockCode: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function StockMovementModal({
  stockItemId,
  stockCode,
  onClose,
  onCreated,
}: StockMovementModalProps) {
  const [movementType, setMovementType] =
    useState<MovementType>("RECEIPT");

  const [quantity, setQuantity] = useState("");
  const [fromLocationId, setFromLocationId] =
    useState("");
  const [toLocationId, setToLocationId] =
    useState("");

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [loadingData, setLoadingData] =
    useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadLocations() {
      setLoadingData(true);

      const { data, error } = await supabase
        .from("locations")
        .select(`
          id,
          name
        `)
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error(
          "Stock movement locations error:",
          error
        );

        setErrorMessage(
          "Δεν ήταν δυνατή η φόρτωση των τοποθεσιών."
        );

        setLoadingData(false);
        return;
      }

      setLocations(
        (data ?? []) as Location[]
      );

      setLoadingData(false);
    }

    loadLocations();
  }, []);

  useEffect(() => {
    setFromLocationId("");
    setToLocationId("");
    setQuantity("");
    setErrorMessage("");
  }, [movementType]);

  const quantityHelp = useMemo(() => {
    switch (movementType) {
      case "RECEIPT":
        return "Η ποσότητα που παραλήφθηκε.";

      case "TRANSFER":
        return "Η ποσότητα που θα μεταφερθεί.";

      case "WRITE_OFF":
        return "Η ποσότητα που θα αφαιρεθεί από το απόθεμα.";

      case "ADJUSTMENT":
        return "Χρησιμοποίησε θετικό αριθμό για προσθήκη ή αρνητικό για αφαίρεση.";
    }
  }, [movementType]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const parsedQuantity = Number(quantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity === 0
    ) {
      setErrorMessage(
        "Η ποσότητα πρέπει να είναι ακέραιος αριθμός διαφορετικός από το 0."
      );
      return;
    }

    if (
      movementType !== "ADJUSTMENT" &&
      parsedQuantity < 0
    ) {
      setErrorMessage(
        "Η ποσότητα πρέπει να είναι θετική."
      );
      return;
    }

    if (
      movementType === "RECEIPT" &&
      !toLocationId
    ) {
      setErrorMessage(
        "Επίλεξε τοποθεσία παραλαβής."
      );
      return;
    }

    if (
      movementType === "TRANSFER" &&
      (!fromLocationId || !toLocationId)
    ) {
      setErrorMessage(
        "Επίλεξε τοποθεσία προέλευσης και προορισμού."
      );
      return;
    }

    if (
      movementType === "TRANSFER" &&
      fromLocationId === toLocationId
    ) {
      setErrorMessage(
        "Η προέλευση και ο προορισμός πρέπει να είναι διαφορετικές τοποθεσίες."
      );
      return;
    }

    if (
      movementType === "WRITE_OFF" &&
      !fromLocationId
    ) {
      setErrorMessage(
        "Επίλεξε την τοποθεσία από την οποία θα αφαιρεθεί η ποσότητα."
      );
      return;
    }

    if (
      movementType === "ADJUSTMENT" &&
      !toLocationId
    ) {
      setErrorMessage(
        "Επίλεξε την τοποθεσία στην οποία γίνεται η διόρθωση."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.rpc(
      "record_stock_movement",
      {
        p_stock_item_id: stockItemId,
        p_movement_type: movementType,
        p_quantity: parsedQuantity,

        p_from_location_id:
          movementType === "TRANSFER" ||
          movementType === "WRITE_OFF"
            ? fromLocationId
            : null,

        p_to_location_id:
          movementType === "RECEIPT" ||
          movementType === "TRANSFER" ||
          movementType === "ADJUSTMENT"
            ? toLocationId
            : null,

        p_reason:
          reason.trim() || null,

        p_notes:
          notes.trim() || null,
      }
    );

    if (error) {
      console.error(
        "Stock movement error:",
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
    onCreated();
  }

  if (loadingData) {
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
            <h2>Κίνηση αποθέματος</h2>

            <p>
              Είδος:{" "}
              <strong>{stockCode}</strong>
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
            <label htmlFor="movement-type">
              Τύπος κίνησης *
            </label>

            <select
              id="movement-type"
              value={movementType}
              onChange={(event) =>
                setMovementType(
                  event.target.value as MovementType
                )
              }
              disabled={saving}
            >
              <option value="RECEIPT">
                Παραλαβή
              </option>

              <option value="TRANSFER">
                Μεταφορά
              </option>

              <option value="WRITE_OFF">
                Απόσυρση / Αφαίρεση
              </option>

              <option value="ADJUSTMENT">
                Διόρθωση αποθέματος
              </option>
            </select>
          </div>

          {(movementType === "TRANSFER" ||
            movementType === "WRITE_OFF") && (
            <div className="form-field">
              <label htmlFor="from-location">
                {movementType === "TRANSFER"
                  ? "Από τοποθεσία *"
                  : "Τοποθεσία *"}
              </label>

              <select
                id="from-location"
                value={fromLocationId}
                onChange={(event) =>
                  setFromLocationId(
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
                  >
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(movementType === "RECEIPT" ||
            movementType === "TRANSFER" ||
            movementType === "ADJUSTMENT") && (
            <div className="form-field">
              <label htmlFor="to-location">
                {movementType === "RECEIPT"
                  ? "Τοποθεσία παραλαβής *"
                  : movementType === "TRANSFER"
                    ? "Προς τοποθεσία *"
                    : "Τοποθεσία διόρθωσης *"}
              </label>

              <select
                id="to-location"
                value={toLocationId}
                onChange={(event) =>
                  setToLocationId(
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
                      movementType ===
                        "TRANSFER" &&
                      location.id ===
                        fromLocationId
                    }
                  >
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="movement-quantity">
              Ποσότητα *
            </label>

            <input
              id="movement-quantity"
              type="number"
              step="1"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              placeholder={
                movementType === "ADJUSTMENT"
                  ? "π.χ. 2 ή -2"
                  : "π.χ. 10"
              }
              disabled={saving}
              required
            />

            <small>{quantityHelp}</small>
          </div>

          <div className="form-field">
            <label htmlFor="movement-reason">
              Αιτιολογία
            </label>

            <input
              id="movement-reason"
              type="text"
              value={reason}
              onChange={(event) =>
                setReason(event.target.value)
              }
              placeholder="π.χ. Νέα παραλαβή, φθορά, απογραφή..."
              disabled={saving}
            />
          </div>

          <div className="form-field">
            <label htmlFor="movement-notes">
              Σημειώσεις
            </label>

            <textarea
              id="movement-notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              rows={3}
              placeholder="Προαιρετικές πληροφορίες"
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
                ? "Καταχώρηση..."
                : "Καταχώρηση κίνησης"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}