import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

import "./PublicAssetQrPage.css";

interface PublicAsset {
  asset_code: string;
  category_name: string;
  manufacturer_name: string | null;
  model_name: string | null;
  lifecycle_status: "ACTIVE" | "RETIRED";
}

interface PublicAssetPhoto {
  id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

type PublicModelDocumentType =
  | "USER_MANUAL"
  | "QUICK_START"
  | "TECHNICAL_MANUAL"
  | "OTHER";

interface PublicModelDocument {
  id: string;
  document_type: PublicModelDocumentType;
  title: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  url: string;
}

const DOCUMENT_TYPE_LABELS: Record<PublicModelDocumentType, string> = {
  USER_MANUAL: "Εγχειρίδιο χρήσης",
  QUICK_START: "Γρήγορος οδηγός",
  TECHNICAL_MANUAL: "Τεχνικό εγχειρίδιο",
  OTHER: "Έγγραφο",
};

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PublicAssetQrPage() {
  const { token } = useParams<{ token: string }>();

  const [asset, setAsset] = useState<PublicAsset | null>(null);
  const [photos, setPhotos] = useState<PublicAssetPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] =
    useState<PublicAssetPhoto | null>(null);

  const [documents, setDocuments] =
    useState<PublicModelDocument[]>([]);

  const [loading, setLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [documentsError, setDocumentsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPublicAsset() {
      if (!token) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotFound(false);
      setErrorMessage("");
      setDocumentsError("");
      setPhotos([]);
      setSelectedPhoto(null);
      setDocuments([]);

      /*
       * =====================================================
       * 1. PUBLIC ASSET DATA
       * =====================================================
       */

      const { data, error } = await supabase.rpc(
        "get_public_asset_by_qr",
        {
          p_token: token,
        }
      );

      if (cancelled) return;

      if (error) {
        console.error("Public QR lookup error:", error);

        setErrorMessage(
          "Παρουσιάστηκε πρόβλημα κατά την ανάκτηση των στοιχείων."
        );
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setAsset(data[0] as PublicAsset);
      setLoading(false);

      /*
       * =====================================================
       * 2. PUBLIC ASSET PHOTOS
       * 3. PUBLIC MODEL DOCUMENTS
       *
       * Φορτώνουν ανεξάρτητα. Αποτυχία σε ένα από τα δύο
       * δεν καταστρέφει τη βασική δημόσια σελίδα του asset.
       * =====================================================
       */

      setPhotosLoading(true);
      setDocumentsLoading(true);

      const [photoResult, documentResult] = await Promise.allSettled([
        supabase.functions.invoke("public-asset-photos", {
          body: { token },
        }),
        supabase.functions.invoke("public-model-documents", {
          body: { token },
        }),
      ]);

      if (cancelled) return;

      /*
       * =====================================================
       * PHOTOS RESULT
       * =====================================================
       */

      if (photoResult.status === "fulfilled") {
        const {
          data: photoResponse,
          error: photoError,
        } = photoResult.value;

        if (photoError) {
          console.error("Public asset photos error:", photoError);
        } else {
          const loadedPhotos =
            Array.isArray(photoResponse?.photos)
              ? (photoResponse.photos as PublicAssetPhoto[])
              : [];

          setPhotos(loadedPhotos);

          if (loadedPhotos.length > 0) {
            const primaryPhoto =
              loadedPhotos.find((photo) => photo.is_primary) ??
              loadedPhotos[0];

            setSelectedPhoto(primaryPhoto);
          }
        }
      } else {
        console.error(
          "Public asset photos request failed:",
          photoResult.reason
        );
      }

      setPhotosLoading(false);

      /*
       * =====================================================
       * DOCUMENTS RESULT
       * =====================================================
       */

      if (documentResult.status === "fulfilled") {
        const {
          data: documentResponse,
          error: documentInvokeError,
        } = documentResult.value;

        if (documentInvokeError) {
          console.error(
            "Public model documents error:",
            documentInvokeError
          );

          setDocumentsError(
            "Τα εγχειρίδια δεν είναι διαθέσιμα αυτή τη στιγμή."
          );
        } else {
          const loadedDocuments =
            Array.isArray(documentResponse?.documents)
              ? (documentResponse.documents as PublicModelDocument[])
              : [];

          setDocuments(loadedDocuments);
        }
      } else {
        console.error(
          "Public model documents request failed:",
          documentResult.reason
        );

        setDocumentsError(
          "Τα εγχειρίδια δεν είναι διαθέσιμα αυτή τη στιγμή."
        );
      }

      setDocumentsLoading(false);
    }

    void loadPublicAsset();

    return () => {
      cancelled = true;
    };
  }, [token]);

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <main className="qr-page">
        <div className="qr-card">
          <div className="qr-logo">ΔΑΠΑΧΟ</div>

          <p className="qr-muted">
            Φόρτωση στοιχείων...
          </p>
        </div>
      </main>
    );
  }

  /*
   * =========================================================
   * ERROR
   * =========================================================
   */

  if (errorMessage) {
    return (
      <main className="qr-page">
        <div className="qr-card">
          <div className="qr-logo">ΔΑΠΑΧΟ</div>

          <h1>Σφάλμα</h1>

          <p className="qr-error">
            {errorMessage}
          </p>
        </div>
      </main>
    );
  }

  /*
   * =========================================================
   * NOT FOUND
   * =========================================================
   */

  if (notFound || !asset) {
    return (
      <main className="qr-page">
        <div className="qr-card">
          <div className="qr-logo">ΔΑΠΑΧΟ</div>

          <h1>Μη έγκυρος κωδικός QR</h1>

          <p className="qr-muted">
            Δεν βρέθηκε εξοπλισμός που να αντιστοιχεί σε αυτόν
            τον κωδικό.
          </p>
        </div>
      </main>
    );
  }

  const isActive =
    asset.lifecycle_status === "ACTIVE";

  return (
    <main className="qr-page">
      <article className="qr-card">
        {/* =================================================
            HEADER
        ================================================= */}

        <header className="qr-header">
          <div className="qr-logo">ΔΑΠΑΧΟ</div>

          <p className="qr-eyebrow">
            Μητρώο εξοπλισμού
          </p>

          <h1 className="qr-asset-code">
            {asset.asset_code}
          </h1>

          <div
            className={
              isActive
                ? "qr-status qr-status-active"
                : "qr-status qr-status-retired"
            }
          >
            {isActive ? "Ενεργό" : "Αποσυρμένο"}
          </div>
        </header>

        {/* =================================================
            PHOTOS
        ================================================= */}

        <section className="qr-photo-section">
          {photosLoading ? (
            <div className="qr-photo-loading">
              Φόρτωση φωτογραφιών...
            </div>
          ) : photos.length > 0 && selectedPhoto ? (
            <>
              <button
                type="button"
                className="qr-main-photo-button"
                onClick={() =>
                  window.open(
                    selectedPhoto.url,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                aria-label="Άνοιγμα φωτογραφίας"
              >
                <img
                  src={selectedPhoto.url}
                  alt={`Εξοπλισμός ${asset.asset_code}`}
                  className="qr-main-photo"
                />
              </button>

              {photos.length > 1 && (
                <div className="qr-photo-thumbnails">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      className={
                        selectedPhoto.id === photo.id
                          ? "qr-thumbnail-button qr-thumbnail-selected"
                          : "qr-thumbnail-button"
                      }
                      onClick={() =>
                        setSelectedPhoto(photo)
                      }
                      aria-label={`Φωτογραφία ${index + 1}`}
                    >
                      <img
                        src={photo.url}
                        alt={`Φωτογραφία ${index + 1} του ${asset.asset_code}`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </section>

        {/* =================================================
            PUBLIC DETAILS
        ================================================= */}

        <dl className="qr-details">
          <div>
            <dt>Κατηγορία</dt>
            <dd>{asset.category_name}</dd>
          </div>

          <div>
            <dt>Κατασκευαστής</dt>
            <dd>{asset.manufacturer_name || "—"}</dd>
          </div>

          <div>
            <dt>Μοντέλο</dt>
            <dd>{asset.model_name || "—"}</dd>
          </div>
        </dl>

        {/* =================================================
            PUBLIC DOCUMENTS
        ================================================= */}

        {(documentsLoading ||
          documents.length > 0 ||
          documentsError) && (
          <section className="qr-documents-section">
            <div className="qr-section-heading">
              <p className="qr-eyebrow">
                Τεκμηρίωση μοντέλου
              </p>
              <h2>Οδηγίες &amp; Εγχειρίδια</h2>
            </div>

            {documentsLoading ? (
              <p className="qr-muted">
                Φόρτωση εγχειριδίων...
              </p>
            ) : documentsError ? (
              <p className="qr-document-error">
                {documentsError}
              </p>
            ) : (
              <div className="qr-document-list">
                {documents.map((document) => {
                  const size = formatFileSize(
                    document.file_size
                  );

                  return (
                    <article
                      className="qr-document-card"
                      key={document.id}
                    >
                      <div className="qr-document-icon">
                        PDF
                      </div>

                      <div className="qr-document-content">
                        <span className="qr-document-type">
                          {
                            DOCUMENT_TYPE_LABELS[
                              document.document_type
                            ]
                          }
                        </span>

                        <h3>{document.title}</h3>

                        {size && (
                          <p className="qr-document-meta">
                            PDF · {size}
                          </p>
                        )}
                      </div>

                      <a
                        className="qr-document-open"
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Άνοιγμα PDF
                      </a>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="qr-public-footer">
          <p className="qr-footer-text">
            Ψηφιακή ταυτότητα εξοπλισμού ΔΑΠΑΧΟ
          </p>
        </footer>
      </article>
    </main>
  );
}
