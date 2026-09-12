import { createClient } from "@supabase/supabase-js";
import {
  PDFDocument,
  PDFFont,
  rgb,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "service-documents";

const REGULAR_FONT_PATH =
  "_system/fonts/NotoSans-Regular.ttf";

const BOLD_FONT_PATH =
  "_system/fonts/NotoSans-Bold.ttf";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const MARGIN_X = 50;
const TOP = 790;
const BOTTOM = 50;

interface ServiceCaseRow {
  id: string;
  service_code: string;
  status: string;

  issue_description: string;
  sent_at: string | null;
  service_company: string | null;

  handed_over_by_name: string | null;
  handed_over_by_role: string | null;

  received_by_name: string | null;
  received_by_role: string | null;

  asset_code_snapshot: string | null;
  category_name_snapshot: string | null;
  manufacturer_name_snapshot: string | null;
  model_name_snapshot: string | null;
  serial_number_snapshot: string | null;
}

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function safe(
  value: string | null | undefined
) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
}

function formatDate(
  value: string | null
) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("el-GR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Athens",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .trim();

  if (!normalized) {
    return ["-"];
  }

  const paragraphs = normalized.split("\n");
  const output: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      output.push("");
      continue;
    }

    const words = paragraph
      .trim()
      .split(/\s+/);

    let line = "";

    for (const word of words) {
      const candidate = line
        ? `${line} ${word}`
        : word;

      if (
        font.widthOfTextAtSize(
          candidate,
          size
        ) <= maxWidth
      ) {
        line = candidate;
        continue;
      }

      if (line) {
        output.push(line);
      }

      if (
        font.widthOfTextAtSize(
          word,
          size
        ) > maxWidth
      ) {
        let part = "";

        for (const char of word) {
          const test = part + char;

          if (
            font.widthOfTextAtSize(
              test,
              size
            ) > maxWidth &&
            part
          ) {
            output.push(part);
            part = char;
          } else {
            part = test;
          }
        }

        line = part;
      } else {
        line = word;
      }
    }

    if (line) {
      output.push(line);
    }
  }

  return output.length
    ? output
    : ["-"];
}

