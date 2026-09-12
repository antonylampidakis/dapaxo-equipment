import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import CreateStockItemModal from "../components/stock/CreateStockItemModal";
import StockMovementModal from "../components/stock/StockMovementModal";
import "./StockPage.css";

interface StockItem {
  id: string;
  stock_code: string;
  notes: string | null;

  categories: {
    id: string;
    name: string;
    prefix: string;
  } | null;

  equipment_models: {
    id: string;
    model_name: string | null;

    manufacturers: {
      name: string;
    } | null;
  } | null;
}

interface StockTotalBalance {
  stock_item_id: string;
  total_quantity: number;
}

interface StockLocationBalance {
  stock_item_id: string;
  location_id: string;
  quantity: number;
}

interface Location {
  id: string;
  name: string;
}

type StockMovementType =
  | "RECEIPT"
  | "TRANSFER"
  | "WRITE_OFF"
  | "ADJUSTMENT";

interface StockMovement {
  id: string;
  stock_item_id: string;
  movement_type: StockMovementType;
  quantity: number;
  from_location_id: string | null;
  to_location_id: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

interface StockDisplayItem extends StockItem {
  totalQuantity: number;
  locations: StockLocationBalance[];
}

interface StockPageProps {
  canOperate: boolean;
}

export default function StockPage({
  canOperate,
}: StockPageProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [totalBalances, setTotalBalances] =
    useState<StockTotalBalance[]>([]);
  const [locationBalances, setLocationBalances] =
    useState<StockLocationBalance[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] =
    useState("");

  const [createModalOpen, setCreateModalOpen] =
    useState(false);

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [movementItem, setMovementItem] =
    useState<{
      id: string;
      code: string;
    } | null>(null);

  const [movements, setMovements] =
    useState<StockMovement[]>([]);

  const [movementSearch, setMovementSearch] =
    useState("");
  const [movementTypeFilter, setMovementTypeFilter] =
    useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const [
      { data: itemData, error: itemError },
      { data: totalData, error: totalError },
      { data: locationData, error: locationError },
      { data: locationsData, error: locationsError },
      { data: movementsData, error: movementsError },
    ] = await Promise.all([
      supabase
        .from("stock_items")
        .select(`
          id,
          stock_code,
          notes,
          categories (
            id,
            name,
            prefix
          ),
          equipment_models (
            id,
            model_name,
            manufacturers (
              name
            )
          )
        `)
        .order("stock_code"),

      supabase
        .from("stock_total_balance")
        .select(`
          stock_item_id,
          total_quantity
        `),

      supabase
        .from("stock_balance_by_location")
        .select(`
          stock_item_id,
          location_id,
          quantity
        `),

      supabase
        .from("locations")
        .select(`
          id,
          name
        `)
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("stock_movements")
        .select(`
          id,
          stock_item_id,
          movement_type,
          quantity,
          from_location_id,
          to_location_id,
          reason,
          notes,
          created_at
        `)
        .order("created_at", { ascending: false }),
    ]);

    if (itemError) {
      console.error("Stock items error:", itemError);

      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση των ειδών αποθέματος."
      );

      setLoading(false);
      return;
    }

    if (totalError) {
      console.error("Stock totals error:", totalError);

      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση των ποσοτήτων αποθέματος."
      );

