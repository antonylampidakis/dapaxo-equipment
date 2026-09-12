import express from "express";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3100);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = "service-documents";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const app = express();

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );

    res.setHeader(
      "Vary",
      "Origin"
    );
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "2mb" }));


/* =========================================================
   AUTHORIZATION
   ========================================================= */

async function requireOperatorOrAdmin(
  req,
  res,
  next
) {
  try {
    const authorization =
      req.get("authorization");

    if (
      !authorization ||
      !authorization
        .toLowerCase()
        .startsWith("bearer ")
    ) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token =
      authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error(
        "PDF service authentication failed:",
        userError
      );

      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(
        "PDF service profile lookup failed:",
        profileError
      );

      return res.status(403).json({
        error: "User profile not available",
      });
    }

    if (!profile.is_active) {
      return res.status(403).json({
        error: "User account is inactive",
      });
    }

    if (
      profile.role !== "OPERATOR" &&
      profile.role !== "ADMIN"
    ) {
      return res.status(403).json({
        error: "Insufficient permissions",
      });
    }

    req.authUser = {
      id: user.id,
      role: profile.role,
    };

    next();
  } catch (error) {
    console.error(
      "PDF service authorization failed:",
      error
    );

    return res.status(500).json({
      error: "Authorization check failed",
    });
  }
}


/* =========================================================
   COMMON HELPERS
   ========================================================= */

function escapeHtml(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatGreekDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat(
    "el-GR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Athens",
    }
  ).format(date);
}


function technicalStatusGreek(status) {
  const labels = {
    FUNCTIONAL:
      "Λειτουργικό",

    HAS_ISSUE:
      "Παρουσιάζει πρόβλημα",

    UNDER_REPAIR:
      "Σε επισκευή",

    OUT_OF_SERVICE:
      "Εκτός λειτουργίας",
  };

  return (
    labels[status] ??
    status ??
    "—"
  );
}


function formatCost(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return escapeHtml(value);
  }

  return new Intl.NumberFormat(
    "el-GR",
    {
      style: "currency",
      currency: "EUR",
    }
  ).format(amount);
}


/* =========================================================
   TEMPLATE LOADERS
   ========================================================= */

async function loadHandoverTemplate() {
  return fs.readFile(
    path.join(
      __dirname,
      "templates",
      "service-handover.html"
    ),
    "utf8"
  );
}


async function loadReturnTemplate() {
  return fs.readFile(
    path.join(
      __dirname,
      "templates",
      "service-return.html"
    ),
    "utf8"
  );
}


/* =========================================================
   TEMPLATE HELPERS
   ========================================================= */

function replaceTemplateValues(
  template,
  replacements
) {
  let html = template;

  for (
    const [key, value]
    of Object.entries(replacements)
  ) {
    html = html.replaceAll(
      key,
      value
    );
  }

  return html;
}


/* =========================================================
   HANDOVER TEMPLATE
   ========================================================= */

function fillHandoverTemplate(
  template,
  service
) {
  return replaceTemplateValues(
    template,
    {
      "{{SERVICE_CODE}}":
        escapeHtml(
          service.service_code
        ),

      "{{SENT_AT}}":
        formatGreekDate(
          service.sent_at
        ),

      "{{ASSET_CODE}}":
        escapeHtml(
          service.asset_code_snapshot
        ),

      "{{CATEGORY}}":
        escapeHtml(
          service.category_name_snapshot
        ),

      "{{MANUFACTURER}}":
        escapeHtml(
          service.manufacturer_name_snapshot
        ),

      "{{MODEL}}":
        escapeHtml(
          service.model_name_snapshot
        ),

      "{{SERIAL_NUMBER}}":
        escapeHtml(
          service.serial_number_snapshot
        ),

      "{{ISSUE_DESCRIPTION}}":
        escapeHtml(
          service.issue_description
        ),

      "{{HANDED_OVER_BY_NAME}}":
        escapeHtml(
          service.handed_over_by_name
        ),

      "{{HANDED_OVER_BY_ROLE}}":
        escapeHtml(
          service.handed_over_by_role
        ),

      "{{SERVICE_COMPANY}}":
        escapeHtml(
          service.service_company
        ),

      "{{RECEIVED_BY_NAME}}":
        escapeHtml(
          service.received_by_name
        ),

      "{{RECEIVED_BY_ROLE}}":
        escapeHtml(
          service.received_by_role
        ),
    }
  );
}


/* =========================================================
   RETURN TEMPLATE
   ========================================================= */