async function buildPdf(
  service: ServiceCaseRow,
  regularFontBytes: Uint8Array,
  boldFontBytes: Uint8Array
) {
  const pdf = await PDFDocument.create();

  pdf.registerFontkit(fontkit);

const regular =
  await pdf.embedFont(
    regularFontBytes,
    { subset: false }
  );

const bold =
  await pdf.embedFont(
    boldFontBytes,
    { subset: false }
  );

  pdf.setTitle(
    `Δελτίο Παράδοσης ${service.service_code}`
  );

  pdf.setSubject(
    "Δελτίο Παράδοσης Εξοπλισμού για Service"
  );

  pdf.setCreator(
    "ΔΑΠΑΧΟ Equipment Management"
  );

  pdf.setProducer(
    "ΔΑΠΑΧΟ Equipment Management"
  );

  let page = pdf.addPage([
    A4_WIDTH,
    A4_HEIGHT,
  ]);

  let y = TOP;

  function newPage() {
    page = pdf.addPage([
      A4_WIDTH,
      A4_HEIGHT,
    ]);

    y = TOP;

    page.drawText(
      `Δελτίο Παράδοσης - ${service.service_code}`,
      {
        x: MARGIN_X,
        y,
        size: 9,
        font: bold,
        color: rgb(
          0.35,
          0.35,
          0.35
        ),
      }
    );

    y -= 30;
  }

  function ensureSpace(
    needed: number
  ) {
    if (y - needed < BOTTOM) {
      newPage();
    }
  }

  function drawDivider() {
    page.drawLine({
      start: {
        x: MARGIN_X,
        y,
      },
      end: {
        x: A4_WIDTH - MARGIN_X,
        y,
      },
      thickness: 0.8,
      color: rgb(
        0.75,
        0.75,
        0.75
      ),
    });

    y -= 18;
  }

  function drawSection(
    title: string
  ) {
    ensureSpace(40);

    y -= 6;

    page.drawRectangle({
      x: MARGIN_X,
      y: y - 19,
      width:
        A4_WIDTH -
        MARGIN_X * 2,
      height: 25,
      color: rgb(
        0.94,
        0.94,
        0.94
      ),
    });

    page.drawText(title, {
      x: MARGIN_X + 8,
      y: y - 12,
      size: 10.5,
      font: bold,
      color: rgb(
        0.1,
        0.1,
        0.1
      ),
    });

    y -= 38;
  }

  function drawField(
    label: string,
    value:
      | string
      | null
      | undefined
  ) {
    const labelWidth = 155;

    const valueX =
      MARGIN_X +
      labelWidth;

    const maxValueWidth =
      A4_WIDTH -
      MARGIN_X -
      valueX;

    const lines = wrapText(
      safe(value),
      regular,
      10,
      maxValueWidth
    );

    const height =
      Math.max(
        20,
        lines.length * 15
      );

    ensureSpace(height + 5);

    page.drawText(label, {
      x: MARGIN_X,
      y,
      size: 10,
      font: bold,
      color: rgb(
        0.18,
        0.18,
        0.18
      ),
    });

    let lineY = y;

    for (const line of lines) {
      page.drawText(
        line || " ",
        {
          x: valueX,
          y: lineY,
          size: 10,
          font: regular,
          color: rgb(
            0.1,
            0.1,
            0.1
          ),
        }
      );

      lineY -= 15;
    }

    y -= height;
  }

  function drawLongText(
    value:
      | string
      | null
      | undefined
  ) {
    const lines = wrapText(
      safe(value),
      regular,
      10,
      A4_WIDTH -
        MARGIN_X * 2
    );

    for (const line of lines) {
      ensureSpace(17);

      page.drawText(
        line || " ",
        {
          x: MARGIN_X,
          y,
          size: 10,
          font: regular,
          color: rgb(
            0.1,
            0.1,
            0.1
          ),
        }
      );

      y -= 16;
    }

    y -= 6;
  }

  // HEADER

  page.drawText(
    "ΔΑΠΑΧΟ",
    {
      x: MARGIN_X,
      y,
      size: 20,
      font: bold,
      color: rgb(
        0.05,
        0.05,
        0.05
      ),
    }
  );

  y -= 30;

  page.drawText(
    "ΔΕΛΤΙΟ ΠΑΡΑΔΟΣΗΣ ΕΞΟΠΛΙΣΜΟΥ ΓΙΑ SERVICE",
    {
      x: MARGIN_X,
      y,
      size: 14,
      font: bold,
      color: rgb(
        0.05,
        0.05,
        0.05
      ),
    }
  );

  y -= 28;

  drawDivider();

  drawField(
    "Αριθμός Service:",
    service.service_code
  );

  drawField(
    "Ημερομηνία παράδοσης:",
    formatDate(
      service.sent_at
    )
  );

  // EQUIPMENT

  drawSection(
    "ΣΤΟΙΧΕΙΑ ΕΞΟΠΛΙΣΜΟΥ"
  );

  drawField(
    "Κωδικός εξοπλισμού:",
    service.asset_code_snapshot
  );

  drawField(
    "Κατηγορία:",
    service.category_name_snapshot
  );

  drawField(
    "Κατασκευαστής:",
    service.manufacturer_name_snapshot
  );

  drawField(
    "Μοντέλο:",
    service.model_name_snapshot
  );

  drawField(
    "Serial Number:",
    service.serial_number_snapshot
  );

  // ISSUE

  drawSection(
    "ΑΙΤΙΑ ΑΠΟΣΤΟΛΗΣ / ΠΕΡΙΓΡΑΦΗ ΒΛΑΒΗΣ"
  );

  drawLongText(
    service.issue_description
  );

  // HANDOVER

  drawSection(
    "ΠΑΡΑΔΟΣΗ ΑΠΟ ΔΑΠΑΧΟ"
  );

  drawField(
    "Ονοματεπώνυμο:",
    service.handed_over_by_name
  );

  drawField(
    "Ιδιότητα:",
    service.handed_over_by_role
  );

  // SERVICE RECEIVER

  drawSection(
    "ΠΑΡΑΛΑΒΗ ΑΠΟ SERVICE"
  );

  drawField(
    "Εταιρεία / Service:",
    service.service_company
  );

  drawField(
    "Ονοματεπώνυμο:",
    service.received_by_name
  );

  drawField(
    "Ιδιότητα:",
    service.received_by_role
  );

  // SIGNATURES

  ensureSpace(125);

  y -= 15;

  drawDivider();

  const signatureWidth = 205;

  const rightX =
    A4_WIDTH -
    MARGIN_X -
    signatureWidth;

  page.drawText(
    "Ο Παραδίδων",
    {
      x: MARGIN_X,
      y,
      size: 10,
      font: bold,
    }
  );

  page.drawText(
    "Ο Παραλαμβάνων",
    {
      x: rightX,
      y,
      size: 10,
      font: bold,
    }
  );

  y -= 55;

  page.drawLine({
    start: {
      x: MARGIN_X,
      y,
    },
    end: {
      x:
        MARGIN_X +
        signatureWidth,
      y,
    },
    thickness: 0.7,
    color: rgb(
      0.4,
      0.4,
      0.4
    ),
  });

  page.drawLine({
    start: {
      x: rightX,
      y,
    },
    end: {
      x:
        rightX +
        signatureWidth,
      y,
    },
    thickness: 0.7,
    color: rgb(
      0.4,
      0.4,
      0.4
    ),
  });

  y -= 15;

  page.drawText(
    safe(
      service.handed_over_by_name
    ),
    {
      x: MARGIN_X,
      y,
      size: 8.5,
      font: regular,
    }
  );

  page.drawText(
    safe(
      service.received_by_name
    ),
    {
      x: rightX,
      y,
      size: 8.5,
      font: regular,
    }
  );

  // FOOTER

  const pages =
    pdf.getPages();

  pages.forEach(
    (
      currentPage,
      index
    ) => {
      currentPage.drawLine({
        start: {
          x: MARGIN_X,
          y: 35,
        },
        end: {
          x:
            A4_WIDTH -
            MARGIN_X,
          y: 35,
        },
        thickness: 0.5,
        color: rgb(
          0.8,
          0.8,
          0.8
        ),
      });

      currentPage.drawText(
        `${service.service_code} | Σελίδα ${index + 1} από ${pages.length}`,
        {
          x: MARGIN_X,
          y: 20,
          size: 7.5,
          font: regular,
          color: rgb(
            0.45,
            0.45,
            0.45
          ),
        }
      );
    }
  );

  return await pdf.save();
}

