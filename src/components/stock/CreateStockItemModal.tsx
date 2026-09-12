import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../../lib/supabase";

interface Category {
  id: string;
  name: string;
  prefix: string;
  tracking_type: "STOCK" | "MIXED";
}

interface EquipmentModel {
  id: string;
  category_id: string;
  model_name: string | null;

  manufacturers: {
    name: string;
  } | null;
}

interface CreateStockItemModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateStockItemModal({
  onClose,
  onCreated,
}: CreateStockItemModalProps) {
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [models, setModels] =
    useState<EquipmentModel[]>([]);

  const [categoryId, setCategoryId] =
    useState("");

  const [modelId, setModelId] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [loadingData, setLoadingData] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadCategories() {
      setLoadingData(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("categories")
        .select(`
          id,
          name,
          prefix,
          tracking_type
        `)
        .eq("is_active", true)
        .in("tracking_type", ["STOCK", "MIXED"])
        .order("name");

      if (error) {
        console.error(
          "Stock categories error:",
          error
        );

        setErrorMessage(
          "Δεν ήταν δυνατή η φόρτωση των κατηγοριών."
        );

        setLoadingData(false);
        return;
      }

      setCategories(
        (data ?? []) as Category[]
      );

      setLoadingData(false);
    }

    loadCategories();
  }, []);

  useEffect(() => {
    async function loadModels() {
      setModelId("");
      setModels([]);

      if (!categoryId) {
        return;
      }

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
        console.error(
          "Stock models error:",
          error
        );

        setErrorMessage(
          "Δεν ήταν δυνατή η φόρτωση των μοντέλων."
        );

        return;
      }

      setModels(
        (data ?? []) as unknown as EquipmentModel[]
      );
    }

    loadModels();
  }, [categoryId]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!categoryId) {
      setErrorMessage(
        "Επίλεξε κατηγορία."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("stock_items")
      .insert({
        category_id: categoryId,
        equipment_model_id:
          modelId || null,
        notes:
          notes.trim() || null,
      });

    if (error) {
      console.error(
        "Create stock item error:",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );

      setErrorMessage(
        `${error.code}: ${error.message}`
      );

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
            <h2>Νέο είδος Stock</h2>

            <p>
              Δημιουργία νέου είδους
              παρακολούθησης αποθέματος.
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
            <label htmlFor="stock-category">
              Κατηγορία *
            </label>

            <select
              id="stock-category"
              value={categoryId}
              onChange={(event) =>
                setCategoryId(
                  event.target.value
                )
              }
              disabled={saving}
              required
            >
              <option value="">
                — Επίλεξε κατηγορία —
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.prefix} —{" "}
                    {category.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="stock-model">
              Μοντέλο
            </label>

            <select
              id="stock-model"
              value={modelId}
              onChange={(event) =>
                setModelId(
                  event.target.value
                )
              }
              disabled={
                saving || !categoryId
              }
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

            {categoryId &&
              models.length === 0 && (
                <small>
                  Δεν υπάρχουν καταχωρημένα
                  μοντέλα για αυτή την
                  κατηγορία.
                </small>
              )}
          </div>

          <div className="form-field">
            <label htmlFor="stock-notes">
              Σημειώσεις
            </label>

            <textarea
              id="stock-notes"
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
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
              disabled={
                saving || !categoryId
              }
            >
              {saving
                ? "Δημιουργία..."
                : "Δημιουργία είδους"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}