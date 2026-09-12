import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import CreateAssetModal from "../components/assets/CreateAssetModal";

import "./AssetsPage.css";

interface AssetsPageProps {
  canOperate: boolean;
}

interface AssetRow {
  id: string;
  asset_code: string;
  serial_number: string | null;
  technical_status: string;
  lifecycle_status: string;

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

export default function AssetsPage({
  canOperate,
}: AssetsPageProps) {
  const [assets, setAssets] = useState<AssetRow[]>([]);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const navigate = useNavigate();

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("assets")
      .select(`
        id,
        asset_code,
        serial_number,
        technical_status,
        lifecycle_status,
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
      .order("asset_code");

    if (error) {
      console.error(error);

      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση του εξοπλισμού."
      );

      setLoading(false);
      return;
    }

    setAssets(
      (data ?? []) as unknown as AssetRow[]
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  async function handleAssetCreated() {
    setShowCreateModal(false);

    await loadAssets();
  }

  return (
    <div className="assets-page">
      <div className="assets-header">
        <div>
          <h1>Εξοπλισμός</h1>

          <p>
            Ατομικά καταγεγραμμένος εξοπλισμός με
            μοναδική ταυτότητα.
          </p>
        </div>

        {canOperate && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCreateModal(true)}
          >
            + Νέος Εξοπλισμός
          </button>
        )}
      </div>

      {loading && (
        <p>Φόρτωση εξοπλισμού...</p>
      )}

      {errorMessage && (
        <p className="assets-error">
          {errorMessage}
        </p>
      )}

      {!loading && !errorMessage && (
        <div className="table-card">
          <table className="assets-table">
            <thead>
              <tr>
                <th>Κωδικός</th>
                <th>Κατηγορία</th>
                <th>Κατασκευαστής</th>
                <th>Μοντέλο</th>
                <th>Serial Number</th>
                <th>Κατάσταση</th>
                <th>Κύκλος ζωής</th>
              </tr>
            </thead>

            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="empty-table"
                  >
                    Δεν υπάρχει ακόμη καταγεγραμμένος
                    εξοπλισμός.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="asset-table-row"
                    onClick={() =>
                      navigate(`/assets/${asset.id}`)
                    }
                  >
                    <td>
                      <strong>
                        {asset.asset_code}
                      </strong>
                    </td>

                    <td>
                      {asset.categories?.name ?? "—"}
                    </td>

                    <td>
                      {asset.equipment_models
                        ?.manufacturers?.name ?? "—"}
                    </td>

                    <td>
                      {asset.equipment_models
                        ?.model_name ?? "—"}
                    </td>

                    <td>
                      {asset.serial_number ?? "—"}
                    </td>

                    <td>
                      {technicalStatusLabel(
                        asset.technical_status
                      )}
                    </td>

                    <td>
                      {lifecycleLabel(
                        asset.lifecycle_status
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {canOperate && showCreateModal && (
        <CreateAssetModal
          onClose={() =>
            setShowCreateModal(false)
          }
          onCreated={handleAssetCreated}
        />
      )}
    </div>
  );
}