export default {
  async fetch(
    req: Request
  ): Promise<Response> {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          error:
            "Method not allowed",
        },
        405
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    const anonKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !anonKey
    ) {
      console.error(
        "Missing Supabase environment variables"
      );

      return jsonResponse(
        {
          error:
            "Server configuration error",
        },
        500
      );
    }

    const authorization =
      req.headers.get(
        "Authorization"
      );

    if (
      !authorization?.startsWith(
        "Bearer "
      )
    ) {
      return jsonResponse(
        {
          error:
            "Authentication required",
        },
        401
      );
    }

    // Verify caller

    const userClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
          },
        }
      );

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await userClient
        .auth
        .getUser();

    if (
      userError ||
      !user
    ) {
      console.error(
        "Authentication error:",
        userError
      );

      return jsonResponse(
        {
          error:
            "Invalid authentication",
        },
        401
      );
    }

    // Service role client

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
          },
        }
      );

    // Check role

    const {
      data: profile,
      error: profileError,
    } =
      await admin
        .from("profiles")
        .select(
          "role, is_active"
        )
        .eq(
          "id",
          user.id
        )
        .single();

    if (
      profileError ||
      !profile ||
      !profile.is_active
    ) {
      console.error(
        "Profile error:",
        profileError
      );

      return jsonResponse(
        {
          error:
            "Inactive or invalid user",
        },
        403
      );
    }

    if (
      profile.role !==
        "OPERATOR" &&
      profile.role !==
        "ADMIN"
    ) {
      return jsonResponse(
        {
          error:
            "Only operators or administrators can generate service documents",
        },
        403
      );
    }

    // Read input

    let body: {
      service_case_id?: string;
    };

    try {
      body =
        await req.json();
    } catch {
      return jsonResponse(
        {
          error:
            "Invalid JSON body",
        },
        400
      );
    }

    const serviceCaseId =
      body
        .service_case_id
        ?.trim();

    if (!serviceCaseId) {
      return jsonResponse(
        {
          error:
            "service_case_id is required",
        },
        400
      );
    }

    // Load Service Case

    const {
      data: service,
      error: serviceError,
    } =
      await admin
        .from(
          "service_cases"
        )
        .select(`
          id,
          service_code,
          status,
          issue_description,
          sent_at,
          service_company,
          handed_over_by_name,
          handed_over_by_role,
          received_by_name,
          received_by_role,
          asset_code_snapshot,
          category_name_snapshot,
          manufacturer_name_snapshot,
          model_name_snapshot,
          serial_number_snapshot
        `)
        .eq(
          "id",
          serviceCaseId
        )
        .single();

    if (
      serviceError ||
      !service
    ) {
      console.error(
        "Service case error:",
        serviceError
      );

      return jsonResponse(
        {
          error:
            "Service case not found",
        },
        404
      );
    }

    const serviceRow =
      service as ServiceCaseRow;

    // Check existing generated handover

    const {
      data: existing,
      error: existingError,
    } =
      await admin
        .from(
          "service_case_documents"
        )
        .select(`
          id,
          storage_path,
          title
        `)
        .eq(
          "service_case_id",
          serviceCaseId
        )
        .eq(
          "document_type",
          "HANDOVER_FORM"
        )
        .eq(
          "document_source",
          "GENERATED"
        )
        .maybeSingle();

    if (existingError) {
      console.error(
        "Existing document lookup:",
        existingError
      );

      return jsonResponse(
        {
          error:
            "Could not check existing document",
        },
        500
      );
    }

    // If already generated, return it.

    if (existing) {
      const {
        data: signed,
        error: signedError,
      } =
        await admin
          .storage
          .from(BUCKET)
          .createSignedUrl(
            existing
              .storage_path,
            600
          );

      return jsonResponse({
        document_id:
          existing.id,
        already_exists:
          true,
        url:
          signedError
            ? null
            : signed
                ?.signedUrl ??
              null,
      });
    }

    // Download fonts

    const [
      regularResult,
      boldResult,
    ] =
      await Promise.all([
        admin.storage
          .from(BUCKET)
          .download(
            REGULAR_FONT_PATH
          ),

        admin.storage
          .from(BUCKET)
          .download(
            BOLD_FONT_PATH
          ),
      ]);

    if (
      regularResult.error ||
      boldResult.error ||
      !regularResult.data ||
      !boldResult.data
    ) {
      console.error(
        "Font download error:",
        {
          regular:
            regularResult.error,
          bold:
            boldResult.error,
        }
      );

      return jsonResponse(
        {
          error:
            "PDF fonts are missing from Storage",
        },
        500
      );
    }

    const regularFontBytes =
      new Uint8Array(
        await regularResult
          .data
          .arrayBuffer()
      );

    const boldFontBytes =
      new Uint8Array(
        await boldResult
          .data
          .arrayBuffer()
      );

    // Generate PDF

    let pdfBytes:
      Uint8Array;

    try {
      pdfBytes =
        await buildPdf(
          serviceRow,
          regularFontBytes,
          boldFontBytes
        );
    } catch (error) {
      console.error(
        "PDF generation error:",
        error
      );

      return jsonResponse(
        {
          error:
            "PDF generation failed",
        },
        500
      );
    }

    const storagePath =
      `generated/${serviceRow.service_code}/` +
      `${serviceRow.service_code}-handover.pdf`;

    // Upload PDF

    const {
      error: uploadError,
    } =
      await admin
        .storage
        .from(BUCKET)
        .upload(
          storagePath,
          pdfBytes,
          {
            contentType:
              "application/pdf",
            upsert: false,
          }
        );

    if (uploadError) {
      console.error(
        "Generated PDF upload error:",
        uploadError
      );

      return jsonResponse(
        {
          error:
            "PDF upload failed",
        },
        500
      );
    }

    // Register generated document

    const {
      data: documentRow,
      error: documentError,
    } =
      await admin
        .from(
          "service_case_documents"
        )
        .insert({
          service_case_id:
            serviceCaseId,

          document_type:
            "HANDOVER_FORM",

          title:
            "Δελτίο Παράδοσης Εξοπλισμού για Service",

          storage_path:
            storagePath,

          original_filename:
            `${serviceRow.service_code}-handover.pdf`,

          mime_type:
            "application/pdf",

          file_size:
            pdfBytes.byteLength,

          document_source:
            "GENERATED",

          created_by:
            user.id,
        })
        .select("id")
        .single();

    if (
      documentError ||
      !documentRow
    ) {
      console.error(
        "Generated document metadata error:",
        documentError
      );

      // Remove orphan PDF

      const {
        error: cleanupError,
      } =
        await admin
          .storage
          .from(BUCKET)
          .remove([
            storagePath,
          ]);

      if (cleanupError) {
        console.error(
          "Orphan PDF cleanup failed:",
          cleanupError
        );
      }

      return jsonResponse(
        {
          error:
            "PDF was generated but metadata registration failed",
        },
        500
      );
    }

    // Create temporary signed URL

    const {
      data: signed,
      error: signedError,
    } =
      await admin
        .storage
        .from(BUCKET)
        .createSignedUrl(
          storagePath,
          600
        );

    return jsonResponse(
      {
        document_id:
          documentRow.id,

        already_exists:
          false,

        url:
          signedError
            ? null
            : signed
                ?.signedUrl ??
              null,
      },
      201
    );
  },
};