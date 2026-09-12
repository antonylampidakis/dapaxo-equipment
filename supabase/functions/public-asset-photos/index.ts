import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405
    );
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "Missing Supabase environment variables."
      );

      return jsonResponse(
        { error: "Server configuration error." },
        500
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    let body: {
      token?: string;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid request body." },
        400
      );
    }

    const token =
      typeof body.token === "string"
        ? body.token.trim()
        : "";

    if (!token) {
      return jsonResponse(
        { error: "QR token is required." },
        400
      );
    }

    /*
     * Βρίσκουμε το Asset αποκλειστικά
     * μέσω του public QR token.
     */
    const {
      data: asset,
      error: assetError,
    } = await adminClient
      .from("assets")
      .select("id")
      .eq("qr_token", token)
      .maybeSingle();

    if (assetError) {
      console.error(
        "Asset lookup error:",
        assetError
      );

      return jsonResponse(
        { error: "Unable to retrieve asset." },
        500
      );
    }

    if (!asset) {
      return jsonResponse(
        { error: "Asset not found." },
        404
      );
    }

    /*
     * Φορτώνουμε ΜΟΝΟ τις φωτογραφίες
     * που ανήκουν στο συγκεκριμένο Asset.
     */
    const {
      data: photos,
      error: photosError,
    } = await adminClient
      .from("asset_photos")
      .select(`
        id,
        storage_path,
        is_primary,
        sort_order,
        created_at
      `)
      .eq("asset_id", asset.id)
      .order("is_primary", {
        ascending: false,
      })
      .order("sort_order", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      });

    if (photosError) {
      console.error(
        "Photo lookup error:",
        photosError
      );

      return jsonResponse(
        { error: "Unable to retrieve photos." },
        500
      );
    }

    if (!photos || photos.length === 0) {
      return jsonResponse({
        photos: [],
      });
    }

    /*
     * Δημιουργούμε προσωρινό signed URL
     * για κάθε private φωτογραφία.
     *
     * 3600 sec = 1 ώρα.
     */
    const result = await Promise.all(
      photos.map(async (photo) => {
        const {
          data: signedData,
          error: signedError,
        } = await adminClient.storage
          .from("asset-photos")
          .createSignedUrl(
            photo.storage_path,
            3600
          );

        if (signedError) {
          console.error(
            `Signed URL error for ${photo.id}:`,
            signedError
          );

          return null;
        }

        return {
          id: photo.id,
          url: signedData.signedUrl,
          is_primary: photo.is_primary,
          sort_order: photo.sort_order,
        };
      })
    );

    return jsonResponse({
      photos: result.filter(
        (photo) => photo !== null
      ),
    });
  } catch (error) {
    console.error(
      "Unexpected public asset photos error:",
      error
    );

    return jsonResponse(
      { error: "Unexpected server error." },
      500
    );
  }
});