import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LMSCustomer {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  company_size?: string;
  use_case?: string;
  learning_objectives?: string;
  marketing_consent?: boolean;
  verified?: boolean;
  created_at?: string;
  credits_used?: number;
  credits_total?: number;
  plan?: string;
  signup_type?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get CRM API key from secrets
    const crmApiKey = Deno.env.get('CRM_WEBHOOK_API_KEY');
    if (!crmApiKey) {
      console.error('CRM_WEBHOOK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'External API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const since = url.searchParams.get('since');
    const signupType = url.searchParams.get('signup_type');
    const marketing = url.searchParams.get('marketing');
    const limit = url.searchParams.get('limit') || '100';
    const offset = url.searchParams.get('offset') || '0';

    // Build external API URL with query params
    const externalUrl = new URL('https://tozhflrmsjjgzfgqchaq.supabase.co/functions/v1/crm-customers');
    if (since) externalUrl.searchParams.set('since', since);
    if (signupType) externalUrl.searchParams.set('signup_type', signupType);
    if (marketing) externalUrl.searchParams.set('marketing', marketing);
    externalUrl.searchParams.set('limit', limit);
    externalUrl.searchParams.set('offset', offset);

    console.log('Fetching from external LMS endpoint:', externalUrl.toString());

    // Fetch from external endpoint
    const response = await fetch(externalUrl.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': crmApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('External API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch from external API',
          status: response.status,
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Fetched', Array.isArray(data) ? data.length : 'unknown', 'customers from external API');

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-lms-customers:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
