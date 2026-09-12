import { useEffect, useState } from "react";
import QRCode from "qrcode";

import "./AssetQrLabel.css";

interface AssetQrLabelProps {
  assetCode: string;
  qrToken: string;
}

export default function AssetQrLabel({
  assetCode,
  qrToken,
}: AssetQrLabelProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const publicAppUrl =
    import.meta.env.VITE_PUBLIC_APP_URL ||
    window.location.origin;

  const publicUrl =
    `${publicAppUrl.replace(/\/$/, "")}/q/${qrToken}`;

  useEffect(() => {
    async function generateQr() {
      try {
        setErrorMessage("");

        const dataUrl = await QRCode.toDataURL(
          publicUrl,
          {
            width: 600,
            margin: 1,
            errorCorrectionLevel: "M",
          }
        );

        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error(
          "QR generation error:",
          error
        );

        setErrorMessage(
          "Δεν ήταν δυνατή η δημιουργία του QR."
        );
      }
    }

    void generateQr();
  }, [publicUrl]);

  function handlePrint() {
    if (!qrDataUrl) {
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=700,height=500"
    );

    if (!printWindow) {
      window.alert(
        "Δεν ήταν δυνατό να ανοίξει το παράθυρο εκτύπωσης. Έλεγξε αν ο browser μπλοκάρει τα pop-ups."
      );
      return;
    }

    const safeAssetCode = assetCode.replace(
      /[&<>"']/g,
      (character) => {
        const entities: Record<string, string> = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        };

        return entities[character];
      }
    );

    printWindow.document.write(`
      <!doctype html>
      <html lang="el">
        <head>
          <meta charset="UTF-8" />

          <title>Ετικέτα ${safeAssetCode}</title>

          <style>
            @page {
              size: 70mm 40mm;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              width: 70mm;
              height: 40mm;

              margin: 0;
              padding: 0;

              background: #ffffff;
            }

            body {
              font-family:
                Arial,
                Helvetica,
                sans-serif;
            }

            .label {
              width: 70mm;
              height: 40mm;

              padding: 3mm;

              display: flex;
              align-items: center;
              justify-content: space-between;

              gap: 3mm;

              background: #ffffff;
              color: #111827;

              border: 0.4mm solid #111827;

              overflow: hidden;

              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            .identity {
              flex: 1;
              min-width: 0;

              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }

            .organization {
              margin-bottom: 3mm;

              color: #f58220;

              font-size: 4.5mm;
              line-height: 1;
              font-weight: 800;

              letter-spacing: 0.3mm;

              text-align: center;
            }

            .asset-code {
              color: #111827;

              font-size: 7mm;
              line-height: 1;
              font-weight: 800;

              white-space: nowrap;
              text-align: center;
            }

            .qr {
              display: block;

              width: 30mm;
              height: 30mm;

              flex: 0 0 30mm;

              image-rendering: pixelated;
            }

            @media print {
              html,
              body {
                width: 70mm;
                height: 40mm;
              }
            }
          </style>
        </head>

        <body>
          <div class="label">
            <div class="identity">
              <div class="organization">
                ΔΑΠΑΧΟ
              </div>

              <div class="asset-code">
                ${safeAssetCode}
              </div>
            </div>

            <img
              class="qr"
              src="${qrDataUrl}"
              alt="QR ${safeAssetCode}"
            />
          </div>

          <script>
            const image = document.querySelector(".qr");

            function startPrint() {
              setTimeout(() => {
                window.print();
              }, 150);
            }

            if (image.complete) {
              startPrint();
            } else {
              image.addEventListener(
                "load",
                startPrint,
                { once: true }
              );
            }
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  return (
    <section className="asset-qr-section">
      <div className="asset-qr-section-header">
        <div>
          <h2>QR / Ψηφιακή ταυτότητα</h2>

          <p>
            Μόνιμη ετικέτα αναγνώρισης του
            εξοπλισμού.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button asset-qr-print-button"
          onClick={handlePrint}
          disabled={!qrDataUrl}
        >
          Εκτύπωση ετικέτας
        </button>
      </div>

      {errorMessage ? (
        <p className="asset-qr-error">
          {errorMessage}
        </p>
      ) : (
        <div className="asset-qr-content">
          <div className="asset-qr-label">
            <div className="asset-qr-identity">
              <div className="asset-qr-organization">
                ΔΑΠΑΧΟ
              </div>

              <div className="asset-qr-code-text">
                {assetCode}
              </div>
            </div>

            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR ${assetCode}`}
                className="asset-qr-image"
              />
            ) : (
              <div className="asset-qr-loading">
                Δημιουργία QR...
              </div>
            )}
          </div>

          <div className="asset-qr-information">
            <strong>
              Δημόσιος σύνδεσμος
            </strong>

            <p>{publicUrl}</p>

            <small>
              Το QR αποτελεί τη μόνιμη ψηφιακή
              ταυτότητα του εξοπλισμού. Δεν χρειάζεται
              αντικατάσταση αν αλλάξουν μοντέλο,
              κατάσταση ή τοποθεσία.
            </small>

            <div className="asset-qr-actions">
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="secondary-button asset-qr-open-button"
              >
                Άνοιγμα δημόσιας σελίδας
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}