function fillReturnTemplate(
  template,
  service
) {
  return replaceTemplateValues(
    template,
    {
      "{{SERVICE_CODE}}":
        escapeHtml(
          service.service_code
        ),

      "{{RETURNED_AT}}":
        formatGreekDate(
          service.returned_at
        ),

      "{{ASSET_CODE}}":
        escapeHtml(
          service.asset_code_snapshot
        ),

      "{{CATEGORY_NAME}}":
        escapeHtml(
          service.category_name_snapshot
        ),

      "{{MANUFACTURER_NAME}}":
        escapeHtml(
          service.manufacturer_name_snapshot
        ),

      "{{MODEL_NAME}}":
        escapeHtml(
          service.model_name_snapshot
        ),

      "{{SERIAL_NUMBER}}":
        escapeHtml(
          service.serial_number_snapshot
        ),

      "{{ISSUE_DESCRIPTION}}":
        escapeHtml(
          service.issue_description
        ),

      "{{WORK_PERFORMED}}":
        escapeHtml(
          service.work_performed
        ),

      "{{FINAL_TECHNICAL_STATUS}}":
        escapeHtml(
          technicalStatusGreek(
            service.final_technical_status
          )
        ),

      "{{COST}}":
        escapeHtml(
          formatCost(
            service.cost
          )
        ),

      "{{RETURN_NOTES}}":
        escapeHtml(
          service.return_notes
        ),

      "{{RETURNED_BY_NAME}}":
        escapeHtml(
          service.returned_by_name
        ),

      "{{RETURNED_BY_ROLE}}":
        escapeHtml(
          service.returned_by_role
        ),

      "{{ACCEPTED_BY_NAME}}":
        escapeHtml(
          service.accepted_by_name
        ),

      "{{ACCEPTED_BY_ROLE}}":
        escapeHtml(
          service.accepted_by_role
        ),
    }
  );
}


/* =========================================================
   CHROMIUM PDF RENDERER
   ========================================================= */

async function renderPdf(html) {
  const browser =
    await chromium.launch({
      headless: true,
    });

  try {
    const page =
      await browser.newPage();

    await page.setContent(
      html,
      {
        waitUntil: "networkidle",
      }
    );

    await page.emulateMedia({
      media: "print",
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,

      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
  } finally {
    await browser.close();
  }
}


async function generateHandoverPdf(
  service
) {
  const template =
    await loadHandoverTemplate();

  const html =
    fillHandoverTemplate(
      template,
      service
    );

  return renderPdf(html);
}


async function generateReturnPdf(
  service
) {
  const template =
    await loadReturnTemplate();

  const html =
    fillReturnTemplate(
      template,
      service
    );

  return renderPdf(html);
}


/* =========================================================
   SIGNED URL HELPER
   ========================================================= */

async function createSignedDocumentUrl(
  storagePath
) {
  const {
    data,
    error,
  } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      storagePath,
      600
    );

  if (
    error ||
    !data?.signedUrl
  ) {
    throw (
      error ??
      new Error(
        "Signed URL was not returned"
      )
    );
  }

  return data.signedUrl;
}


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  "/health",
  (_req, res) => {
    res.json({
      status: "ok",
      service:
        "dapaxo-pdf-service",
      supabase:
        "configured",
    });
  }
);


/* =========================================================
   GENERATE SERVICE HANDOVER
   ========================================================= */

