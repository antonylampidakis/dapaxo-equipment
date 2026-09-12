import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../lib/supabase";

import "./AdminPage.css";

interface Manufacturer {
  id: string;
  name: string;
  created_at: string;
}

interface Category {
  id: string;
  prefix: string;
  name: string;
  tracking_type: "ASSET" | "STOCK" | "MIXED";
  category_group: "RADIO" | "OPERATIONAL" | "IT";
}

interface EquipmentModel {
  id: string;
  category_id: string;
  manufacturer_id: string | null;
  model_name: string | null;
  model_code: string | null;
  description: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  categories: {
    name: string;
    prefix: string;
  } | null;

  manufacturers: {
    name: string;
  } | null;
}

type ModelDocumentType =
  | "USER_MANUAL"
  | "QUICK_START"
  | "TECHNICAL_MANUAL"
  | "OTHER";

interface EquipmentModelDocument {
  id: string;
  equipment_model_id: string;
  document_type: ModelDocumentType;
  title: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  is_public: boolean;
  created_at: string;
}

const MODEL_DOCUMENT_TYPE_LABELS: Record<ModelDocumentType, string> = {
  USER_MANUAL: "Εγχειρίδιο χρήσης",
  QUICK_START: "Γρήγορος οδηγός",
  TECHNICAL_MANUAL: "Τεχνικό εγχειρίδιο",
  OTHER: "Άλλο",
};

const MAX_MODEL_DOCUMENT_SIZE = 10 * 1024 * 1024;

type UserRole = "VIEWER" | "OPERATOR" | "ADMIN";

interface UserProfile {
  id: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type AdminSection =
  | "manufacturers"
  | "models"
  | "categories"
  | "users";

export default function AdminPage() {
  const [activeSection, setActiveSection] =
    useState<AdminSection>("manufacturers");

  const [manufacturers, setManufacturers] = useState<
    Manufacturer[]
  >([]);

  const [categories, setCategories] = useState<Category[]>([]);

  const [models, setModels] = useState<EquipmentModel[]>([]);

  const [manufacturerName, setManufacturerName] =
    useState("");

  const [selectedCategoryId, setSelectedCategoryId] =
    useState("");

  const [selectedManufacturerId, setSelectedManufacturerId] =
    useState("");

  const [modelName, setModelName] = useState("");
  const [modelCode, setModelCode] = useState("");
  const [modelDescription, setModelDescription] = useState("");
  const [modelNotes, setModelNotes] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [editingModel, setEditingModel] = useState<EquipmentModel | null>(null);
  const [editManufacturerId, setEditManufacturerId] = useState("");
  const [editModelName, setEditModelName] = useState("");
  const [editModelCode, setEditModelCode] = useState("");
  const [editModelDescription, setEditModelDescription] = useState("");
  const [editModelNotes, setEditModelNotes] = useState("");
  const [editModelActive, setEditModelActive] = useState(true);
  const [savingModelEdit, setSavingModelEdit] = useState(false);

  const [modelDocuments, setModelDocuments] = useState<EquipmentModelDocument[]>([]);
  const [loadingModelDocuments, setLoadingModelDocuments] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] =
    useState<ModelDocumentType>("USER_MANUAL");
  const [documentIsPublic, setDocumentIsPublic] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState("");
  const [documentSuccess, setDocumentSuccess] = useState("");

  const [loadingManufacturers, setLoadingManufacturers] =
    useState(true);

  const [loadingModels, setLoadingModels] = useState(true);

  const [savingManufacturer, setSavingManufacturer] =
    useState(false);

  const [savingModel, setSavingModel] = useState(false);

  const [manufacturerError, setManufacturerError] =
    useState("");

  const [manufacturerSuccess, setManufacturerSuccess] =
    useState("");

  const [modelError, setModelError] = useState("");

  const [modelSuccess, setModelSuccess] = useState("");

  const [users, setUsers] = useState<UserProfile[]>([]);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [loadingUsers, setLoadingUsers] =
    useState(true);

  const [updatingUserId, setUpdatingUserId] =
    useState<string | null>(null);

    const [newUserFullName, setNewUserFullName] =
  useState("");

const [newUserEmail, setNewUserEmail] =
  useState("");

const [newUserPassword, setNewUserPassword] =
  useState("");

const [newUserRole, setNewUserRole] =
  useState<UserRole>("VIEWER");

const [creatingUser, setCreatingUser] =
  useState(false);

const [createUserError, setCreateUserError] =
  useState("");

const [createUserSuccess, setCreateUserSuccess] =
  useState("");

  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState("");

  async function loadManufacturers() {
    setLoadingManufacturers(true);

    const { data, error } = await supabase
      .from("manufacturers")
      .select("id, name, created_at")
      .order("name");

    if (error) {
      console.error(error);
      setManufacturerError(
        "Δεν ήταν δυνατή η φόρτωση των κατασκευαστών."
      );

      setLoadingManufacturers(false);
      return;
    }

    setManufacturers(data ?? []);
    setLoadingManufacturers(false);
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select(
        "id, prefix, name, tracking_type, category_group"
      )
      .eq("is_active", true)
      .order("prefix");

    if (error) {
      console.error(error);
      setModelError(
        "Δεν ήταν δυνατή η φόρτωση των κατηγοριών."
      );
      return;
    }

    setCategories((data ?? []) as Category[]);
  }

