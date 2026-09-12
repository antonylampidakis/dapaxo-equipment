import { useCallback, useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";

import "./AssetPhotoGallery.css";

interface AssetPhoto {
  id: string;
  asset_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

interface PhotoWithUrl extends AssetPhoto {
  url: string;
}

interface AssetPhotoGalleryProps {
  assetId: string;
  canOperate: boolean;
}

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function AssetPhotoGallery({
  assetId,
  canOperate,
}: AssetPhotoGalleryProps) {
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingPrimary, setChangingPrimary] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  /*
   * Φόρτωση φωτογραφιών από DB
   * και δημιουργία προσωρινών signed URLs
   * για το private Storage bucket.
   */
  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("asset_photos")
      .select(`
        id,
        asset_id,
        storage_path,
        original_filename,
        mime_type,
        file_size,
        sort_order,
        is_primary,
        created_at
      `)
      .eq("asset_id", assetId)
      .order("sort_order");

    if (error) {
      console.error(error);

      setErrorMessage(
        "Δεν ήταν δυνατή η φόρτωση των φωτογραφιών."
      );

      setLoading(false);
      return;
    }

    const rows = (data ?? []) as AssetPhoto[];

    const photosWithUrls: PhotoWithUrl[] = [];

    for (const photo of rows) {
      const { data: signedData, error: signedError } =
        await supabase.storage
          .from("asset-photos")
          .createSignedUrl(
            photo.storage_path,
            3600
          );

      if (signedError) {
        console.error(signedError);
        continue;
      }

      photosWithUrls.push({
        ...photo,
        url: signedData.signedUrl,
      });
    }

    setPhotos(photosWithUrls);

    /*
     * Αν η φωτογραφία που βλέπαμε εξακολουθεί
     * να υπάρχει, την κρατάμε επιλεγμένη.
     *
     * Διαφορετικά ανοίγουμε πρώτα την primary.
     */
    setSelectedPhotoId((currentId) => {
      const stillExists = photosWithUrls.some(
        (photo) => photo.id === currentId
      );

      if (stillExists) {
        return currentId;
      }

      const primaryPhoto = photosWithUrls.find(
        (photo) => photo.is_primary
      );

      return (
        primaryPhoto?.id ??
        photosWithUrls[0]?.id ??
        null
      );
    });

    setLoading(false);
  }, [assetId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  /*
   * Η φωτογραφία που εμφανίζεται μεγάλη.
   *
   * Αυτό ΔΕΝ σημαίνει απαραίτητα ότι είναι
   * και η primary φωτογραφία.
   */
  const mainPhoto =
    photos.find(
      (photo) => photo.id === selectedPhotoId
    ) ??
    photos[0] ??
    null;

  /*
   * Upload νέας φωτογραφίας.
   */
  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (photos.length >= MAX_PHOTOS) {
      setErrorMessage(
        "Το Asset μπορεί να έχει έως 5 φωτογραφίες."
      );
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage(
        "Επιτρέπονται μόνο αρχεία JPEG, PNG ή WEBP."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        "Η φωτογραφία δεν μπορεί να ξεπερνά τα 5 MB."
      );
      return;
    }

    setUploading(true);
    setErrorMessage("");

    /*
     * Βρίσκουμε την πρώτη ελεύθερη θέση 1–5.
     */
    const usedPositions = new Set(
      photos.map((photo) => photo.sort_order)
    );

    let sortOrder = 1;

    while (
      usedPositions.has(sortOrder) &&
      sortOrder <= MAX_PHOTOS
    ) {
      sortOrder += 1;
    }

    if (sortOrder > MAX_PHOTOS) {
      setErrorMessage(
        "Δεν υπάρχει διαθέσιμη θέση φωτογραφίας."
      );

      setUploading(false);
      return;
    }

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() || "jpg";

    const fileName =
      `${crypto.randomUUID()}.${extension}`;

    const storagePath =
      `${assetId}/${fileName}`;

    /*
     * 1. Upload στο private Storage.
     */
    const { error: uploadError } =
      await supabase.storage
        .from("asset-photos")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

    if (uploadError) {
      console.error(uploadError);

      setErrorMessage(
        "Δεν ήταν δυνατό το ανέβασμα της φωτογραφίας."
      );

      setUploading(false);
      return;
    }

    /*
     * 2. Καταχώριση metadata στη DB.
     *
     * Primary γίνεται αυτόματα ΜΟΝΟ όταν
     * αυτή είναι η πρώτη φωτογραφία του Asset.
     */
    const { error: databaseError } =
      await supabase
        .from("asset_photos")
        .insert({
          asset_id: assetId,
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type,
          file_size: file.size,
          sort_order: sortOrder,
          is_primary: photos.length === 0,
        });

    if (databaseError) {
      console.error(databaseError);

      /*
       * Αν αποτύχει η DB εγγραφή,
       * καθαρίζουμε το Storage ώστε να μη
       * δημιουργηθεί orphan file.
       */
      await supabase.storage
        .from("asset-photos")
        .remove([storagePath]);

      setErrorMessage(
        "Η φωτογραφία ανέβηκε αλλά δεν ήταν δυνατή η καταχώρισή της."
      );

      setUploading(false);
      return;
    }

    await loadPhotos();

    setUploading(false);
  }

  /*
   * Αλλαγή primary φωτογραφίας μέσω RPC.
   */
  async function handleSetPrimary() {
    if (
      !mainPhoto ||
      mainPhoto.is_primary ||
      changingPrimary
    ) {
      return;
    }

    setChangingPrimary(true);
    setErrorMessage("");

    const { error } = await supabase.rpc(
      "set_asset_primary_photo",
      {
        p_asset_id: assetId,
        p_photo_id: mainPhoto.id,
      }
    );

    if (error) {
      console.error(error);

      setErrorMessage(
        "Δεν ήταν δυνατή η αλλαγή της κύριας φωτογραφίας."
      );

      setChangingPrimary(false);
      return;
    }

    await loadPhotos();

    setChangingPrimary(false);
  }

  /*
   * Διαγραφή επιλεγμένης φωτογραφίας.
   *
   * ΠΡΟΣΟΧΗ:
   * Προς το παρόν δεν επιτρέπουμε τη διαγραφή
   * της primary. Θα την υλοποιήσουμε στο επόμενο
   * βήμα με ασφαλή DB διαδικασία.
   */
 async function handleDeletePhoto() {
  if (!mainPhoto || deleting) {
    return;
  }

  /*
   * Δεν επιτρέπουμε να μείνει Asset χωρίς
   * φωτογραφία, αφού η απαίτηση είναι 1–5.
   */
  if (photos.length === 1) {
    setErrorMessage(
      "Το Asset πρέπει να έχει τουλάχιστον μία φωτογραφία. Πρόσθεσε πρώτα άλλη φωτογραφία πριν διαγράψεις αυτή."
    );
    return;
  }

  const confirmed = window.confirm(
    mainPhoto.is_primary
      ? "Αυτή είναι η κύρια φωτογραφία. Θέλεις να τη διαγράψεις; Θα οριστεί αυτόματα νέα κύρια φωτογραφία."
      : "Θέλεις σίγουρα να διαγράψεις αυτή τη φωτογραφία;"
  );

  if (!confirmed) {
    return;
  }

  setDeleting(true);
  setErrorMessage("");

  /*
   * Η DB:
   * - διαγράφει το metadata
   * - αναδιοργανώνει sort_order
   * - ορίζει νέα primary αν χρειάζεται
   * - επιστρέφει το Storage path
   */
  const { data: storagePath, error: databaseError } =
    await supabase.rpc(
      "delete_asset_photo",
      {
        p_asset_id: assetId,
        p_photo_id: mainPhoto.id,
      }
    );

  if (databaseError) {
    console.error(databaseError);

    setErrorMessage(
      "Δεν ήταν δυνατή η διαγραφή της φωτογραφίας."
    );

    setDeleting(false);
    return;
  }

  /*
   * Διαγράφουμε και το πραγματικό αρχείο
   * από το private Storage.
   */
  if (storagePath) {
    const { error: storageError } =
      await supabase.storage
        .from("asset-photos")
        .remove([storagePath]);

    if (storageError) {
      console.error(storageError);

      setErrorMessage(
        "Η φωτογραφία αφαιρέθηκε από την καταχώριση, αλλά το αρχείο δεν διαγράφηκε από το Storage."
      );
    }
  }

  setSelectedPhotoId(null);

  await loadPhotos();

  setDeleting(false);
}

  return (
    <section className="asset-photo-section">
      <div className="asset-photo-header">
        <div>
          <h2>Φωτογραφίες</h2>

          <p>
            {photos.length} / {MAX_PHOTOS} φωτογραφίες
          </p>
        </div>

        {canOperate && photos.length < MAX_PHOTOS && (
          <label className="primary-button photo-upload-button">
            {uploading
              ? "Ανέβασμα..."
              : "+ Προσθήκη"}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              hidden
            />
          </label>
        )}
      </div>

      {errorMessage && (
        <p className="asset-photo-error">
          {errorMessage}
        </p>
      )}

      {loading ? (
        <p>Φόρτωση φωτογραφιών...</p>
      ) : photos.length === 0 ? (
        <div className="asset-photo-empty">
          <p>
            Δεν έχει καταχωριστεί φωτογραφία για
            αυτό το Asset.
          </p>
        </div>
      ) : (
        <>
          <div className="asset-main-photo">
            <img
              src={mainPhoto?.url}
              alt="Φωτογραφία εξοπλισμού"
            />
          </div>

          <div className="asset-photo-thumbnails">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className={`asset-photo-thumbnail ${
                  mainPhoto?.id === photo.id
                    ? "asset-photo-thumbnail-selected"
                    : ""
                }`}
                onClick={() =>
                  setSelectedPhotoId(photo.id)
                }
              >
                <img
                  src={photo.url}
                  alt={`Φωτογραφία ${photo.sort_order}`}
                />

                {photo.is_primary && (
                  <span className="primary-photo-badge">
                    Κύρια
                  </span>
                )}
              </button>
            ))}
          </div>

          {canOperate && (
          <div className="asset-photo-actions">
            {mainPhoto &&
              !mainPhoto.is_primary && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSetPrimary}
                  disabled={
                    changingPrimary ||
                    deleting
                  }
                >
                  {changingPrimary
                    ? "Αλλαγή..."
                    : "Ορισμός ως κύρια"}
                </button>
              )}

            <button
              type="button"
              className="photo-delete-button"
              onClick={handleDeletePhoto}
              disabled={
                deleting ||
                changingPrimary ||
                !mainPhoto
              }
            >
              {deleting
                ? "Διαγραφή..."
                : "Διαγραφή επιλεγμένης φωτογραφίας"}
            </button>
          </div>
          )}
        </>
      )}
    </section>
  );
}