      setLoading(false);
      return;
    }

    if (locationError) {
      console.error(
        "Stock location balances error:",
        locationError
      );


      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση των αποθεμάτων ανά τοποθεσία."
      );

      setLoading(false);
      return;
    }

    if (locationsError) {
        console.error(
          "Locations error:",
          locationsError
        );

        setErrorMessage(
          "Δεν ήταν δυνατή η φόρτωση των τοποθεσιών."
        );

        setLoading(false);
        return;
      }

    if (movementsError) {
      console.error(
        "Stock movements error:",
        movementsError
      );

      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση του ιστορικού κινήσεων."
      );

      setLoading(false);
      return;
    }

    setItems(
      (itemData ?? []) as unknown as StockItem[]
    );

    setTotalBalances(
      (totalData ?? []) as unknown as StockTotalBalance[]
    );

    setLocationBalances(
      (locationData ?? []) as unknown as StockLocationBalance[]
    );

    setLocations(
      (locationsData ?? []) as Location[]
    );

    setMovements(
      (movementsData ?? []) as unknown as StockMovement[]
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayItems = useMemo<StockDisplayItem[]>(() => {
  return items.map((item) => {
    const totalBalance = totalBalances.find(
      (balance) =>
        balance.stock_item_id === item.id
    );

    const itemLocationBalances = locationBalances
      .filter(
        (balance) =>
          balance.stock_item_id === item.id &&
          Number(balance.quantity) !== 0
      )
      .sort((a, b) => {
        const locationA =
          locations.find(
            (location) =>
              location.id === a.location_id
          )?.name ?? "";

        const locationB =
          locations.find(
            (location) =>
              location.id === b.location_id
          )?.name ?? "";

        return locationA.localeCompare(
          locationB,
          "el"
        );
      });

    return {
      ...item,
      totalQuantity: Number(
        totalBalance?.total_quantity ?? 0
      ),
      locations: itemLocationBalances,
    };
  });
}, [
  items,
  totalBalances,
  locationBalances,
  locations,
]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLocaleLowerCase("el-GR");

    return displayItems.filter((item) => {
      if (
        availabilityFilter === "AVAILABLE" &&
        item.totalQuantity <= 0
      ) {
        return false;
      }

      if (
        availabilityFilter === "ZERO" &&
        item.totalQuantity !== 0
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        item.stock_code,
        item.categories?.name,
        item.categories?.prefix,
        item.equipment_models?.manufacturers?.name,
        item.equipment_models?.model_name,
        item.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("el-GR");

      return searchableText.includes(normalizedSearch);
    });
  }, [
    displayItems,
    search,
    availabilityFilter,
  ]);

  const movementTypeLabel = (
    type: StockMovementType
  ) => {
    switch (type) {
      case "RECEIPT":
        return "Παραλαβή";
      case "TRANSFER":
        return "Μεταφορά";
      case "WRITE_OFF":
        return "Απόσυρση";
      case "ADJUSTMENT":
        return "Διόρθωση";
    }
  };

  const locationName = (locationId: string | null) => {
    if (!locationId) {
      return "—";
    }

    return (
      locations.find(
        (location) => location.id === locationId
      )?.name ?? "—"
    );
  };

  const filteredMovements = useMemo(() => {
    const normalizedSearch = movementSearch
      .trim()
      .toLocaleLowerCase("el-GR");

    return movements.filter((movement) => {
      if (
        movementTypeFilter &&
        movement.movement_type !== movementTypeFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const item = items.find(
        (stockItem) =>
          stockItem.id === movement.stock_item_id
      );

      const searchableText = [
        item?.stock_code,
        item?.categories?.name,
        item?.equipment_models?.manufacturers?.name,
        item?.equipment_models?.model_name,
        movement.reason,
        movement.notes,
        locationName(movement.from_location_id),
        locationName(movement.to_location_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("el-GR");

      return searchableText.includes(normalizedSearch);
    });
  }, [
    movements,
    movementSearch,
    movementTypeFilter,
    items,
    locations,
  ]);

  const stats = useMemo(() => {
    const totalTypes = displayItems.length;

    const availableTypes = displayItems.filter(
      (item) => item.totalQuantity > 0
    ).length;

    const zeroTypes = displayItems.filter(
      (item) => item.totalQuantity === 0
    ).length;

    const totalUnits = displayItems.reduce(
      (sum, item) =>
        sum + Math.max(0, item.totalQuantity),
      0
    );

    return {
      totalTypes,
      availableTypes,
      zeroTypes,
      totalUnits,
    };
  }, [displayItems]);

  if (loading) {
    return (
      <div className="stock-page">
        <h1>Απόθεμα</h1>
        <p>Φόρτωση δεδομένων...</p>
      </div>
    );
  }

  return (
    <div className="stock-page">
      <div className="stock-page-header">
        <div>
          <h1>Απόθεμα</h1>

          <p>
            Διαχείριση ειδών Stock και διαθέσιμων
            ποσοτήτων ανά τοποθεσία.
          </p>
        </div>

        <div className="stock-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={loadData}
          >
            Ανανέωση
          </button>

          {canOperate && (
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setCreateModalOpen(true)
              }
            >
              + Νέο είδος
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="stock-page-error">
          {errorMessage}
        </div>
      )}

      <div className="stock-stats">
        <div className="stock-stat-card">
          <span>Είδη Stock</span>
          <strong>{stats.totalTypes}</strong>
          <small>Καταχωρημένοι τύποι</small>
        </div>

        <div className="stock-stat-card">
          <span>Συνολικές μονάδες</span>
          <strong>{stats.totalUnits}</strong>
          <small>Διαθέσιμο απόθεμα</small>
        </div>

        <div className="stock-stat-card">
          <span>Με απόθεμα</span>
          <strong>{stats.availableTypes}</strong>
          <small>Είδη με ποσότητα &gt; 0</small>
        </div>

        <div className="stock-stat-card">
          <span>Μηδενικό απόθεμα</span>
          <strong>{stats.zeroTypes}</strong>
          <small>Είδη που χρειάζονται έλεγχο</small>
        </div>
      </div>

      <section className="stock-list-card">
        <div className="stock-list-heading">
          <div>
            <h2>Είδη αποθέματος</h2>

            <p>
              {filteredItems.length} από{" "}
              {displayItems.length} είδη
            </p>
          </div>
        </div>

        <div className="stock-filters">
          <div className="stock-search">
            <label htmlFor="stock-search">
              Αναζήτηση
            </label>

            <input
              id="stock-search"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Κωδικός, κατηγορία, κατασκευαστής, μοντέλο..."
            />
          </div>

          <div className="stock-filter">
            <label htmlFor="stock-availability">
              Διαθεσιμότητα
            </label>

            <select
              id="stock-availability"
              value={availabilityFilter}
              onChange={(event) =>
                setAvailabilityFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                Όλα τα είδη
              </option>

              <option value="AVAILABLE">
                Με διαθέσιμο απόθεμα
              </option>

              <option value="ZERO">
                Μηδενικό απόθεμα
              </option>
            </select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="stock-empty">
            {displayItems.length === 0
              ? "Δεν υπάρχουν ακόμη καταχωρημένα είδη Stock."
              : "Δεν βρέθηκαν είδη με τα συγκεκριμένα φίλτρα."}
          </div>
        ) : (
          <div className="stock-table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Κωδικός</th>
                  <th>Κατηγορία</th>
                  <th>Κατασκευαστής / Μοντέλο</th>
                  <th>Ανά τοποθεσία</th>
                  <th>Σύνολο</th>
                  {canOperate && <th></th>}
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => {
                  const manufacturer =
                    item.equipment_models
                      ?.manufacturers?.name;

                  const model =
                    item.equipment_models
                      ?.model_name;

                  const modelText = [
                    manufacturer,
                    model,
                  ]
                    .filter(Boolean)
                    .join(" — ");

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>
                          {item.stock_code}
                        </strong>
                      </td>

                      <td>
                        {item.categories?.name ??
                          "—"}
                      </td>

                      <td>
                        {modelText || "—"}
                      </td>

                      <td>
                        {item.locations.length ===
                        0 ? (
                          <span className="stock-muted">
                            Χωρίς απόθεμα
                          </span>
                        ) : (
                          <div className="stock-location-list">
                            {item.locations.map(
                              (balance) => (
                                <div
                                  key={
                                    balance.location_id
                                  }
                                  className="stock-location-row"
                                >
                                  <span>
                                    {locations.find(
                                      (location) =>
                                        location.id ===
                                        balance.location_id
                                    )?.name ?? "—"}
                                  </span>

                                  <strong>
                                    {Number(
                                      balance.quantity
                                    )}
                                  </strong>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            item.totalQuantity > 0
                              ? "stock-quantity stock-quantity-positive"
                              : "stock-quantity stock-quantity-zero"
                          }
                        >
                          {item.totalQuantity}
                        </span>
                      </td>

                      {canOperate && (
                        <td>
                          <button
                            type="button"
                            className="stock-action-button"
                            onClick={() =>
                              setMovementItem({
                                id: item.id,
                                code: item.stock_code,
                              })
                            }
                          >
                            Κίνηση
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="stock-list-card">
        <div className="stock-list-heading">
          <div>
            <h2>Ιστορικό κινήσεων</h2>
            <p>
              {filteredMovements.length} από{" "}
              {movements.length} κινήσεις
            </p>
          </div>
        </div>

        <div className="stock-filters">
          <div className="stock-search">
            <label htmlFor="stock-movement-search">
              Αναζήτηση
            </label>

            <input
              id="stock-movement-search"
              type="search"
              value={movementSearch}
              onChange={(event) =>
                setMovementSearch(event.target.value)
              }
              placeholder="Κωδικός, τοποθεσία, αιτιολογία..."
            />
          </div>

          <div className="stock-filter">
            <label htmlFor="stock-movement-type">
              Τύπος κίνησης
            </label>

            <select
              id="stock-movement-type"
              value={movementTypeFilter}
              onChange={(event) =>
                setMovementTypeFilter(event.target.value)
              }
            >
              <option value="">Όλες οι κινήσεις</option>
              <option value="RECEIPT">Παραλαβές</option>
              <option value="TRANSFER">Μεταφορές</option>
              <option value="WRITE_OFF">Αποσύρσεις</option>
              <option value="ADJUSTMENT">Διορθώσεις</option>
            </select>
          </div>
        </div>

        {filteredMovements.length === 0 ? (
          <div className="stock-empty">
            {movements.length === 0
              ? "Δεν υπάρχουν ακόμη κινήσεις αποθέματος."
              : "Δεν βρέθηκαν κινήσεις με τα συγκεκριμένα φίλτρα."}
          </div>
        ) : (
          <div className="stock-table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Ημερομηνία</th>
                  <th>Είδος</th>
                  <th>Τύπος</th>
                  <th>Ποσότητα</th>
                  <th>Από</th>
                  <th>Προς</th>
                  <th>Αιτιολογία / Σημειώσεις</th>
                </tr>
              </thead>

              <tbody>
                {filteredMovements.map((movement) => {
                  const item = items.find(
                    (stockItem) =>
                      stockItem.id === movement.stock_item_id
                  );

                  return (
                    <tr key={movement.id}>
                      <td>
                        {new Date(
                          movement.created_at
                        ).toLocaleString("el-GR")}
                      </td>

                      <td>
                        <strong>
                          {item?.stock_code ?? "—"}
                        </strong>
                      </td>

                      <td>
                        {movementTypeLabel(
                          movement.movement_type
                        )}
                      </td>

                      <td>
                        <strong>
                          {movement.movement_type === "ADJUSTMENT" &&
                          movement.quantity > 0
                            ? `+${movement.quantity}`
                            : movement.quantity}
                        </strong>
                      </td>

                      <td>
                        {locationName(
                          movement.from_location_id
                        )}
                      </td>

                      <td>
                        {locationName(
                          movement.to_location_id
                        )}
                      </td>

                      <td>
                        <div className="stock-location-list">
                          <span>
                            {movement.reason || "—"}
                          </span>

                          {movement.notes && (
                            <small className="stock-muted">
                              {movement.notes}
                            </small>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canOperate && createModalOpen && (
  <CreateStockItemModal
    onClose={() =>
      setCreateModalOpen(false)
    }
    onCreated={async () => {
      setCreateModalOpen(false);
      await loadData();
    }}
  />
)}
{canOperate && movementItem && (
  <StockMovementModal
    stockItemId={movementItem.id}
    stockCode={movementItem.code}
    onClose={() =>
      setMovementItem(null)
    }
    onCreated={async () => {
      setMovementItem(null);
      await loadData();
    }}
  />
)}
    </div>
  );
}