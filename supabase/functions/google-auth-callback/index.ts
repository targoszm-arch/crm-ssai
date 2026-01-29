import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AuthRequest {
  code: string;
  redirectUri: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    if (!googleClientId || !googleClientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { code, redirectUri }: AuthRequest = await req.json();

    if (!code || !redirectUri) {
      throw new Error("code and redirectUri are required");
    }

    console.log("Exchanging code for tokens...");

    // Exchange auth code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange error:", errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    console.log("Tokens received successfully");

    // Get user info from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to get user info");
    }

    const userInfo = await userInfoResponse.json();
    console.log(`User email: ${userInfo.email}`);

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store or update email account (using a placeholder user_id for now)
    const userId = "00000000-0000-0000-0000-000000000001"; // Placeholder until auth is implemented

    const { data: existingAccount } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("email_address", userInfo.email)
      .single();

    if (existingAccount) {
      // Update existing account
      const { error: updateError } = await supabase
        .from("email_accounts")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
        })
        .eq("id", existingAccount.id);

      if (updateError) {
        throw new Error(`Failed to update account: ${updateError.message}`);
      }
    } else {
      // Create new account
      const { error: insertError } = await supabase
        .from("email_accounts")
        .insert({
          user_id: userId,
          provider: "google",
          email_address: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
        });

      if (insertError) {
        throw new Error(`Failed to create account: ${insertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: userInfo.email,
        name: userInfo.name,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in Google auth callback:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
