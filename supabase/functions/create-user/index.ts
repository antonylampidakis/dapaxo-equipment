import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed.",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Missing Supabase server configuration."
      );
    }

    const authHeader =
      req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const token = authHeader.replace(
      /^Bearer\s+/i,
      ""
    );

    const {
      data: { user: caller },
      error: callerError,
    } = await adminClient.auth.getUser(token);

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({
          error: "Invalid session.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const {
      data: callerProfile,
      error: profileError,
    } = await adminClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", caller.id)
      .single();

    if (
      profileError ||
      !callerProfile ||
      !callerProfile.is_active ||
      callerProfile.role !== "ADMIN"
    ) {
      return new Response(
        JSON.stringify({
          error: "Permission denied.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const fullName =
      typeof body.full_name === "string"
        ? body.full_name.trim()
        : "";

    const role =
      typeof body.role === "string"
        ? body.role
        : "VIEWER";

    if (!email) {
      return new Response(
        JSON.stringify({
          error: "Το email είναι υποχρεωτικό.",
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

    if (password.length < 8) {
      return new Response(
        JSON.stringify({
          error:
            "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.",
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

    if (!fullName) {
      return new Response(
        JSON.stringify({
          error:
            "Το ονοματεπώνυμο είναι υποχρεωτικό.",
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

    if (
      !["VIEWER", "OPERATOR", "ADMIN"].includes(
        role
      )
    ) {
      return new Response(
        JSON.stringify({
          error: "Μη έγκυρος ρόλος.",
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

    const {
      data: created,
      error: createError,
    } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (createError || !created.user) {
      return new Response(
        JSON.stringify({
          error:
            createError?.message ??
            "Δεν ήταν δυνατή η δημιουργία του χρήστη.",
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

    const { error: updateError } =
      await adminClient
        .from("profiles")
        .update({
          full_name: fullName,
          role,
          is_active: true,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", created.user.id);

    if (updateError) {
      await adminClient.auth.admin.deleteUser(
        created.user.id
      );

      throw new Error(
        "Ο λογαριασμός δημιουργήθηκε αλλά απέτυχε η δημιουργία του προφίλ."
      );
    }

    const { error: auditError } =
  await adminClient
    .from("audit_log")
    .insert({
      user_id: caller.id,
      action: "USER_CREATED",
      entity_type: "USER",
      entity_id: created.user.id,
      entity_code: fullName,
      description: `Δημιουργία χρήστη ${fullName} με ρόλο ${role}.`,
      old_data: null,
      new_data: {
        full_name: fullName,
        role,
        is_active: true,
      },
    });

if (auditError) {
  console.error(
    "USER_CREATED audit error:",
    auditError
  );
}

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: created.user.id,
          email: created.user.email,
          full_name: fullName,
          role,
        },
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
    console.error(error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
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