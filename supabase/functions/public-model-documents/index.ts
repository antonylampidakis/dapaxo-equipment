import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = await req.json().catch(() => null);
    const token =
      typeof body?.token === "string"
        ? body.token.trim().toLowerCase()
        : "";

    // Τα qr_token των assets είναι 48-character hex strings.
    if (!/^[a-f0-9]{48}$/.test(token)) {
      return new Response(
        JSON.stringify({
          error: "Invalid QR token",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Βρίσκουμε μόνο το equipment_model_id.
    // Δεν επιστρέφουμε εσωτερικά στοιχεία του asset.
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("equipment_model_id")
      .eq("qr_token", token)
      .maybeSingle();

    if (assetError) {
      console.error("Asset lookup error:", assetError);
      throw new Error("Asset lookup failed");
    }

    if (!asset) {
      return new Response(
        JSON.stringify({
          error: "Asset not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!asset.equipment_model_id) {
      return new Response(JSON.stringify({ documents: [] }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Μόνο PUBLIC documents.
    const { data: documents, error: documentsError } = await supabase
      .from("equipment_model_documents")
      .select(`
        id,
        document_type,
        title,
        storage_path,
        original_filename,
        file_size,
        created_at
      `)
      .eq("equipment_model_id", asset.equipment_model_id)
      .eq("is_public", true)
      .order("created_at", { ascending: true });

    if (documentsError) {
      console.error("Documents lookup error:", documentsError);
      throw new Error("Documents lookup failed");
    }

    const publicDocuments = [];

    for (const document of documents ?? []) {
      const { data: signedData, error: signedError } =
        await supabase.storage
          .from("model-documents")
          .createSignedUrl(document.storage_path, 60 * 10);

      if (signedError || !signedData?.signedUrl) {
        console.error(
          "Signed URL error for document:",
          document.id,
          signedError
        );

        // Αν ένα αρχείο έχει πρόβλημα, δεν χαλάμε ολόκληρη τη σελίδα.
        continue;
      }

      publicDocuments.push({
        id: document.id,
        document_type: document.document_type,
        title: document.title,
        original_filename: document.original_filename,
        file_size: document.file_size,
        created_at: document.created_at,
        url: signedData.signedUrl,
      });
    }

    return new Response(
      JSON.stringify({
        documents: publicDocuments,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("public-model-documents error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});