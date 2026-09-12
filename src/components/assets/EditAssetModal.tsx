import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../../lib/supabase";

interface EquipmentModel {
  id: string;
  category_id: string;
  model_name: string | null;

  manufacturers: {
    name: string;
  } | null;
}

interface EditAssetModalProps {
  assetId: string;
  assetCode: string;
  categoryId: string;

  currentModelId: string | null;
  currentSerialNumber: string | null;
  currentNotes: string | null;

  onClose: () => void;
  onUpdated: () => void;
}

export default function EditAssetModal({
  assetId,
  assetCode,
  categoryId,
  currentModelId,
  currentSerialNumber,
  currentNotes,
  onClose,
  onUpdated,
}: EditAssetModalProps) {
  const [models, setModels] =
    useState<EquipmentModel[]>([]);

  const [modelId, setModelId] =
    useState(currentModelId ?? "");

  const [serialNumber, setSerialNumber] =
    useState(currentSerialNumber ?? "");

  const [notes, setNotes] =
    useState(currentNotes ?? "");

  const [loadingData, setLoadingData] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadModels() {
      setLoadingData(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("equipment_models")
        .select(`
          id,
          category_id,
          model_name,
          manufacturers (
            name
          )
        `)
        .eq("category_id", categoryId)
        .order("model_name");

      if (error) {
        console.error(error);

        setErrorMessage(
          "Δεν ήταν δυνατή η φόρτωση των μοντέλων."
        );

        setLoadingData(false);
        return;
      }

      setModels(
        (data ?? []) as unknown as EquipmentModel[]
      );

      setLoadingData(false);
    }

    loadModels();
  }, [categoryId]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const selectedModel = models.find(
      (model) => model.id === modelId
    );

    if (
      selectedModel &&
      selectedModel.category_id !== categoryId
    ) {
      setErrorMessage(
        "Το επιλεγμένο μοντέλο δεν ανήκει στην κατηγορία του εξοπλισμού."
      );

      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.rpc(
      "update_asset_details",
      {
        p_asset_id: assetId,
        p_equipment_model_id:
          modelId || null,
        p_serial_number:
          serialNumber.trim() || null,
        p_notes:
          notes.trim() || null,
      }
    );

    if (error) {
      console.error("Asset update error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      setErrorMessage(
        `${error.code}: ${error.message}`
      );

      setSaving(false);
      return;
    }

    setSaving(false);

    onUpdated();
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
            <h2>
              Επεξεργασία εξοπλισμού
            </h2>

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
            <label htmlFor="edit-asset-model">
              Μοντέλο
            </label>

            <select
              id="edit-asset-model"
              value={modelId}
              onChange={(event) =>
                setModelId(event.target.value)
              }
              disabled={saving}
            >
              <option value="">
                — Χωρίς / άγνωστο μοντέλο —
              </option>

              {models.map((model) => (
                <option
                  key={model.id}
                  value={model.id}
                >
                  {model.manufacturers?.name
                    ? `${model.manufacturers.name} — `
                    : ""}

                  {model.model_name ??
                    "Χωρίς όνομα μοντέλου"}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="edit-asset-serial">
              Serial Number
            </label>

            <input
              id="edit-asset-serial"
              type="text"
              value={serialNumber}
              onChange={(event) =>
                setSerialNumber(
                  event.target.value
                )
              }
              placeholder="Προαιρετικό"
              disabled={saving}
            />
          </div>

          <div className="form-field">
            <label htmlFor="edit-asset-notes">
              Σημειώσεις
            </label>

            <textarea
              id="edit-asset-notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              rows={4}
              placeholder="Προαιρετικές σημειώσεις"
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
                : "Αποθήκευση αλλαγών"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}