app.post(
  "/generate/service-handover",
  requireOperatorOrAdmin,
  async (req, res) => {
    try {
      const serviceCaseId =
        req.body
          ?.service_case_id
          ?.trim();

      if (!serviceCaseId) {
        return res
          .status(400)
          .json({
            error:
              "service_case_id is required",
          });
      }

      console.log(
        `Generating handover for ${serviceCaseId}`
      );

      const {
        data: service,
        error: serviceError,
      } = await supabase
        .from("service_cases")
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
          "Service case lookup failed:",
          serviceError
        );

        return res
          .status(404)
          .json({
            error:
              "Service case not found",
          });
      }

      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from(
          "service_case_documents"
        )
        .select(
          "id, storage_path, title"
        )
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
          "Existing document lookup failed:",
          existingError
        );

        return res
          .status(500)
          .json({
            error:
              "Could not check existing document",
          });
      }

      if (existing) {
        const url =
          await createSignedDocumentUrl(
            existing.storage_path
          );

        return res.json({
          document_id:
            existing.id,

          already_exists:
            true,

          service_code:
            service.service_code,

          storage_path:
            existing.storage_path,

          url,
        });
      }

      const pdf =
        await generateHandoverPdf(
          service
        );

      const filename =
        `${service.service_code}-handover.pdf`;

      const storagePath =
        `generated/${service.service_code}/${filename}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from(BUCKET)
        .upload(
          storagePath,
          pdf,
          {
            contentType:
              "application/pdf",

            upsert:
              false,
          }
        );

      if (uploadError) {
        console.error(
          "Storage upload failed:",
          uploadError
        );

        return res
          .status(500)
          .json({
            error:
              "PDF upload failed",

            details:
              uploadError.message,
          });
      }

      const {
        data: document,
        error: documentError,
      } = await supabase
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
            filename,

          mime_type:
            "application/pdf",

          file_size:
            pdf.length,

          document_source:
            "GENERATED",

          created_by:
            req.authUser.id,
        })
        .select("id")
        .single();

      if (
        documentError ||
        !document
      ) {
        console.error(
          "Document metadata insert failed:",
          documentError
        );

        const {
          error: cleanupError,
        } = await supabase.storage
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

        return res
          .status(500)
          .json({
            error:
              "PDF generated but metadata registration failed",

            details:
              documentError
                ?.message ??
              null,
          });
      }

      let url = null;

      try {
        url =
          await createSignedDocumentUrl(
            storagePath
          );
      } catch (signedError) {
        console.error(
          "Signed URL generation failed:",
          signedError
        );
      }

      console.log(
        `Created ${service.service_code}: ${storagePath}`
      );

      return res
        .status(201)
        .json({
          document_id:
            document.id,

          already_exists:
            false,

          service_code:
            service.service_code,

          storage_path:
            storagePath,

          url,
        });
    } catch (error) {
      console.error(
        "Service handover generation failed:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Service handover generation failed",

          details:
            error instanceof Error
              ? error.message
              : String(error),
        });
    }
  }
);


/* =========================================================
   GENERATE SERVICE RETURN
   ========================================================= */

app.post(
  "/generate/service-return",
  requireOperatorOrAdmin,
  async (req, res) => {
    try {
      const serviceCaseId =
        req.body
          ?.service_case_id
          ?.trim();

      if (!serviceCaseId) {
        return res
          .status(400)
          .json({
            error:
              "service_case_id is required",
          });
      }

      console.log(
        `Generating return form for ${serviceCaseId}`
      );

      const {
        data: service,
        error: serviceError,
      } = await supabase
        .from("service_cases")
        .select(`
          id,
          service_code,
          status,
          issue_description,
          returned_at,
          work_performed,
          cost,
          final_technical_status,
          return_notes,
          returned_by_name,
          returned_by_role,
          accepted_by_name,
          accepted_by_role,
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
          "Service case lookup failed:",
          serviceError
        );

        return res
          .status(404)
          .json({
            error:
              "Service case not found",
          });
      }

      if (
        service.status !==
        "RETURNED"
      ) {
        return res
          .status(409)
          .json({
            error:
              "Return form can only be generated for a returned service case",
          });
      }

      if (!service.returned_at) {
        return res
          .status(409)
          .json({
            error:
              "Service case does not have a return date",
          });
      }

      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from(
          "service_case_documents"
        )
        .select(
          "id, storage_path, title"
        )
        .eq(
          "service_case_id",
          serviceCaseId
        )
        .eq(
          "document_type",
          "RETURN_FORM"
        )
        .eq(
          "document_source",
          "GENERATED"
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Existing return document lookup failed:",
          existingError
        );

        return res
          .status(500)
          .json({
            error:
              "Could not check existing return document",
          });
      }

      if (existing) {
        const url =
          await createSignedDocumentUrl(
            existing.storage_path
          );

        return res.json({
          document_id:
            existing.id,

          already_exists:
            true,

          service_code:
            service.service_code,

          storage_path:
            existing.storage_path,

          url,
        });
      }

      const pdf =
        await generateReturnPdf(
          service
        );

      const filename =
        `${service.service_code}-return.pdf`;

      const storagePath =
        `generated/${service.service_code}/${filename}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from(BUCKET)
        .upload(
          storagePath,
          pdf,
          {
            contentType:
              "application/pdf",

            upsert:
              false,
          }
        );

      if (uploadError) {
        console.error(
          "Return PDF upload failed:",
          uploadError
        );

        return res
          .status(500)
          .json({
            error:
              "Return PDF upload failed",

            details:
              uploadError.message,
          });
      }

      const {
        data: document,
        error: documentError,
      } = await supabase
        .from(
          "service_case_documents"
        )
        .insert({
          service_case_id:
            serviceCaseId,

          document_type:
            "RETURN_FORM",

          title:
            "Δελτίο Παραλαβής Εξοπλισμού από Service",

          storage_path:
            storagePath,

          original_filename:
            filename,

          mime_type:
            "application/pdf",

          file_size:
            pdf.length,

          document_source:
            "GENERATED",

          created_by:
            req.authUser.id,
        })
        .select("id")
        .single();

      if (
        documentError ||
        !document
      ) {
        console.error(
          "Return document metadata insert failed:",
          documentError
        );

        const {
          error: cleanupError,
        } = await supabase.storage
          .from(BUCKET)
          .remove([
            storagePath,
          ]);

        if (cleanupError) {
          console.error(
            "Orphan return PDF cleanup failed:",
            cleanupError
          );
        }

        return res
          .status(500)
          .json({
            error:
              "Return PDF generated but metadata registration failed",

            details:
              documentError
                ?.message ??
              null,
          });
      }

      let url = null;

      try {
        url =
          await createSignedDocumentUrl(
            storagePath
          );
      } catch (signedError) {
        console.error(
          "Return signed URL generation failed:",
          signedError
        );
      }

      console.log(
        `Created return form ${service.service_code}: ${storagePath}`
      );

      return res
        .status(201)
        .json({
          document_id:
            document.id,

          already_exists:
            false,

          service_code:
            service.service_code,

          storage_path:
            storagePath,

          url,
        });
    } catch (error) {
      console.error(
        "Service return generation failed:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Service return generation failed",

          details:
            error instanceof Error
              ? error.message
              : String(error),
        });
    }
  }
);


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log(
    "ΔΑΠΑΧΟ PDF Service"
  );
  console.log(
    `http://localhost:${PORT}`
  );
  console.log(
    `Health: http://localhost:${PORT}/health`
  );
  console.log("");
});