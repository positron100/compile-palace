// Supabase Edge Function — the only place JDOODLE_CLIENT_ID/SECRET are ever
// read. Deployed with `supabase functions deploy execute-jdoodle`; secrets
// set with:
//   supabase secrets set JDOODLE_CLIENT_ID=xxx JDOODLE_CLIENT_SECRET=xxx
// Never logged, never included in the response body, never sent to the
// frontend in any form — this function is a thin proxy: receive
// script/language/versionIndex/stdin from the (already-authenticated, via
// the Supabase client) frontend, attach the credentials server-side, call
// JDoodle, relay back only the execution result fields.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JDoodleRequestBody {
  script: string;
  language: string;
  versionIndex: string;
  stdin?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("JDOODLE_CLIENT_ID");
    const clientSecret = Deno.env.get("JDOODLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "JDoodle credentials are not configured on the server." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { script, language, versionIndex, stdin }: JDoodleRequestBody = await req.json();
    if (!script || !language || versionIndex === undefined) {
      return new Response(
        JSON.stringify({ error: "script, language and versionIndex are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jdoodleResponse = await fetch("https://api.jdoodle.com/v1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientSecret,
        script,
        language,
        versionIndex,
        stdin: stdin ?? "",
      }),
    });

    const result = await jdoodleResponse.json();
    if (!jdoodleResponse.ok) {
      // Relay JDoodle's own error (e.g. quota exceeded, bad credentials) —
      // but the credentials themselves were never part of `result`.
      return new Response(
        JSON.stringify({ error: result?.error ?? `JDoodle responded with status ${jdoodleResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        output: result.output,
        statusCode: result.statusCode,
        memory: result.memory,
        cpuTime: result.cpuTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
