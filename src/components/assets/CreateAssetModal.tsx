import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../../lib/supabase";

interface Category {
  id: string;
  prefix: string;
  name: string;
}

interface EquipmentModel {
  id: string;
  category_id: string;
  model_name: string | null;

  manufacturers: {
    name: string;
  } | null;
}

interface CreateAssetModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateAssetModal({
  onClose,
  onCreated,
}: CreateAssetModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [models, setModels] = useState<EquipmentModel[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [modelId, setModelId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [technicalStatus, setTechnicalStatus] =
    useState("FUNCTIONAL");
  const [notes, setNotes] = useState("");

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadFormData() {
      setLoadingData(true);
      setErrorMessage("");

      const [categoriesResult, modelsResult] =
        await Promise.all([
          supabase
            .from("categories")
            .select("id, prefix, name")
            .eq("is_active", true)
            .in("tracking_type", ["ASSET", "MIXED"])
            .order("prefix"),

          supabase
            .from("equipment_models")
            .select(`
              id,
              category_id,
              model_name,
              manufacturers (
                name
              )
            `)
            .order("model_name"),
        ]);

      if (categoriesResult.error) {
        console.error(categoriesResult.error);

        setErrorMessage(
          "Δεν ήταν δυνατή η φόρτωση των κατηγοριών."
        );

        setLoadingData(false);
        return;
      }

      if (modelsResult.error) {
        console.error(modelsResult.error);

        setErrorMessage(
          "Δεν ήταν δυνατή η φόρτωση των μοντέλων."
        );

        setLoadingData(false);
        return;
      }

      setCategories(categoriesResult.data ?? []);

      setModels(
        (modelsResult.data ?? []) as unknown as EquipmentModel[]
      );

      setLoadingData(false);
    }

    loadFormData();
  }, []);

  const availableModels = models.filter(
    (model) => model.category_id === categoryId
  );

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setModelId("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!categoryId) {
      setErrorMessage("Επίλεξε κατηγορία.");
      return;
    }

    const selectedModel = models.find(
      (model) => model.id === modelId
    );

    if (
      selectedModel &&
      selectedModel.category_id !== categoryId
    ) {
      setErrorMessage(
        "Το επιλεγμένο μοντέλο δεν ανήκει στην κατηγορία."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("assets")
      .insert({
        category_id: categoryId,
        equipment_model_id: modelId || null,
        serial_number: serialNumber.trim() || null,
        technical_status: technicalStatus,
        lifecycle_status: "ACTIVE",
        notes: notes.trim() || null,
      })
      .select("id, asset_code")
      .single();

    if (error) {
      console.error(error);

      setErrorMessage(
        "Δεν ήταν δυνατή η καταχώριση του εξοπλισμού."
      );

      setSaving(false);
      return;
    }

    console.log("Asset created:", data.asset_code);

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
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="asset-modal-header">
          <div>
            <h2>Νέος Εξοπλισμός</h2>
            <p>
              Δημιουργία νέου Asset με αυτόματο κωδικό.
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
            <label htmlFor="asset-category">
              Κατηγορία *
            </label>

            <select
              id="asset-category"
              value={categoryId}
              onChange={(event) =>
                handleCategoryChange(event.target.value)
              }
              disabled={saving}
            >
              <option value="">
                — Επιλογή κατηγορίας —
              </option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.prefix} — {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="asset-model">
              Μοντέλο
            </label>

            <select
              id="asset-model"
              value={modelId}
              onChange={(event) =>
                setModelId(event.target.value)
              }
              disabled={!categoryId || saving}
            >
              <option value="">
                — Χωρίς / άγνωστο μοντέλο —
              </option>

              {availableModels.map((model) => (
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

            {categoryId &&
              availableModels.length === 0 && (
                <small>
                  Δεν υπάρχουν καταχωρισμένα μοντέλα
                  για αυτή την κατηγορία.
                </small>
              )}
          </div>

          <div className="form-field">
            <label htmlFor="asset-serial">
              Serial Number
            </label>

            <input
              id="asset-serial"
              type="text"
              value={serialNumber}
              onChange={(event) =>
                setSerialNumber(event.target.value)
              }
              placeholder="Προαιρετικό"
              disabled={saving}
            />
          </div>

          <div className="form-field">
            <label htmlFor="asset-status">
              Τεχνική κατάσταση *
            </label>

            <select
              id="asset-status"
              value={technicalStatus}
              onChange={(event) =>
                setTechnicalStatus(event.target.value)
              }
              disabled={saving}
            >
              <option value="FUNCTIONAL">
                Λειτουργικό
              </option>

              <option value="HAS_ISSUE">
                Με θέμα
              </option>

              <option value="UNDER_REPAIR">
                Σε επισκευή
              </option>

              <option value="OUT_OF_SERVICE">
                Εκτός χρήσης
              </option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="asset-notes">
              Σημειώσεις
            </label>

            <textarea
              id="asset-notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              rows={3}
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
                : "Καταχώριση"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}