  async function loadModels() {
    setLoadingModels(true);

    const { data, error } = await supabase
      .from("equipment_models")
      .select(`
        id,
        category_id,
        manufacturer_id,
        model_name,
        model_code,
        description,
        notes,
        is_active,
        created_at,
        updated_at,
        categories (name, prefix),
        manufacturers (name)
      `)
      .order("model_name");

    if (error) {
      console.error("Models load error:", error);
      setModelError("Δεν ήταν δυνατή η φόρτωση των μοντέλων.");
      setLoadingModels(false);
      return;
    }

    setModels((data ?? []) as unknown as EquipmentModel[]);
    setLoadingModels(false);
  }

  async function loadUsers() {
  setLoadingUsers(true);
  setUserError("");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  setCurrentUserId(user?.id ?? null);

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
    `)
    .order("full_name");

  if (error) {
    console.error("Users load error:", error);

    setUserError(
      "Δεν ήταν δυνατή η φόρτωση των χρηστών."
    );

    setLoadingUsers(false);
    return;
  }

  setUsers((data ?? []) as UserProfile[]);
  setLoadingUsers(false);
}

async function handleRoleChange(
  userId: string,
  role: UserRole
) {
  setUpdatingUserId(userId);
  setUserError("");
  setUserSuccess("");

  const { error } = await supabase.rpc(
    "set_user_role",
    {
      p_user_id: userId,
      p_role: role,
    }
  );

  if (error) {
    console.error("Role update error:", error);
    setUserError(
      `Δεν ήταν δυνατή η αλλαγή ρόλου: ${error.message}`
    );
    setUpdatingUserId(null);
    return;
  }

  setUserSuccess(
    "Ο ρόλος του χρήστη ενημερώθηκε."
  );

  await loadUsers();
  setUpdatingUserId(null);
}

async function handleActiveChange(
  userId: string,
  isActive: boolean
) {
  const action = isActive
    ? "ενεργοποιήσεις"
    : "απενεργοποιήσεις";

  const confirmed = window.confirm(
    `Θέλεις να ${action} αυτόν τον χρήστη;`
  );

  if (!confirmed) {
    return;
  }

  setUpdatingUserId(userId);
  setUserError("");
  setUserSuccess("");

  const { error } = await supabase.rpc(
    "set_user_active",
    {
      p_user_id: userId,
      p_is_active: isActive,
    }
  );

  if (error) {
    console.error("Active update error:", error);
    setUserError(
      `Δεν ήταν δυνατή η αλλαγή κατάστασης: ${error.message}`
    );
    setUpdatingUserId(null);
    return;
  }

  setUserSuccess(
    isActive
      ? "Ο χρήστης ενεργοποιήθηκε."
      : "Ο χρήστης απενεργοποιήθηκε."
  );

  await loadUsers();
  setUpdatingUserId(null);
}

  useEffect(() => {
  loadManufacturers();
  loadCategories();
  loadModels();
  loadUsers();
}, []);

  async function handleAddManufacturer(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanName = manufacturerName.trim();

    if (!cleanName) {
      setManufacturerError(
        "Συμπλήρωσε το όνομα του κατασκευαστή."
      );
      return;
    }

    setSavingManufacturer(true);
    setManufacturerError("");
    setManufacturerSuccess("");

    const { error } = await supabase
      .from("manufacturers")
      .insert({
        name: cleanName,
      });

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        setManufacturerError(
          "Ο συγκεκριμένος κατασκευαστής υπάρχει ήδη."
        );
      } else {
        setManufacturerError(
          "Δεν ήταν δυνατή η καταχώριση του κατασκευαστή."
        );
      }

      setSavingManufacturer(false);
      return;
    }

    setManufacturerName("");

    setManufacturerSuccess(
      "Ο κατασκευαστής καταχωρίστηκε επιτυχώς."
    );

    await loadManufacturers();

    setSavingManufacturer(false);
  }

  async function handleAddModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanModelName = modelName.trim();

    if (!selectedCategoryId) {
      setModelError("Επίλεξε κατηγορία.");
      return;
    }

    if (!selectedManufacturerId && !cleanModelName) {
      setModelError(
        "Το μοντέλο πρέπει να έχει τουλάχιστον κατασκευαστή ή όνομα μοντέλου."
      );
      return;
    }

    setSavingModel(true);
    setModelError("");
    setModelSuccess("");

    const { error } = await supabase.from("equipment_models").insert({
      category_id: selectedCategoryId,
      manufacturer_id: selectedManufacturerId || null,
      model_name: cleanModelName || null,
      model_code: modelCode.trim() || null,
      description: modelDescription.trim() || null,
      notes: modelNotes.trim() || null,
      is_active: true,
    });

    if (error) {
      console.error("Model create error:", error);
      setModelError(
        error.code === "23505"
          ? "Υπάρχει ήδη αυτό το μοντέλο για τη συγκεκριμένη κατηγορία και κατασκευαστή."
          : `Δεν ήταν δυνατή η καταχώριση του μοντέλου: ${error.message}`
      );
      setSavingModel(false);
      return;
    }

    setSelectedCategoryId("");
    setSelectedManufacturerId("");
    setModelName("");
    setModelCode("");
    setModelDescription("");
    setModelNotes("");
    setModelSuccess("Το μοντέλο καταχωρίστηκε επιτυχώς.");
    await loadModels();
    setSavingModel(false);
  }

  async function handleCreateUser(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  const fullName = newUserFullName.trim();
  const email = newUserEmail.trim().toLowerCase();

  setCreateUserError("");
  setCreateUserSuccess("");

  if (!fullName) {
    setCreateUserError(
      "Συμπλήρωσε το ονοματεπώνυμο."
    );
    return;
  }

  if (!email) {
    setCreateUserError(
      "Συμπλήρωσε το email."
    );
    return;
  }

  if (newUserPassword.length < 8) {
    setCreateUserError(
      "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες."
    );
    return;
  }

  setCreatingUser(true);

  const { data, error } =
    await supabase.functions.invoke(
      "create-user",
      {
        body: {
          full_name: fullName,
          email,
          password: newUserPassword,
          role: newUserRole,
        },
      }
    );

  if (error) {
    console.error(
      "Create user function error:",
      error
    );

    setCreateUserError(
      "Δεν ήταν δυνατή η δημιουργία του χρήστη."
    );

    setCreatingUser(false);
    return;
  }

  if (data?.error) {
    setCreateUserError(data.error);
    setCreatingUser(false);
    return;
  }

  setNewUserFullName("");
  setNewUserEmail("");
  setNewUserPassword("");
  setNewUserRole("VIEWER");

  setCreateUserSuccess(
    "Ο χρήστης δημιουργήθηκε επιτυχώς."
  );

  await loadUsers();

  setCreatingUser(false);
}

  function resetDocumentForm() {
    setDocumentTitle("");
    setDocumentType("USER_MANUAL");
    setDocumentIsPublic(false);
    setDocumentFile(null);
  }

  async function loadModelDocuments(modelId: string) {
    setLoadingModelDocuments(true);
    setDocumentError("");

    const { data, error } = await supabase
      .from("equipment_model_documents")
      .select(`
        id,
        equipment_model_id,
        document_type,
        title,
        storage_path,
        original_filename,
        mime_type,
        file_size,
        is_public,
        created_at
      `)
      .eq("equipment_model_id", modelId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Model documents load error:", error);
      setDocumentError("Δεν ήταν δυνατή η φόρτωση των εγγράφων.");
      setModelDocuments([]);
      setLoadingModelDocuments(false);
      return;
    }

    setModelDocuments((data ?? []) as EquipmentModelDocument[]);
    setLoadingModelDocuments(false);
  }

  function createDocumentStoragePath(modelId: string, fileName: string) {
    const safeName = fileName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const uniquePart =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return `${modelId}/${uniquePart}-${safeName || "document.pdf"}`;
  }

  async function handleUploadModelDocument() {
    if (!editingModel) return;

    setDocumentError("");
    setDocumentSuccess("");

    const cleanTitle = documentTitle.trim();

    if (!cleanTitle) {
      setDocumentError("Συμπλήρωσε τίτλο εγγράφου.");
      return;
    }

    if (!documentFile) {
      setDocumentError("Επίλεξε ένα αρχείο PDF.");
      return;
    }

    const isPdf =
      documentFile.type === "application/pdf" ||
      documentFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setDocumentError("Επιτρέπονται μόνο αρχεία PDF.");
      return;
    }

    if (documentFile.size <= 0 || documentFile.size > MAX_MODEL_DOCUMENT_SIZE) {
      setDocumentError("Το PDF πρέπει να είναι έως 10 MB.");
      return;
    }

    setUploadingDocument(true);

    const storagePath = createDocumentStoragePath(
      editingModel.id,
      documentFile.name
    );

    const { error: uploadError } = await supabase.storage
      .from("model-documents")
      .upload(storagePath, documentFile, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Model document upload error:", uploadError);
      setDocumentError(`Αποτυχία upload: ${uploadError.message}`);
      setUploadingDocument(false);
      return;
    }

    const { error: metadataError } = await supabase.rpc(
      "create_equipment_model_document",
      {
        p_equipment_model_id: editingModel.id,
        p_document_type: documentType,
        p_title: cleanTitle,
        p_storage_path: storagePath,
        p_original_filename: documentFile.name,
        p_mime_type: "application/pdf",
        p_file_size: documentFile.size,
        p_is_public: documentIsPublic,
      }
    );

    if (metadataError) {
      console.error("Model document metadata error:", metadataError);

      // Best-effort cleanup so a failed DB insert does not leave an orphan file.
      await supabase.storage.from("model-documents").remove([storagePath]);

      setDocumentError(
        `Το PDF ανέβηκε αλλά δεν καταχωρίστηκε: ${metadataError.message}`
      );
      setUploadingDocument(false);
      return;
    }

    resetDocumentForm();
    await loadModelDocuments(editingModel.id);
    setDocumentSuccess("Το έγγραφο προστέθηκε επιτυχώς.");
    setUploadingDocument(false);
  }

  async function handleOpenModelDocument(document: EquipmentModelDocument) {
    setDocumentError("");
    setDocumentSuccess("");

    const { data, error } = await supabase.storage
      .from("model-documents")
      .createSignedUrl(document.storage_path, 60 * 10);

    if (error || !data?.signedUrl) {
      console.error("Signed URL error:", error);
      setDocumentError("Δεν ήταν δυνατό το άνοιγμα του PDF.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDeleteModelDocument(document: EquipmentModelDocument) {
    if (!editingModel) return;

    const confirmed = window.confirm(
      `Να διαγραφεί το έγγραφο "${document.title}";`
    );

    if (!confirmed) return;

    setDeletingDocumentId(document.id);
    setDocumentError("");
    setDocumentSuccess("");

    const { data: deletedStoragePath, error: deleteMetadataError } =
      await supabase.rpc("delete_equipment_model_document", {
        p_document_id: document.id,
      });

    if (deleteMetadataError) {
      console.error("Document metadata delete error:", deleteMetadataError);
      setDocumentError(
        `Δεν ήταν δυνατή η διαγραφή: ${deleteMetadataError.message}`
      );
      setDeletingDocumentId(null);
      return;
    }

    const storagePath =
      typeof deletedStoragePath === "string" && deletedStoragePath
        ? deletedStoragePath
        : document.storage_path;

    const { error: storageDeleteError } = await supabase.storage
      .from("model-documents")
      .remove([storagePath]);

    if (storageDeleteError) {
      console.error("Document storage delete error:", storageDeleteError);
      setDocumentError(
        "Η εγγραφή διαγράφηκε, αλλά το αρχείο δεν αφαιρέθηκε από το Storage. Χρειάζεται καθαρισμός από διαχειριστή."
      );
      await loadModelDocuments(editingModel.id);
      setDeletingDocumentId(null);
      return;
    }

    await loadModelDocuments(editingModel.id);
    setDocumentSuccess("Το έγγραφο διαγράφηκε.");
    setDeletingDocumentId(null);
  }

  function formatDocumentSize(bytes: number) {
    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function openModelEdit(model: EquipmentModel) {
    setEditingModel(model);
    setEditManufacturerId(model.manufacturer_id ?? "");
    setEditModelName(model.model_name ?? "");
    setEditModelCode(model.model_code ?? "");
    setEditModelDescription(model.description ?? "");
    setEditModelNotes(model.notes ?? "");
    setEditModelActive(model.is_active);
    setModelError("");
    setModelSuccess("");
    setDocumentError("");
    setDocumentSuccess("");
    setModelDocuments([]);
    resetDocumentForm();
    void loadModelDocuments(model.id);
  }

  function closeModelEdit() {
    if (
      !savingModelEdit &&
      !uploadingDocument &&
      deletingDocumentId === null
    ) {
      setEditingModel(null);
      setModelDocuments([]);
      resetDocumentForm();
      setDocumentError("");
      setDocumentSuccess("");
    }
  }

  async function handleSaveModelEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingModel) return;

    const cleanModelName = editModelName.trim();
    if (!editManufacturerId && !cleanModelName) {
      setModelError(
        "Το μοντέλο πρέπει να έχει τουλάχιστον κατασκευαστή ή όνομα μοντέλου."
      );
      return;
    }

    setSavingModelEdit(true);
    setModelError("");
    setModelSuccess("");

    const { error } = await supabase.rpc("update_equipment_model", {
      p_model_id: editingModel.id,
      p_manufacturer_id: editManufacturerId || null,
      p_model_name: cleanModelName,
      p_model_code: editModelCode.trim(),
      p_description: editModelDescription.trim(),
      p_notes: editModelNotes.trim(),
      p_is_active: editModelActive,
    });

    if (error) {
      console.error("Model update error:", error);
      setModelError(
        error.code === "23505"
          ? "Υπάρχει ήδη αυτό το μοντέλο για τη συγκεκριμένη κατηγορία και κατασκευαστή."
          : `Δεν ήταν δυνατή η ενημέρωση του μοντέλου: ${error.message}`
      );
      setSavingModelEdit(false);
      return;
    }

    await loadModels();
    setEditingModel(null);
    setModelSuccess("Το μοντέλο ενημερώθηκε επιτυχώς.");
    setSavingModelEdit(false);
  }

  const filteredModels = models.filter((model) => {
    const search = modelSearch.trim().toLocaleLowerCase("el");
    if (!search) return true;

    return [
      model.categories?.prefix,
      model.categories?.name,
      model.manufacturers?.name,
      model.model_name,
      model.model_code,
      model.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("el")
      .includes(search);
  });

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Διαχείριση</h1>

        <p>
          Βασικά δεδομένα και ρυθμίσεις του συστήματος
          εξοπλισμού.
        </p>
      </div>

      <div className="admin-tabs">
        <button
          type="button"
          className={
            activeSection === "manufacturers"
              ? "admin-tab active"
              : "admin-tab"
          }
          onClick={() =>
            setActiveSection("manufacturers")
          }
        >
          Κατασκευαστές
        </button>

        <button
          type="button"
          className={
            activeSection === "models"
              ? "admin-tab active"
              : "admin-tab"
          }
          onClick={() => setActiveSection("models")}
        >
          Μοντέλα
        </button>

        <button
          type="button"
          className={
            activeSection === "categories"
              ? "admin-tab active"
              : "admin-tab"
          }
          onClick={() =>
            setActiveSection("categories")
          }
        >
          Κατηγορίες
        </button>

        <button
          type="button"
          className={
            activeSection === "users"
              ? "admin-tab active"
              : "admin-tab"
          }
          onClick={() => setActiveSection("users")}
        >
          Χρήστες
        </button>
      </div>

      {activeSection === "manufacturers" && (
        <section>
          <div className="admin-section-header">
            <div>
              <h2>Κατασκευαστές</h2>

              <p>
                Κατασκευαστές εξοπλισμού που μπορούν να
                χρησιμοποιηθούν στα μοντέλα.
              </p>
            </div>
          </div>

          <div className="admin-grid">
            <div className="admin-card">
              <h3>Νέος κατασκευαστής</h3>

              <form
                onSubmit={handleAddManufacturer}
                className="admin-form"
              >
                <label htmlFor="manufacturer-name">
                  Όνομα
                </label>

                <input
                  id="manufacturer-name"
                  type="text"
                  value={manufacturerName}
                  onChange={(event) =>
                    setManufacturerName(
                      event.target.value
                    )
                  }
                  placeholder="π.χ. Motorola"
                  disabled={savingManufacturer}
                />

                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingManufacturer}
                >
                  {savingManufacturer
                    ? "Αποθήκευση..."
                    : "Προσθήκη κατασκευαστή"}
                </button>
              </form>

              {manufacturerError && (
                <p className="admin-message error">
                  {manufacturerError}
                </p>
              )}

              {manufacturerSuccess && (
                <p className="admin-message success">
                  {manufacturerSuccess}
                </p>
              )}
            </div>

            <div className="admin-card">
              <div className="admin-list-header">
                <h3>
                  Καταχωρισμένοι κατασκευαστές
                </h3>

                <span>{manufacturers.length}</span>
              </div>

              {loadingManufacturers ? (
                <p>Φόρτωση...</p>
              ) : manufacturers.length === 0 ? (
                <p className="admin-empty">
                  Δεν υπάρχουν ακόμη κατασκευαστές.
                </p>
              ) : (
                <div className="manufacturer-list">
                  {manufacturers.map(
                    (manufacturer) => (
                      <div
                        key={manufacturer.id}
                        className="manufacturer-row"
                      >
                        <strong>
                          {manufacturer.name}
                        </strong>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeSection === "models" && (
        <section>
          <div className="admin-section-header">
            <div>
              <h2>Μοντέλα εξοπλισμού</h2>
              <p>Κεντρικός κατάλογος μοντέλων ανά κατηγορία και κατασκευαστή.</p>
            </div>
          </div>

          <div className="admin-grid">
            <div className="admin-card">
              <h3>Νέο μοντέλο</h3>
              <form onSubmit={handleAddModel} className="admin-form">
                <label htmlFor="model-category">Κατηγορία *</label>
                <select id="model-category" value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  disabled={savingModel}>
                  <option value="">— Επιλογή κατηγορίας —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.prefix} — {c.name}</option>
                  ))}
                </select>

                <label htmlFor="model-manufacturer">Κατασκευαστής</label>
                <select id="model-manufacturer" value={selectedManufacturerId}
                  onChange={(e) => setSelectedManufacturerId(e.target.value)}
                  disabled={savingModel}>
                  <option value="">— Χωρίς / άγνωστος —</option>
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>

                <label htmlFor="model-name">Μοντέλο</label>
                <input id="model-name" value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="π.χ. DP4801e" disabled={savingModel} />

                <label htmlFor="model-code">Model / Product Code</label>
                <input id="model-code" value={modelCode}
                  onChange={(e) => setModelCode(e.target.value)}
                  placeholder="Προαιρετικό" disabled={savingModel} />

                <label htmlFor="model-description">Περιγραφή</label>
                <textarea id="model-description" rows={3} value={modelDescription}
                  onChange={(e) => setModelDescription(e.target.value)}
                  placeholder="Σύντομη περιγραφή" disabled={savingModel} />

                <label htmlFor="model-notes">Σημειώσεις</label>
                <textarea id="model-notes" rows={3} value={modelNotes}
                  onChange={(e) => setModelNotes(e.target.value)}
                  placeholder="Προαιρετικές εσωτερικές σημειώσεις"
                  disabled={savingModel} />

                <button type="submit" className="primary-button" disabled={savingModel}>
                  {savingModel ? "Αποθήκευση..." : "Προσθήκη μοντέλου"}
                </button>
              </form>
            </div>

            <div className="admin-card admin-model-list-card">
              <div className="admin-list-header">
                <h3>Καταχωρισμένα μοντέλα</h3>
                <span>{models.length}</span>
              </div>

              <div className="admin-model-toolbar">
                <input type="search" value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Αναζήτηση μοντέλου..." />
              </div>

              {modelError && <p className="admin-message error">{modelError}</p>}
              {modelSuccess && <p className="admin-message success">{modelSuccess}</p>}

              {loadingModels ? (
                <p>Φόρτωση...</p>
              ) : filteredModels.length === 0 ? (
                <p className="admin-empty">Δεν βρέθηκαν μοντέλα.</p>
              ) : (
                <div className="model-table-wrapper">
                  <table className="model-table">
                    <thead><tr>
                      <th>Κατηγορία</th><th>Κατασκευαστής</th><th>Μοντέλο</th>
                      <th>Product Code</th><th>Κατάσταση</th><th></th>
                    </tr></thead>
                    <tbody>
                      {filteredModels.map((model) => (
                        <tr key={model.id}>
                          <td>{model.categories
                            ? `${model.categories.prefix} — ${model.categories.name}` : "—"}</td>
                          <td>{model.manufacturers?.name ?? "—"}</td>
                          <td>
                            <div className="admin-model-name">
                              <strong>{model.model_name ?? "—"}</strong>
                              {model.description && <small>{model.description}</small>}
                            </div>
                          </td>
                          <td>{model.model_code || "—"}</td>
                          <td><span className={model.is_active
                            ? "admin-user-status active" : "admin-user-status inactive"}>
                            {model.is_active ? "Ενεργό" : "Ανενεργό"}
                          </span></td>
                          <td><button type="button" className="admin-user-action"
                            onClick={() => openModelEdit(model)}>Επεξεργασία</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {editingModel && (
            <div className="admin-modal-backdrop"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeModelEdit();
              }}>
              <div className="admin-modal">
                <div className="admin-modal-header">
                  <div>
                    <h2>Επεξεργασία μοντέλου</h2>
                    <p>{editingModel.categories?.prefix} — {editingModel.categories?.name}</p>
                  </div>
                  <button type="button" className="admin-modal-close"
                    onClick={closeModelEdit}
                    disabled={savingModelEdit || uploadingDocument || deletingDocumentId !== null}
                    aria-label="Κλείσιμο">×</button>
                </div>

                <form className="admin-form" onSubmit={handleSaveModelEdit}>
                  <label>Κατηγορία</label>
                  <input value={editingModel.categories
                    ? `${editingModel.categories.prefix} — ${editingModel.categories.name}` : "—"}
                    disabled />
                  <p className="admin-field-help">
                    Η κατηγορία δεν αλλάζει μετά τη δημιουργία του μοντέλου.
                  </p>

                  <label htmlFor="edit-model-manufacturer">Κατασκευαστής</label>
                  <select id="edit-model-manufacturer" value={editManufacturerId}
                    onChange={(e) => setEditManufacturerId(e.target.value)}
                    disabled={savingModelEdit}>
                    <option value="">— Χωρίς / άγνωστος —</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>

                  <label htmlFor="edit-model-name">Μοντέλο</label>
                  <input id="edit-model-name" value={editModelName}
                    onChange={(e) => setEditModelName(e.target.value)}
                    disabled={savingModelEdit} />

                  <label htmlFor="edit-model-code">Model / Product Code</label>
                  <input id="edit-model-code" value={editModelCode}
                    onChange={(e) => setEditModelCode(e.target.value)}
                    disabled={savingModelEdit} />

                  <label htmlFor="edit-model-description">Περιγραφή</label>
                  <textarea id="edit-model-description" rows={3}
                    value={editModelDescription}
                    onChange={(e) => setEditModelDescription(e.target.value)}
                    disabled={savingModelEdit} />

                  <label htmlFor="edit-model-notes">Σημειώσεις</label>
                  <textarea id="edit-model-notes" rows={3} value={editModelNotes}
                    onChange={(e) => setEditModelNotes(e.target.value)}
                    disabled={savingModelEdit} />

                  <label className="admin-checkbox-row">
                    <input type="checkbox" checked={editModelActive}
                      onChange={(e) => setEditModelActive(e.target.checked)}
                      disabled={savingModelEdit} />
                    <span>Ενεργό μοντέλο</span>
                  </label>

                  {modelError && <p className="admin-message error">{modelError}</p>}

                  <div className="admin-modal-actions">
                    <button type="button" className="admin-user-action"
                      onClick={closeModelEdit} disabled={savingModelEdit}>Ακύρωση</button>
                    <button type="submit" className="primary-button"
                      disabled={savingModelEdit}>
                      {savingModelEdit ? "Αποθήκευση..." : "Αποθήκευση αλλαγών"}
                    </button>
                  </div>
                </form>

                <div className="admin-model-documents">
                  <div className="admin-model-documents-header">
                    <div>
                      <h3>Έγγραφα / Εγχειρίδια</h3>
                      <p>
                        PDF που συνδέονται με αυτό το μοντέλο. Τα Public
                        έγγραφα θα μπορούν να εμφανίζονται αργότερα στη
                        δημόσια σελίδα QR.
                      </p>
                    </div>
                    <span>{modelDocuments.length}</span>
                  </div>

                  <div className="admin-document-upload">
                    <div className="admin-form">
                      <label htmlFor="model-document-title">Τίτλος *</label>
                      <input
                        id="model-document-title"
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        placeholder="π.χ. Εγχειρίδιο χρήσης DP4801e"
                        disabled={uploadingDocument}
                      />

                      <label htmlFor="model-document-type">Τύπος *</label>
                      <select
                        id="model-document-type"
                        value={documentType}
                        onChange={(e) =>
                          setDocumentType(e.target.value as ModelDocumentType)
                        }
                        disabled={uploadingDocument}
                      >
                        {(
                          Object.entries(MODEL_DOCUMENT_TYPE_LABELS) as [
                            ModelDocumentType,
                            string
                          ][]
                        ).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>

                      <label htmlFor="model-document-file">PDF *</label>
                      <input
                        id="model-document-file"
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(e) =>
                          setDocumentFile(e.target.files?.[0] ?? null)
                        }
                        disabled={uploadingDocument}
                      />
                      <p className="admin-field-help">
                        Μόνο PDF, έως 10 MB.
                      </p>

                      <label className="admin-checkbox-row">
                        <input
                          type="checkbox"
                          checked={documentIsPublic}
                          onChange={(e) => setDocumentIsPublic(e.target.checked)}
                          disabled={uploadingDocument}
                        />
                        <span>Δημόσιο μέσω QR</span>
                      </label>

                      <button
                        type="button"
                        className="primary-button"
                        onClick={handleUploadModelDocument}
                        disabled={uploadingDocument || !documentFile}
                      >
                        {uploadingDocument
                          ? "Μεταφόρτωση..."
                          : "Προσθήκη εγγράφου"}
                      </button>
                    </div>
                  </div>

                  {documentError && (
                    <p className="admin-message error">{documentError}</p>
                  )}

                  {documentSuccess && (
                    <p className="admin-message success">{documentSuccess}</p>
                  )}

                  <div className="admin-document-list">
                    {loadingModelDocuments ? (
                      <p>Φόρτωση εγγράφων...</p>
                    ) : modelDocuments.length === 0 ? (
                      <p className="admin-empty">
                        Δεν υπάρχουν ακόμη έγγραφα για αυτό το μοντέλο.
                      </p>
                    ) : (
                      modelDocuments.map((document) => (
                        <div className="admin-document-row" key={document.id}>
                          <div className="admin-document-info">
                            <strong>{document.title}</strong>
                            <span>
                              {MODEL_DOCUMENT_TYPE_LABELS[document.document_type]}
                              {" · "}
                              {formatDocumentSize(document.file_size)}
                              {" · "}
                              {document.is_public ? "Public" : "Private"}
                            </span>
                            <small>{document.original_filename}</small>
                          </div>

                          <div className="admin-document-actions">
                            <button
                              type="button"
                              className="admin-user-action"
                              onClick={() => handleOpenModelDocument(document)}
                              disabled={deletingDocumentId === document.id}
                            >
                              Άνοιγμα
                            </button>

                            <button
                              type="button"
                              className="admin-user-action danger"
                              onClick={() => handleDeleteModelDocument(document)}
                              disabled={
                                deletingDocumentId !== null || uploadingDocument
                              }
                            >
                              {deletingDocumentId === document.id
                                ? "Διαγραφή..."
                                : "Διαγραφή"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeSection === "categories" && (
        <section className="admin-card">
          <h2>Κατηγορίες</h2>

          <p>
            Οι κατηγορίες και τα prefixes αποτελούν
            ελεγχόμενο μητρώο του συστήματος.
          </p>

          <div className="model-table-wrapper">
            <table className="model-table">
              <thead>
                <tr>
                  <th>Prefix</th>
                  <th>Κατηγορία</th>
                  <th>Ομάδα</th>
                  <th>Τύπος καταγραφής</th>
                </tr>
              </thead>

              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <strong>{category.prefix}</strong>
                    </td>

                    <td>{category.name}</td>

                    <td>{category.category_group}</td>

                    <td>{category.tracking_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === "users" && (
  <section>
    <div className="admin-section-header">
      <div>
        <h2>Χρήστες</h2>

        <p>
          Διαχείριση πρόσβασης, ρόλων και
          κατάστασης χρηστών.
        </p>
      </div>
    </div>

    {/* ΝΕΑ ΦΟΡΜΑ ΔΗΜΙΟΥΡΓΙΑΣ ΧΡΗΣΤΗ */}
    <div className="admin-users-grid">
      <div className="admin-card">
        <h3>Νέος χρήστης</h3>

        <form
          className="admin-form"
          onSubmit={handleCreateUser}
        >
          <label htmlFor="new-user-name">
            Ονοματεπώνυμο *
          </label>

          <input
            id="new-user-name"
            type="text"
            value={newUserFullName}
            onChange={(event) =>
              setNewUserFullName(event.target.value)
            }
            placeholder="π.χ. Γιώργος Παπαδόπουλος"
            disabled={creatingUser}
          />

          <label htmlFor="new-user-email">
            Email *
          </label>

          <input
            id="new-user-email"
            type="email"
            value={newUserEmail}
            onChange={(event) =>
              setNewUserEmail(event.target.value)
            }
            placeholder="user@example.gr"
            autoComplete="off"
            disabled={creatingUser}
          />

          <label htmlFor="new-user-password">
            Προσωρινός κωδικός *
          </label>

          <input
            id="new-user-password"
            type="password"
            value={newUserPassword}
            onChange={(event) =>
              setNewUserPassword(event.target.value)
            }
            placeholder="Τουλάχιστον 8 χαρακτήρες"
            autoComplete="new-password"
            disabled={creatingUser}
          />

          <label htmlFor="new-user-role">
            Αρχικός ρόλος *
          </label>

          <select
            id="new-user-role"
            value={newUserRole}
            onChange={(event) =>
              setNewUserRole(
                event.target.value as UserRole
              )
            }
            disabled={creatingUser}
          >
            <option value="VIEWER">
              VIEWER — Μόνο προβολή
            </option>

            <option value="OPERATOR">
              OPERATOR — Διαχείριση εξοπλισμού
            </option>

            <option value="ADMIN">
              ADMIN — Πλήρης διαχείριση
            </option>
          </select>

          <button
            type="submit"
            className="primary-button"
            disabled={creatingUser}
          >
            {creatingUser
              ? "Δημιουργία..."
              : "Δημιουργία χρήστη"}
          </button>
        </form>

        {createUserError && (
          <p className="admin-message error">
            {createUserError}
          </p>
        )}

        {createUserSuccess && (
          <p className="admin-message success">
            {createUserSuccess}
          </p>
        )}
      </div>
    </div>


    <div className="admin-card">
      <div className="admin-list-header">
        <h3>Χρήστες συστήματος</h3>

        <span>{users.length}</span>
      </div>

      {userError && (
        <p className="admin-message error">
          {userError}
        </p>
      )}

      {userSuccess && (
        <p className="admin-message success">
          {userSuccess}
        </p>
      )}

      {loadingUsers ? (
        <p>Φόρτωση χρηστών...</p>
      ) : users.length === 0 ? (
        <p className="admin-empty">
          Δεν υπάρχουν χρήστες.
        </p>
      ) : (
        <div className="model-table-wrapper">
          <table className="model-table users-table">
            <thead>
              <tr>
                <th>Χρήστης</th>
                <th>Ρόλος</th>
                <th>Κατάσταση</th>
                <th>Ενέργειες</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => {
                const isCurrentUser =
                  user.id === currentUserId;

                const updating =
                  updatingUserId === user.id;

                return (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-name">
                        <strong>
                          {user.full_name ||
                            "Χωρίς ονοματεπώνυμο"}
                        </strong>

                        {isCurrentUser && (
                          <span className="admin-current-user">
                            Εσύ
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <select
                        className="admin-role-select"
                        value={user.role}
                        disabled={updating}
                        onChange={(event) =>
                          handleRoleChange(
                            user.id,
                            event.target
                              .value as UserRole
                          )
                        }
                      >
                        <option value="VIEWER">
                          VIEWER
                        </option>

                        <option value="OPERATOR">
                          OPERATOR
                        </option>

                        <option value="ADMIN">
                          ADMIN
                        </option>
                      </select>
                    </td>

                    <td>
                      <span
                        className={
                          user.is_active
                            ? "admin-user-status active"
                            : "admin-user-status inactive"
                        }
                      >
                        {user.is_active
                          ? "Ενεργός"
                          : "Ανενεργός"}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={
                          user.is_active
                            ? "admin-user-action danger"
                            : "admin-user-action"
                        }
                        disabled={
                          updating ||
                          (isCurrentUser &&
                            user.is_active)
                        }
                        onClick={() =>
                          handleActiveChange(
                            user.id,
                            !user.is_active
                          )
                        }
                      >
                        {updating
                          ? "Αποθήκευση..."
                          : user.is_active
                            ? "Απενεργοποίηση"
                            : "Ενεργοποίηση"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </section>
)}
    </div>
  );
}