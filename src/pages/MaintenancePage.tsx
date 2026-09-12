import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { supabase } from "../lib/supabase";

import "./MaintenancePage.css";

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

type ServiceStatus =
  | "OPEN"
  | "SENT"
  | "IN_SERVICE"
  | "RETURNED"
  | "CANCELLED";

interface MaintenanceEvent {
  id: string;
  asset_id: string;
  event_type: MaintenanceEventType;
  event_date: string;
  description: string;
  previous_status: TechnicalStatus;
  new_status: TechnicalStatus;
  notes: string | null;
  assets: AssetSummary | null;
}

interface AssetSummary {
  id?: string;
  asset_code: string;
  serial_number: string | null;
  technical_status: TechnicalStatus;
  lifecycle_status?: string;
  categories: { name: string } | null;
  equipment_models: {
    model_name: string | null;
    manufacturers: { name: string } | null;
  } | null;
}

interface AssetRow extends AssetSummary {
  id: string;
  lifecycle_status: string;
}

type ServiceDocumentType =
  | "HANDOVER_FORM"
  | "RETURN_FORM"
  | "SERVICE_REPORT"
  | "REPAIR_REPORT"
  | "QUOTE"
  | "INVOICE"
  | "OTHER";

interface ServiceDocument {
  id: string;
  service_case_id: string;
  document_type: ServiceDocumentType;
  title: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  document_source: "GENERATED" | "EXTERNAL";
  created_at: string;
}

interface ServiceCase {
  id: string;
  service_code: string;
  asset_id: string;
  status: ServiceStatus;
  issue_description: string;
  previous_technical_status: TechnicalStatus | null;
  sent_at: string | null;
  service_company: string | null;
  handed_over_by_name: string | null;
  handed_over_by_role: string | null;
  received_by_name: string | null;
  received_by_role: string | null;
  returned_at: string | null;
  work_performed: string | null;
  cost: number | null;
  final_technical_status: TechnicalStatus | null;
  return_notes: string | null;
  created_at: string;
  assets: AssetSummary | null;
}

function eventTypeLabel(type: MaintenanceEventType) {
  const labels: Record<MaintenanceEventType, string> = {
    INSPECTION: "Έλεγχος",
    ISSUE: "Βλάβη / Πρόβλημα",
    REPAIR: "Επισκευή",
    MAINTENANCE: "Συντήρηση",
    OTHER: "Άλλο",
  };
  return labels[type];
}

function technicalStatusLabel(status: TechnicalStatus) {
  const labels: Record<TechnicalStatus, string> = {
    FUNCTIONAL: "Λειτουργικό",
    HAS_ISSUE: "Με θέμα",
    UNDER_REPAIR: "Σε επισκευή",
    OUT_OF_SERVICE: "Εκτός χρήσης",
  };
  return labels[status];
}

function serviceStatusLabel(status: ServiceStatus) {
  const labels: Record<ServiceStatus, string> = {
    OPEN: "Ανοιχτό",
    SENT: "Απεστάλη",
    IN_SERVICE: "Σε service",
    RETURNED: "Επεστράφη",
    CANCELLED: "Ακυρώθηκε",
  };
  return labels[status];
}

function serviceDocumentTypeLabel(type: ServiceDocumentType) {
  const labels: Record<ServiceDocumentType, string> = {
    HANDOVER_FORM: "Δελτίο Παράδοσης",
    RETURN_FORM: "Δελτίο Παραλαβής",
    SERVICE_REPORT: "Δελτίο Service",
    REPAIR_REPORT: "Αναφορά επισκευής",
    QUOTE: "Προσφορά",
    INVOICE: "Τιμολόγιο",
    OTHER: "Άλλο",
  };

  return labels[type];
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR");
}

function toLocalDateTimeInput(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16);
}

function equipmentName(asset: AssetSummary | null) {
  return [
    asset?.equipment_models?.manufacturers?.name,
    asset?.equipment_models?.model_name,
  ]
    .filter(Boolean)
    .join(" ") || asset?.categories?.name || "—";
}

interface MaintenancePageProps {
  canOperate: boolean;
}

export default function MaintenancePage({
  canOperate,
}: MaintenancePageProps) {
  const [activeTab, setActiveTab] =
    useState<"service" | "history">("service");

  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [serviceCases, setServiceCases] = useState<ServiceCase[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [returnCase, setReturnCase] = useState<ServiceCase | null>(null);
  const [cancelCase, setCancelCase] = useState<ServiceCase | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const [createAssetId, setCreateAssetId] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [serviceCompany, setServiceCompany] = useState("");
  const [handedByName, setHandedByName] = useState("");
  const [handedByRole, setHandedByRole] = useState("");
  const [receivedByName, setReceivedByName] = useState("");
  const [receivedByRole, setReceivedByRole] = useState("");
  const [sentAt, setSentAt] = useState(toLocalDateTimeInput());

  const [returnedAt, setReturnedAt] = useState(toLocalDateTimeInput());
  const [workPerformed, setWorkPerformed] = useState("");
  const [returnCost, setReturnCost] = useState("");
  const [finalStatus, setFinalStatus] =
    useState<TechnicalStatus>("FUNCTIONAL");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnedByName, setReturnedByName] = useState("");
  const [returnedByRole, setReturnedByRole] = useState("");
  const [acceptedByName, setAcceptedByName] = useState("");
  const [acceptedByRole, setAcceptedByRole] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [detailsCase, setDetailsCase] = useState<ServiceCase | null>(null);
  const [serviceDocuments, setServiceDocuments] = useState<ServiceDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [handoverGenerating, setHandoverGenerating] = useState(false);
  const [returnFormGenerating, setReturnFormGenerating] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] =
    useState<ServiceDocumentType>("SERVICE_REPORT");
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const generatedHandover = useMemo(
    () =>
      serviceDocuments.find(
        (document) =>
          document.document_type === "HANDOVER_FORM" &&
          document.document_source === "GENERATED"
      ) ?? null,
    [serviceDocuments]
  );

  const generatedReturnForm = useMemo(
  () =>
    serviceDocuments.find(
      (document) =>
        document.document_type === "RETURN_FORM" &&
        document.document_source === "GENERATED"
    ) ?? null,
  [serviceDocuments]
);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const [eventResult, assetResult, serviceResult] = await Promise.all([
      supabase
        .from("maintenance_events")
        .select(`
          id, asset_id, event_type, event_date, description,
          previous_status, new_status, notes,
          assets (
            asset_code, serial_number, technical_status,
            categories ( name ),
            equipment_models (
              model_name,
              manufacturers ( name )
            )
          )
        `)
        .order("event_date", { ascending: false }),

      supabase
        .from("assets")
        .select(`
          id, asset_code, serial_number, technical_status, lifecycle_status,
          categories ( name ),
          equipment_models (
            model_name,
            manufacturers ( name )
          )
        `)
        .eq("lifecycle_status", "ACTIVE")
        .order("asset_code", { ascending: true }),

      supabase
        .from("service_cases")
        .select(`
          id, service_code, asset_id, status, issue_description,
          previous_technical_status, sent_at, service_company,
          handed_over_by_name, handed_over_by_role,
          received_by_name, received_by_role,
          returned_at, work_performed, cost,
          final_technical_status, return_notes, created_at,
          assets (
            asset_code, serial_number, technical_status,
            categories ( name ),
            equipment_models (
              model_name,
              manufacturers ( name )
            )
          )
        `)
        .order("created_at", { ascending: false }),
    ]);

    if (eventResult.error || assetResult.error || serviceResult.error) {
      console.error("Maintenance load error:", {
        event: eventResult.error,
        asset: assetResult.error,
        service: serviceResult.error,
      });
      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση όλων των δεδομένων συντήρησης / service."
      );
      setLoading(false);
      return;
    }

    setEvents((eventResult.data ?? []) as unknown as MaintenanceEvent[]);
    setAssets((assetResult.data ?? []) as unknown as AssetRow[]);
    setServiceCases(
      (serviceResult.data ?? []) as unknown as ServiceCase[]
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(
    () => ({
      activeService: serviceCases.filter((item) =>
        ["OPEN", "SENT", "IN_SERVICE"].includes(item.status)
      ).length,
      returnedService: serviceCases.filter(
        (item) => item.status === "RETURNED"
      ).length,
      hasIssue: assets.filter(
        (asset) => asset.technical_status === "HAS_ISSUE"
      ).length,
      underRepair: assets.filter(
        (asset) => asset.technical_status === "UNDER_REPAIR"
      ).length,
    }),
    [serviceCases, assets]
  );

  const availableAssets = useMemo(() => {
    const activeServiceAssetIds = new Set(
      serviceCases
        .filter((item) =>
          ["OPEN", "SENT", "IN_SERVICE"].includes(item.status)
        )
        .map((item) => item.asset_id)
    );

    return assets.filter(
      (asset) => !activeServiceAssetIds.has(asset.id)
    );
  }, [assets, serviceCases]);

  const filteredServiceCases = useMemo(() => {
    const query = serviceSearch.trim().toLocaleLowerCase("el-GR");

    return serviceCases.filter((item) => {
      if (
        serviceStatusFilter &&
        item.status !== serviceStatusFilter
      ) {
        return false;
      }

      if (!query) return true;

      const text = [
        item.service_code,
        item.assets?.asset_code,
        item.assets?.serial_number,
        item.assets?.categories?.name,
        item.assets?.equipment_models?.manufacturers?.name,
        item.assets?.equipment_models?.model_name,
        item.service_company,
        item.issue_description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("el-GR");

      return text.includes(query);
    });
  }, [serviceCases, serviceSearch, serviceStatusFilter]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("el-GR");

    return events.filter((event) => {
      if (eventTypeFilter && event.event_type !== eventTypeFilter) {
        return false;
      }
      if (statusFilter && event.new_status !== statusFilter) {
        return false;
      }
      if (!query) return true;

      const asset = event.assets;
      const text = [
        asset?.asset_code,
        asset?.serial_number,
        asset?.categories?.name,
        asset?.equipment_models?.manufacturers?.name,
        asset?.equipment_models?.model_name,
        event.description,
        event.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("el-GR");

      return text.includes(query);
    });
  }, [events, search, eventTypeFilter, statusFilter]);

  function resetCreateForm() {
    setCreateAssetId("");
    setIssueDescription("");
    setServiceCompany("");
    setHandedByName("");
    setHandedByRole("");
    setReceivedByName("");
    setReceivedByRole("");
    setSentAt(toLocalDateTimeInput());
    setActionError("");
  }

  async function handleCreateService(event: FormEvent) {
    event.preventDefault();
    setActionError("");

    if (!createAssetId || !issueDescription.trim()) {
      setActionError("Επίλεξε εξοπλισμό και συμπλήρωσε την αιτία.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.rpc("create_service_case", {
      p_asset_id: createAssetId,
      p_issue_description: issueDescription.trim(),
      p_service_company: serviceCompany.trim() || null,
      p_handed_over_by_name: handedByName.trim() || null,
      p_handed_over_by_role: handedByRole.trim() || null,
      p_received_by_name: receivedByName.trim() || null,
      p_received_by_role: receivedByRole.trim() || null,
      p_sent_at: new Date(sentAt).toISOString(),
    });

    if (error) {
      console.error("Create service case error:", error);
      setActionError(error.message || "Η δημιουργία του service απέτυχε.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setCreateOpen(false);
    resetCreateForm();
    await loadData();
  }

  function openReturn(item: ServiceCase) {
    setReturnCase(item);
    setReturnedAt(toLocalDateTimeInput());
    setWorkPerformed("");
    setReturnCost("");
    setFinalStatus("FUNCTIONAL");
    setReturnNotes("");

    setReturnedByName("");
    setReturnedByRole("");
    setAcceptedByName("");
    setAcceptedByRole("");

    setActionError("");
  }

  async function handleReturnService(event: FormEvent) {
    event.preventDefault();
    if (!returnCase) return;

    setActionError("");

    if (!workPerformed.trim()) {
      setActionError("Συμπλήρωσε τις εργασίες που πραγματοποιήθηκαν.");
      return;
    }

    const parsedCost =
      returnCost.trim() === "" ? null : Number(returnCost);

    if (
      parsedCost !== null &&
      (!Number.isFinite(parsedCost) || parsedCost < 0)
    ) {
      setActionError("Το κόστος δεν είναι έγκυρο.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.rpc("return_service_case", {
      p_service_case_id: returnCase.id,
      p_returned_at: new Date(returnedAt).toISOString(),
      p_work_performed: workPerformed.trim(),
      p_cost: parsedCost,
      p_final_technical_status: finalStatus,
      p_return_notes: returnNotes.trim() || null,

      p_returned_by_name: returnedByName.trim() || null,
      p_returned_by_role: returnedByRole.trim() || null,
      p_accepted_by_name: acceptedByName.trim() || null,
      p_accepted_by_role: acceptedByRole.trim() || null,
    });

    if (error) {
      console.error("Return service case error:", error);
      setActionError(error.message || "Η επιστροφή από service απέτυχε.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setReturnCase(null);
    await loadData();
  }

  function openCancel(item: ServiceCase) {
    setCancelCase(item);
    setCancelReason("");
    setActionError("");
  }

  async function handleCancelService(event: FormEvent) {
    event.preventDefault();
    if (!cancelCase) return;

    if (!cancelReason.trim()) {
      setActionError("Η αιτία ακύρωσης είναι υποχρεωτική.");
      return;
    }

    setSubmitting(true);
    setActionError("");

    const { error } = await supabase.rpc("cancel_service_case", {
      p_service_case_id: cancelCase.id,
      p_reason: cancelReason.trim(),
    });

    if (error) {
      console.error("Cancel service case error:", error);
      setActionError(error.message || "Η ακύρωση απέτυχε.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setCancelCase(null);
    await loadData();
  }

  async function loadServiceDocuments(serviceCaseId: string) {
    setDocumentsLoading(true);
    setDocumentError("");

    const { data, error } = await supabase
      .from("service_case_documents")
      .select(`
        id, service_case_id, document_type, title, storage_path,
        original_filename, mime_type, file_size, document_source, created_at
      `)
      .eq("service_case_id", serviceCaseId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Service documents load error:", error);
      setDocumentError("Δεν ήταν δυνατή η φόρτωση των εγγράφων.");
      setDocumentsLoading(false);
      return;
    }

    setServiceDocuments((data ?? []) as ServiceDocument[]);
    setDocumentsLoading(false);
  }

  async function openServiceDetails(item: ServiceCase) {
    setDetailsCase(item);
    setDocumentTitle("");
    setDocumentType("SERVICE_REPORT");
    setDocumentFile(null);
    setDocumentError("");
    await loadServiceDocuments(item.id);
  }

  async function handleUploadServiceDocument(event: FormEvent) {
    event.preventDefault();
    if (!detailsCase) return;

    setDocumentError("");

    if (!documentTitle.trim()) {
      setDocumentError("Ο τίτλος του εγγράφου είναι υποχρεωτικός.");
      return;
    }

    if (!documentFile) {
      setDocumentError("Επίλεξε αρχείο PDF.");
      return;
    }

    if (documentFile.type !== "application/pdf") {
      setDocumentError("Επιτρέπονται μόνο αρχεία PDF.");
      return;
    }

    if (documentFile.size <= 0 || documentFile.size > 10 * 1024 * 1024) {
      setDocumentError("Το PDF πρέπει να είναι έως 10 MB.");
      return;
    }

    setDocumentBusy(true);

    const safeName = documentFile.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-");
    const storagePath = `${detailsCase.id}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("service-documents")
      .upload(storagePath, documentFile, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Service document upload error:", uploadError);
      setDocumentError(uploadError.message || "Το ανέβασμα του PDF απέτυχε.");
      setDocumentBusy(false);
      return;
    }

    const { error: metadataError } = await supabase.rpc(
      "create_service_case_document",
      {
        p_service_case_id: detailsCase.id,
        p_document_type: documentType,
        p_title: documentTitle.trim(),
        p_storage_path: storagePath,
        p_original_filename: documentFile.name,
        p_mime_type: "application/pdf",
        p_file_size: documentFile.size,
        p_document_source: "EXTERNAL",
      }
    );

    if (metadataError) {
      console.error("Service document metadata error:", metadataError);
      await supabase.storage.from("service-documents").remove([storagePath]);
      setDocumentError(
        metadataError.message || "Η καταχώριση του εγγράφου απέτυχε."
      );
      setDocumentBusy(false);
      return;
    }

    setDocumentTitle("");
    setDocumentType("SERVICE_REPORT");
    setDocumentFile(null);
    setDocumentBusy(false);
    await loadServiceDocuments(detailsCase.id);
  }

async function handleGenerateHandover() {
  if (!detailsCase || handoverGenerating || generatedHandover) return;

  setDocumentError("");
  setHandoverGenerating(true);

  try {
    const pdfServiceUrl = import.meta.env.VITE_PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      throw new Error(
        "Δεν έχει οριστεί το VITE_PDF_SERVICE_URL."
      );
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Get session error:", sessionError);

      setDocumentError(
        "Δεν ήταν δυνατός ο έλεγχος της σύνδεσής σου."
      );
      return;
    }

    if (!session?.access_token) {
      setDocumentError(
        "Η συνεδρία σου έχει λήξει. Συνδέσου ξανά."
      );
      return;
    }

    const response = await fetch(
      `${pdfServiceUrl}/generate/service-handover`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          service_case_id: detailsCase.id,
        }),
      }
    );

    let data: {
      document_id?: string;
      already_exists?: boolean;
      service_code?: string;
      storage_path?: string;
      url?: string | null;
      error?: string;
      details?: string | null;
    } = {};

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Ο PDF Service επέστρεψε μη έγκυρη απάντηση."
      );
    }

    if (!response.ok) {
      console.error(
        "Generate handover PDF service error:",
        response.status,
        data
      );

      if (response.status === 401) {
        setDocumentError(
          "Η συνεδρία σου δεν είναι πλέον έγκυρη. Συνδέσου ξανά."
        );
        return;
      }

      if (response.status === 403) {
        setDocumentError(
          "Δεν έχεις δικαίωμα δημιουργίας Δελτίου Παράδοσης."
        );
        return;
      }

      setDocumentError(
        data.error ||
          data.details ||
          "Η δημιουργία του Δελτίου Παράδοσης απέτυχε."
      );
      return;
    }

    await loadServiceDocuments(detailsCase.id);

    if (typeof data.url === "string" && data.url) {
      window.open(
        data.url,
        "_blank",
        "noopener,noreferrer"
      );
    }
  } catch (error) {
    console.error(
      "Generate handover unexpected error:",
      error
    );

    setDocumentError(
      error instanceof Error
        ? error.message
        : "Παρουσιάστηκε απρόβλεπτο σφάλμα κατά τη δημιουργία του PDF."
    );
  } finally {
    setHandoverGenerating(false);
  }
}

async function handleGenerateReturnForm() {
  if (
    !detailsCase ||
    detailsCase.status !== "RETURNED" ||
    returnFormGenerating ||
    generatedReturnForm
  ) {
    return;
  }

  setDocumentError("");
  setReturnFormGenerating(true);

  try {
    const pdfServiceUrl = import.meta.env.VITE_PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      throw new Error(
        "Δεν έχει οριστεί το VITE_PDF_SERVICE_URL."
      );
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error(
        "Get session error:",
        sessionError
      );

      setDocumentError(
        "Δεν ήταν δυνατός ο έλεγχος της σύνδεσής σου."
      );

      return;
    }

    if (!session?.access_token) {
      setDocumentError(
        "Η συνεδρία σου έχει λήξει. Συνδέσου ξανά."
      );

      return;
    }

    const response = await fetch(
      `${pdfServiceUrl}/generate/service-return`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          service_case_id: detailsCase.id,
        }),
      }
    );

    let data: {
      document_id?: string;
      already_exists?: boolean;
      service_code?: string;
      storage_path?: string;
      url?: string | null;
      error?: string;
      details?: string | null;
    } = {};

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Ο PDF Service επέστρεψε μη έγκυρη απάντηση."
      );
    }

    if (!response.ok) {
      console.error(
        "Generate return PDF service error:",
        response.status,
        data
      );

      if (response.status === 401) {
        setDocumentError(
          "Η συνεδρία σου δεν είναι πλέον έγκυρη. Συνδέσου ξανά."
        );

        return;
      }

      if (response.status === 403) {
        setDocumentError(
          "Δεν έχεις δικαίωμα δημιουργίας Δελτίου Παραλαβής."
        );

        return;
      }

      if (response.status === 409) {
        setDocumentError(
          data.error ||
            "Το Δελτίο Παραλαβής μπορεί να δημιουργηθεί μόνο αφού ολοκληρωθεί η επιστροφή από Service."
        );

        return;
      }

      setDocumentError(
        data.error ||
          data.details ||
          "Η δημιουργία του Δελτίου Παραλαβής απέτυχε."
      );

      return;
    }

    await loadServiceDocuments(detailsCase.id);

    if (typeof data.url === "string" && data.url) {
      window.open(
        data.url,
        "_blank",
        "noopener,noreferrer"
      );
    }
  } catch (error) {
    console.error(
      "Generate return form unexpected error:",
      error
    );

    setDocumentError(
      error instanceof Error
        ? error.message
        : "Παρουσιάστηκε απρόβλεπτο σφάλμα κατά τη δημιουργία του PDF."
    );
  } finally {
    setReturnFormGenerating(false);
  }
}

  async function handleOpenServiceDocument(document: ServiceDocument) {
    setDocumentError("");
    const { data, error } = await supabase.storage
      .from("service-documents")
      .createSignedUrl(document.storage_path, 600);

    if (error || !data?.signedUrl) {
      console.error("Signed URL error:", error);
      setDocumentError("Δεν ήταν δυνατό το άνοιγμα του PDF.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDeleteServiceDocument(document: ServiceDocument) {
    if (!detailsCase || document.document_source === "GENERATED") return;

    if (!window.confirm(`Να διαγραφεί το έγγραφο «${document.title}»;`)) {
      return;
    }

    setDocumentBusy(true);
    setDocumentError("");

    const { data: storagePath, error: rpcError } = await supabase.rpc(
      "delete_service_case_document",
      { p_document_id: document.id }
    );

    if (rpcError) {
      console.error("Delete service document metadata error:", rpcError);
      setDocumentError(rpcError.message || "Η διαγραφή απέτυχε.");
      setDocumentBusy(false);
      return;
    }

    const pathToDelete =
      typeof storagePath === "string" ? storagePath : document.storage_path;
    const { error: storageError } = await supabase.storage
      .from("service-documents")
      .remove([pathToDelete]);

    if (storageError) {
      console.error("Delete service document file error:", storageError);
      setDocumentError(
        "Τα στοιχεία του εγγράφου διαγράφηκαν, αλλά το αρχείο δεν διαγράφηκε από το Storage."
      );
    }

    setDocumentBusy(false);
    await loadServiceDocuments(detailsCase.id);
  }

  if (loading) {
    return (
      <div className="maintenance-page">
        <h1>Συντήρηση &amp; Service</h1>
        <p>Φόρτωση δεδομένων...</p>
      </div>
    );
  }

  return (
    <div className="maintenance-page">
      <div className="maintenance-page-header">
        <div>
          <h1>Συντήρηση &amp; Service</h1>
          <p>
            Παρακολούθηση εξωτερικού service, βλαβών,
            επισκευών και τεχνικού ιστορικού.
          </p>
        </div>

        <div className="maintenance-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadData()}
          >
            Ανανέωση
          </button>

          {canOperate && (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                resetCreateForm();
                setCreateOpen(true);
              }}
            >
              + Αποστολή για Service
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="maintenance-page-error">
          {errorMessage}
        </div>
      )}

      <div className="maintenance-stats">
        <div className="maintenance-stat-card">
          <span>Ενεργά Service</span>
          <strong>{stats.activeService}</strong>
          <small>Ανοιχτές υποθέσεις</small>
        </div>
        <div className="maintenance-stat-card">
          <span>Ολοκληρωμένα Service</span>
          <strong>{stats.returnedService}</strong>
          <small>Επιστροφές εξοπλισμού</small>
        </div>
        <div className="maintenance-stat-card">
          <span>Με θέμα</span>
          <strong>{stats.hasIssue}</strong>
          <small>Ενεργός εξοπλισμός</small>
        </div>
        <div className="maintenance-stat-card">
          <span>Σε επισκευή</span>
          <strong>{stats.underRepair}</strong>
          <small>Ενεργός εξοπλισμός</small>
        </div>
      </div>

      <div className="maintenance-tabs">
        <button
          type="button"
          className={activeTab === "service" ? "maintenance-tab active" : "maintenance-tab"}
          onClick={() => setActiveTab("service")}
        >
          Service / Επισκευές
        </button>
        <button
          type="button"
          className={activeTab === "history" ? "maintenance-tab active" : "maintenance-tab"}
          onClick={() => setActiveTab("history")}
        >
          Ιστορικό συντήρησης
        </button>
      </div>

      {activeTab === "service" ? (
        <section className="maintenance-events-card">
          <div className="maintenance-events-heading">
            <div>
              <h2>Υποθέσεις Service</h2>
              <p>
                {filteredServiceCases.length} από {serviceCases.length} υποθέσεις
              </p>
            </div>
          </div>

          <div className="maintenance-filters maintenance-service-filters">
            <div className="maintenance-search">
              <label htmlFor="service-search">Αναζήτηση</label>
              <input
                id="service-search"
                type="search"
                value={serviceSearch}
                onChange={(event) => setServiceSearch(event.target.value)}
                placeholder="SRV, κωδικός εξοπλισμού, serial, εταιρεία..."
              />
            </div>

            <div className="maintenance-filter">
              <label htmlFor="service-status">Κατάσταση</label>
              <select
                id="service-status"
                value={serviceStatusFilter}
                onChange={(event) =>
                  setServiceStatusFilter(event.target.value)
                }
              >
                <option value="">Όλες</option>
                <option value="OPEN">Ανοιχτό</option>
                <option value="SENT">Απεστάλη</option>
                <option value="IN_SERVICE">Σε service</option>
                <option value="RETURNED">Επεστράφη</option>
                <option value="CANCELLED">Ακυρώθηκε</option>
              </select>
            </div>
          </div>

          {filteredServiceCases.length === 0 ? (
            <div className="maintenance-empty">
              Δεν υπάρχουν υποθέσεις Service με τα συγκεκριμένα φίλτρα.
            </div>
          ) : (
            <div className="maintenance-table-wrapper">
              <table className="maintenance-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Εξοπλισμός</th>
                    <th>Αποστολή</th>
                    <th>Εταιρεία</th>
                    <th>Αιτία</th>
                    <th>Κατάσταση</th>
                    <th>Ενέργειες</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServiceCases.map((item) => {
                    const active = ["OPEN", "SENT", "IN_SERVICE"].includes(
                      item.status
                    );

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.service_code}</strong>
                        </td>
                        <td>
                          <div className="maintenance-asset-cell">
                            <strong>{item.assets?.asset_code ?? "—"}</strong>
                            <span>{equipmentName(item.assets)}</span>
                            {item.assets?.serial_number && (
                              <small>SN: {item.assets.serial_number}</small>
                            )}
                          </div>
                        </td>
                        <td>{formatDateTime(item.sent_at)}</td>
                        <td>{item.service_company || "—"}</td>
                        <td>
                          <div className="maintenance-description-cell">
                            <strong>{item.issue_description}</strong>
                            {item.status === "RETURNED" && item.work_performed && (
                              <span>Εργασίες: {item.work_performed}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`maintenance-service-badge status-${item.status.toLowerCase()}`}
                          >
                            {serviceStatusLabel(item.status)}
                          </span>
                        </td>
                        <td>
                          <div className="maintenance-row-actions">
                            <button
                              type="button"
                              className="maintenance-small-button"
                              onClick={() => void openServiceDetails(item)}
                            >
                              Προβολή
                            </button>

                            <Link
                              to={`/assets/${item.asset_id}`}
                              className="maintenance-open-link"
                            >
                              Asset
                            </Link>

                            {canOperate && active && (
                              <>
                                <button
                                  type="button"
                                  className="maintenance-small-button"
                                  onClick={() => openReturn(item)}
                                >
                                  Επιστροφή
                                </button>
                                <button
                                  type="button"
                                  className="maintenance-small-button danger"
                                  onClick={() => openCancel(item)}
                                >
                                  Ακύρωση
                                </button>
                              </>
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
      ) : (
        <section className="maintenance-events-card">
          <div className="maintenance-events-heading">
            <div>
              <h2>Ιστορικό συμβάντων</h2>
              <p>{filteredEvents.length} από {events.length} συμβάντα</p>
            </div>
          </div>

          <div className="maintenance-filters">
            <div className="maintenance-search">
              <label htmlFor="maintenance-search">Αναζήτηση</label>
              <input
                id="maintenance-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Κωδικός, serial, μοντέλο, περιγραφή..."
              />
            </div>

            <div className="maintenance-filter">
              <label htmlFor="maintenance-type">Τύπος συμβάντος</label>
              <select
                id="maintenance-type"
                value={eventTypeFilter}
                onChange={(event) => setEventTypeFilter(event.target.value)}
              >
                <option value="">Όλοι οι τύποι</option>
                <option value="INSPECTION">Έλεγχος</option>
                <option value="ISSUE">Βλάβη / Πρόβλημα</option>
                <option value="REPAIR">Επισκευή</option>
                <option value="MAINTENANCE">Συντήρηση</option>
                <option value="OTHER">Άλλο</option>
              </select>
            </div>

            <div className="maintenance-filter">
              <label htmlFor="maintenance-status">Νέα κατάσταση</label>
              <select
                id="maintenance-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Όλες οι καταστάσεις</option>
                <option value="FUNCTIONAL">Λειτουργικό</option>
                <option value="HAS_ISSUE">Με θέμα</option>
                <option value="UNDER_REPAIR">Σε επισκευή</option>
                <option value="OUT_OF_SERVICE">Εκτός χρήσης</option>
              </select>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="maintenance-empty">
              Δεν βρέθηκαν συμβάντα με τα συγκεκριμένα φίλτρα.
            </div>
          ) : (
            <div className="maintenance-table-wrapper">
              <table className="maintenance-table">
                <thead>
                  <tr>
                    <th>Ημερομηνία</th>
                    <th>Εξοπλισμός</th>
                    <th>Τύπος</th>
                    <th>Περιγραφή</th>
                    <th>Μεταβολή κατάστασης</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{formatDateTime(event.event_date)}</td>
                      <td>
                        <div className="maintenance-asset-cell">
                          <strong>{event.assets?.asset_code ?? "—"}</strong>
                          <span>{equipmentName(event.assets)}</span>
                          {event.assets?.serial_number && (
                            <small>SN: {event.assets.serial_number}</small>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`maintenance-event-badge maintenance-event-${event.event_type.toLowerCase()}`}
                        >
                          {eventTypeLabel(event.event_type)}
                        </span>
                      </td>
                      <td>
                        <div className="maintenance-description-cell">
                          <strong>{event.description}</strong>
                          {event.notes && <span>{event.notes}</span>}
                        </div>
                      </td>
                      <td>
                        <div className="maintenance-transition">
                          <span>{technicalStatusLabel(event.previous_status)}</span>
                          <span>→</span>
                          <strong>{technicalStatusLabel(event.new_status)}</strong>
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/assets/${event.asset_id}`}
                          className="maintenance-open-link"
                        >
                          Άνοιγμα
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {detailsCase && (
        <div className="maintenance-modal-backdrop">
          <div className="maintenance-modal maintenance-service-details-modal" role="dialog" aria-modal="true">
            <div className="maintenance-modal-header">
              <div>
                <h2>{detailsCase.service_code}</h2>
                <p>
                  {detailsCase.assets?.asset_code ?? "—"} · {equipmentName(detailsCase.assets)}
                </p>
              </div>
              <button
                type="button"
                className="maintenance-modal-close"
                disabled={documentBusy || handoverGenerating}
                onClick={() => setDetailsCase(null)}
              >
                ×
              </button>
            </div>

            <div className="maintenance-service-detail-grid">
              <div><span>Κατάσταση</span><strong>{serviceStatusLabel(detailsCase.status)}</strong></div>
              <div><span>Αποστολή</span><strong>{formatDateTime(detailsCase.sent_at)}</strong></div>
              <div><span>Εταιρεία / Service</span><strong>{detailsCase.service_company || "—"}</strong></div>
              <div><span>Επιστροφή</span><strong>{formatDateTime(detailsCase.returned_at)}</strong></div>
              <div><span>Παράδοση από</span><strong>{detailsCase.handed_over_by_name || "—"}</strong><small>{detailsCase.handed_over_by_role || ""}</small></div>
              <div><span>Παραλαβή από</span><strong>{detailsCase.received_by_name || "—"}</strong><small>{detailsCase.received_by_role || ""}</small></div>
            </div>

            <div className="maintenance-service-text-block">
              <span>Αιτία / Βλάβη</span>
              <p>{detailsCase.issue_description}</p>
            </div>

            {detailsCase.work_performed && (
              <div className="maintenance-service-text-block">
                <span>Εργασίες που πραγματοποιήθηκαν</span>
                <p>{detailsCase.work_performed}</p>
              </div>
            )}

            <div className="maintenance-documents-section">
              <div className="maintenance-documents-heading">
                <div>
                  <h3>Έγγραφα Service</h3>
                  <p>PDF έως 10 MB · ιδιωτική πρόσβαση</p>
                </div>
              </div>

              <div className="maintenance-handover-generator">
                <div>
                  <strong>Δελτίο Παράδοσης Εξοπλισμού για Service</strong>
                  <p>
                    {generatedHandover
                      ? "Το επίσημο δελτίο έχει δημιουργηθεί και αποθηκευτεί στην υπόθεση."
                      : "Δημιουργία επίσημου A4 PDF από τα ιστορικά στοιχεία της υπόθεσης."}
                  </p>
                </div>

                {generatedHandover ? (
                  <button
                    type="button"
                    className="maintenance-small-button"
                    disabled={documentBusy || handoverGenerating}
                    onClick={() =>
                      void handleOpenServiceDocument(generatedHandover)
                    }
                  >
                    Άνοιγμα Δελτίου
                  </button>
                ) : canOperate ? (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      documentsLoading || documentBusy || handoverGenerating
                    }
                    onClick={() => void handleGenerateHandover()}
                  >
                    {handoverGenerating
                      ? "Δημιουργία PDF..."
                      : "Δημιουργία Δελτίου Παράδοσης"}
                  </button>
                ) : null}
              </div>

              {detailsCase.status === "RETURNED" && (
  <div className="maintenance-handover-generator">
    <div>
      <strong>
        Δελτίο Παραλαβής Εξοπλισμού από Service
      </strong>

      <p>
        {generatedReturnForm
          ? "Το επίσημο δελτίο παραλαβής έχει δημιουργηθεί και αποθηκευτεί στην υπόθεση."
          : "Δημιουργία επίσημου A4 PDF με τα στοιχεία επιστροφής, τις εργασίες και την τελική κατάσταση του εξοπλισμού."}
      </p>
    </div>

    {generatedReturnForm ? (
      <button
        type="button"
        className="maintenance-small-button"
        disabled={
          documentBusy ||
          handoverGenerating ||
          returnFormGenerating
        }
        onClick={() =>
          void handleOpenServiceDocument(
            generatedReturnForm
          )
        }
      >
        Άνοιγμα Δελτίου Παραλαβής
      </button>
    ) : canOperate ? (
      <button
        type="button"
        className="primary-button"
        disabled={
          documentsLoading ||
          documentBusy ||
          handoverGenerating ||
          returnFormGenerating
        }
        onClick={() =>
          void handleGenerateReturnForm()
        }
      >
        {returnFormGenerating
          ? "Δημιουργία PDF..."
          : "Δημιουργία Δελτίου Παραλαβής"}
      </button>
    ) : null}
  </div>
)}

              {documentError && (
                <div className="maintenance-page-error">{documentError}</div>
              )}

              {documentsLoading ? (
                <div className="maintenance-documents-empty">Φόρτωση εγγράφων...</div>
              ) : serviceDocuments.length === 0 ? (
                <div className="maintenance-documents-empty">Δεν υπάρχουν ακόμη έγγραφα.</div>
              ) : (
                <div className="maintenance-documents-list">
                  {serviceDocuments.map((document) => (
                    <div className="maintenance-document-row" key={document.id}>
                      <div className="maintenance-document-info">
                        <div className="maintenance-document-title-line">
                          <strong>{document.title}</strong>
                          <span className="maintenance-document-type">
                            {serviceDocumentTypeLabel(document.document_type)}
                          </span>
                          {document.document_source === "GENERATED" && (
                            <span className="maintenance-generated-badge">Από την εφαρμογή</span>
                          )}
                        </div>
                        <small>
                          {document.original_filename} · {formatFileSize(document.file_size)} · {formatDateTime(document.created_at)}
                        </small>
                      </div>
                      <div className="maintenance-document-actions">
                        <button
                          type="button"
                          className="maintenance-small-button"
                          onClick={() => void handleOpenServiceDocument(document)}
                        >
                          Άνοιγμα
                        </button>
                        {canOperate && document.document_source === "EXTERNAL" && (
                          <button
                            type="button"
                            className="maintenance-small-button danger"
                            disabled={documentBusy}
                            onClick={() => void handleDeleteServiceDocument(document)}
                          >
                            Διαγραφή
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canOperate && (
              <form className="maintenance-document-upload" onSubmit={handleUploadServiceDocument}>
                <h3>Ανέβασμα εγγράφου</h3>
                <div className="maintenance-form-grid">
                  <div>
                    <label htmlFor="service-document-type">Τύπος</label>
                    <select
                      id="service-document-type"
                      value={documentType}
                      onChange={(event) => setDocumentType(event.target.value as ServiceDocumentType)}
                    >
                      <option value="SERVICE_REPORT">Δελτίο Service</option>
                      <option value="REPAIR_REPORT">Αναφορά επισκευής</option>
                      <option value="QUOTE">Προσφορά</option>
                      <option value="INVOICE">Τιμολόγιο</option>
                      <option value="OTHER">Άλλο</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="service-document-title">Τίτλος</label>
                    <input
                      id="service-document-title"
                      value={documentTitle}
                      onChange={(event) => setDocumentTitle(event.target.value)}
                      placeholder="π.χ. Δελτίο επισκευής"
                    />
                  </div>
                </div>

                <label htmlFor="service-document-file">Αρχείο PDF</label>
                <input
                  id="service-document-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                />

                <div className="maintenance-document-upload-actions">
                  <button type="submit" className="primary-button" disabled={documentBusy}>
                    {documentBusy ? "Ανέβασμα..." : "+ Ανέβασμα PDF"}
                  </button>
                </div>
              </form>
              )}
            </div>
          </div>
        </div>
      )}

      {canOperate && createOpen && (
        <div className="maintenance-modal-backdrop">
          <div className="maintenance-modal" role="dialog" aria-modal="true">
            <div className="maintenance-modal-header">
              <div>
                <h2>Αποστολή για Service</h2>
                <p>
                  Δημιουργείται αυτόματα κωδικός SRV και ο εξοπλισμός
                  μεταβαίνει σε «Σε επισκευή».
                </p>
              </div>
              <button
                type="button"
                className="maintenance-modal-close"
                disabled={submitting}
                onClick={() => setCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form className="maintenance-form" onSubmit={handleCreateService}>
              <label htmlFor="service-asset">Εξοπλισμός *</label>
              <select
                id="service-asset"
                value={createAssetId}
                onChange={(event) => setCreateAssetId(event.target.value)}
                required
              >
                <option value="">Επίλεξε εξοπλισμό</option>
                {availableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.asset_code} — {equipmentName(asset)}
                  </option>
                ))}
              </select>

              <label htmlFor="service-issue">Αιτία / Βλάβη *</label>
              <textarea
                id="service-issue"
                value={issueDescription}
                onChange={(event) => setIssueDescription(event.target.value)}
                required
              />

              <div className="maintenance-form-grid">
                <div>
                  <label htmlFor="service-company">Εταιρεία / Service</label>
                  <input
                    id="service-company"
                    value={serviceCompany}
                    onChange={(event) => setServiceCompany(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="service-sent-at">Ημερομηνία παράδοσης *</label>
                  <input
                    id="service-sent-at"
                    type="datetime-local"
                    value={sentAt}
                    onChange={(event) => setSentAt(event.target.value)}
                    required
                  />
                </div>
              </div>

              <h3>Παράδοση από ΔΑΠΑΧΟ</h3>
              <div className="maintenance-form-grid">
                <div>
                  <label htmlFor="handed-name">Ονοματεπώνυμο</label>
                  <input
                    id="handed-name"
                    value={handedByName}
                    onChange={(event) => setHandedByName(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="handed-role">Ιδιότητα</label>
                  <input
                    id="handed-role"
                    value={handedByRole}
                    onChange={(event) => setHandedByRole(event.target.value)}
                  />
                </div>
              </div>

              <h3>Παραλαβή από Service</h3>
              <div className="maintenance-form-grid">
                <div>
                  <label htmlFor="received-name">Ονοματεπώνυμο</label>
                  <input
                    id="received-name"
                    value={receivedByName}
                    onChange={(event) => setReceivedByName(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="received-role">Ιδιότητα</label>
                  <input
                    id="received-role"
                    value={receivedByRole}
                    onChange={(event) => setReceivedByRole(event.target.value)}
                  />
                </div>
              </div>

              {actionError && (
                <div className="maintenance-page-error">{actionError}</div>
              )}

              <div className="maintenance-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={() => setCreateOpen(false)}
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                >
                  {submitting ? "Καταχώριση..." : "Αποστολή για Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canOperate && returnCase && (
        <div className="maintenance-modal-backdrop">
          <div className="maintenance-modal" role="dialog" aria-modal="true">
            <div className="maintenance-modal-header">
              <div>
                <h2>Επιστροφή από Service</h2>
                <p>
                  {returnCase.service_code} · {returnCase.assets?.asset_code}
                </p>
              </div>
              <button
                type="button"
                className="maintenance-modal-close"
                disabled={submitting}
                onClick={() => setReturnCase(null)}
              >
                ×
              </button>
            </div>

            <form className="maintenance-form" onSubmit={handleReturnService}>
              <label htmlFor="returned-at">Ημερομηνία επιστροφής *</label>
              <input
                id="returned-at"
                type="datetime-local"
                value={returnedAt}
                onChange={(event) => setReturnedAt(event.target.value)}
                required
              />

              <label htmlFor="work-performed">Εργασίες που πραγματοποιήθηκαν *</label>
              <textarea
                id="work-performed"
                value={workPerformed}
                onChange={(event) => setWorkPerformed(event.target.value)}
                required
              />

              <div className="maintenance-form-grid">
                <div>
                  <label htmlFor="return-cost">Κόστος (€)</label>
                  <input
                    id="return-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={returnCost}
                    onChange={(event) => setReturnCost(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="final-status">Τελική κατάσταση *</label>
                  <select
                    id="final-status"
                    value={finalStatus}
                    onChange={(event) =>
                      setFinalStatus(event.target.value as TechnicalStatus)
                    }
                  >
                    <option value="FUNCTIONAL">Λειτουργικό</option>
                    <option value="HAS_ISSUE">Με θέμα</option>
                    <option value="OUT_OF_SERVICE">Εκτός χρήσης</option>
                  </select>
                </div>
              </div>

              <label htmlFor="return-notes">Σημειώσεις επιστροφής</label>
              <textarea
                id="return-notes"
                value={returnNotes}
                onChange={(event) => setReturnNotes(event.target.value)}
              />

              <h3>Παράδοση από Service</h3>

<div className="maintenance-form-grid">
  <div>
    <label htmlFor="returned-by-name">
      Ονοματεπώνυμο
    </label>

    <input
      id="returned-by-name"
      type="text"
      value={returnedByName}
      onChange={(event) =>
        setReturnedByName(event.target.value)
      }
      placeholder="Ονοματεπώνυμο"
    />
  </div>

  <div>
    <label htmlFor="returned-by-role">
      Ιδιότητα
    </label>

    <input
      id="returned-by-role"
      type="text"
      value={returnedByRole}
      onChange={(event) =>
        setReturnedByRole(event.target.value)
      }
      placeholder="π.χ. Τεχνικός"
    />
  </div>
</div>

<h3>Παραλαβή από ΔΑΠΑΧΟ</h3>

<div className="maintenance-form-grid">
  <div>
    <label htmlFor="accepted-by-name">
      Ονοματεπώνυμο
    </label>

    <input
      id="accepted-by-name"
      type="text"
      value={acceptedByName}
      onChange={(event) =>
        setAcceptedByName(event.target.value)
      }
      placeholder="Ονοματεπώνυμο"
    />
  </div>

  <div>
    <label htmlFor="accepted-by-role">
      Ιδιότητα
    </label>

    <input
      id="accepted-by-role"
      type="text"
      value={acceptedByRole}
      onChange={(event) =>
        setAcceptedByRole(event.target.value)
      }
      placeholder="π.χ. Υπεύθυνος εξοπλισμού"
    />
  </div>
</div>

              {actionError && (
                <div className="maintenance-page-error">{actionError}</div>
              )}

              <div className="maintenance-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={() => setReturnCase(null)}
                >
                  Πίσω
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                >
                  {submitting ? "Καταχώριση..." : "Καταχώριση επιστροφής"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canOperate && cancelCase && (
        <div className="maintenance-modal-backdrop">
          <div className="maintenance-modal maintenance-modal-small" role="dialog" aria-modal="true">
            <div className="maintenance-modal-header">
              <div>
                <h2>Ακύρωση Service</h2>
                <p>
                  {cancelCase.service_code} · {cancelCase.assets?.asset_code}
                </p>
              </div>
              <button
                type="button"
                className="maintenance-modal-close"
                disabled={submitting}
                onClick={() => setCancelCase(null)}
              >
                ×
              </button>
            </div>

            <form className="maintenance-form" onSubmit={handleCancelService}>
              <label htmlFor="cancel-reason">Αιτία ακύρωσης *</label>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                required
              />

              <p className="maintenance-warning">
                Η υπόθεση θα ακυρωθεί και η προηγούμενη τεχνική
                κατάσταση του εξοπλισμού θα επανέλθει.
              </p>

              {actionError && (
                <div className="maintenance-page-error">{actionError}</div>
              )}

              <div className="maintenance-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={() => setCancelCase(null)}
                >
                  Πίσω
                </button>
                <button
                  type="submit"
                  className="maintenance-danger-button"
                  disabled={submitting}
                >
                  {submitting ? "Ακύρωση..." : "Ακύρωση Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
