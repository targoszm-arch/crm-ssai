import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "crm-ssai-mcp";
const SERVER_VERSION = "0.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type ToolHandler = (
  db: SupabaseClient,
  userId: string,
  args: Record<string, any>,
) => Promise<unknown>;

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
};

const scoped = (db: SupabaseClient, table: string, userId: string) =>
  db.from(table).select("*").eq("user_id", userId);

const jsonRpcResult = (id: unknown, result: unknown) =>
  new Response(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );

const jsonRpcError = (id: unknown, code: number, message: string, status = 200) =>
  new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );

const toolText = (value: unknown) => ({
  content: [
    {
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

const clampLimit = (n: unknown, fallback = 25, max = 200) => {
  const parsed = typeof n === "number" ? n : parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const TOOLS: ToolDef[] = [
  // ─── Leads ───────────────────────────────────────────────
  {
    name: "list_leads",
    description:
      "List leads in the CRM. Supports optional status filter, free-text search across name/email/company, and limit.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by lead status (e.g. new, qualified, disqualified)" },
        source: { type: "string", description: "Filter by lead source" },
        search: { type: "string", description: "Search across contact_name, company_name, email" },
        limit: { type: "number", description: "Max rows to return (default 25, max 200)" },
      },
    },
    handler: async (db, userId, args) => {
      let q = db.from("leads").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(clampLimit(args.limit));
      if (args.status) q = q.eq("status", args.status);
      if (args.source) q = q.eq("source", args.source);
      if (args.search) {
        const s = String(args.search).replace(/[%,]/g, "");
        q = q.or(
          `contact_name.ilike.%${s}%,company_name.ilike.%${s}%,email.ilike.%${s}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "get_lead",
    description: "Fetch a single lead by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db
        .from("leads").select("*")
        .eq("user_id", userId).eq("id", args.id).single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "create_lead",
    description: "Create a new lead.",
    inputSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        company_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        source: { type: "string" },
        status: { type: "string" },
        notes: { type: "string" },
        contact_id: { type: "string" },
        company_id: { type: "string" },
        qualification_score: { type: "number" },
      },
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("leads")
        .insert({ ...args, user_id: userId }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  // ─── Contacts (customers) ────────────────────────────────
  {
    name: "list_contacts",
    description:
      "List contacts (individual people / customers). Supports free-text search and company filter.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search first_name, last_name, email, title" },
        company_id: { type: "string" },
        limit: { type: "number" },
      },
    },
    handler: async (db, userId, args) => {
      let q = db.from("contacts").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(clampLimit(args.limit));
      if (args.company_id) q = q.eq("company_id", args.company_id);
      if (args.search) {
        const s = String(args.search).replace(/[%,]/g, "");
        q = q.or(
          `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,title.ilike.%${s}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "get_contact",
    description: "Fetch a single contact by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db
        .from("contacts").select("*")
        .eq("user_id", userId).eq("id", args.id).single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "create_contact",
    description: "Create a contact (person/customer).",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        title: { type: "string" },
        company_id: { type: "string" },
        linkedin_url: { type: "string" },
        notes: { type: "string" },
      },
      required: ["first_name"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("contacts")
        .insert({ ...args, user_id: userId }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "update_contact",
    description: "Update an existing contact.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        patch: { type: "object", description: "Object of fields to update" },
      },
      required: ["id", "patch"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("contacts")
        .update(args.patch).eq("user_id", userId).eq("id", args.id)
        .select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  // ─── Companies ───────────────────────────────────────────
  {
    name: "list_companies",
    description: "List companies. Supports search across company_name/domains/industry.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        industry: { type: "string" },
        limit: { type: "number" },
      },
    },
    handler: async (db, userId, args) => {
      let q = db.from("companies").select("*").eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(clampLimit(args.limit));
      if (args.industry) q = q.eq("industry", args.industry);
      if (args.search) {
        const s = String(args.search).replace(/[%,]/g, "");
        q = q.or(
          `company_name.ilike.%${s}%,domains.ilike.%${s}%,industry.ilike.%${s}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "get_company",
    description: "Fetch a single company by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("companies").select("*")
        .eq("user_id", userId).eq("id", args.id).single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "create_company",
    description: "Create a company.",
    inputSchema: {
      type: "object",
      properties: {
        company_name: { type: "string" },
        website: { type: "string" },
        domains: { type: "string" },
        industry: { type: "string" },
        country: { type: "string" },
        description: { type: "string" },
        size: { type: "string" },
        linkedin_url: { type: "string" },
        stage: { type: "string" },
      },
      required: ["company_name"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("companies")
        .insert({ ...args, user_id: userId }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "update_company",
    description: "Update an existing company.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        patch: { type: "object" },
      },
      required: ["id", "patch"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("companies")
        .update(args.patch).eq("user_id", userId).eq("id", args.id)
        .select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  // ─── Deals ───────────────────────────────────────────────
  {
    name: "list_deals",
    description: "List deals. Supports filters by stage, pipeline, contact, company.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string" },
        pipeline_id: { type: "string" },
        contact_id: { type: "string" },
        company_id: { type: "string" },
        search: { type: "string" },
        limit: { type: "number" },
      },
    },
    handler: async (db, userId, args) => {
      let q = db.from("deals").select("*").eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(clampLimit(args.limit));
      if (args.stage) q = q.eq("stage", args.stage);
      if (args.pipeline_id) q = q.eq("pipeline_id", args.pipeline_id);
      if (args.contact_id) q = q.eq("contact_id", args.contact_id);
      if (args.company_id) q = q.eq("company_id", args.company_id);
      if (args.search) {
        const s = String(args.search).replace(/[%,]/g, "");
        q = q.ilike("deal_name", `%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "create_deal",
    description: "Create a new deal.",
    inputSchema: {
      type: "object",
      properties: {
        deal_name: { type: "string" },
        deal_value: { type: "number" },
        stage: { type: "string" },
        pipeline_id: { type: "string" },
        contact_id: { type: "string" },
        company_id: { type: "string" },
        expected_close_date: { type: "string" },
        probability: { type: "number" },
        notes: { type: "string" },
      },
      required: ["deal_name"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("deals")
        .insert({ ...args, user_id: userId }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  // ─── Pipelines ───────────────────────────────────────────
  {
    name: "list_pipelines",
    description: "List all pipelines with their stages.",
    inputSchema: { type: "object", properties: {} },
    handler: async (db, userId) => {
      const { data: pipelines, error } = await db.from("pipelines")
        .select("*").eq("user_id", userId).order("created_at");
      if (error) throw new Error(error.message);
      const { data: stages } = await db.from("pipeline_stages")
        .select("*").eq("user_id", userId).order("position");
      const stagesByPipeline = new Map<string, unknown[]>();
      (stages ?? []).forEach((s: any) => {
        const arr = stagesByPipeline.get(s.pipeline_id) ?? [];
        arr.push(s);
        stagesByPipeline.set(s.pipeline_id, arr);
      });
      return (pipelines ?? []).map((p: any) => ({
        ...p,
        stages: stagesByPipeline.get(p.id) ?? [],
      }));
    },
  },
  {
    name: "create_pipeline",
    description:
      "Create a new deal pipeline. Optionally pass a `stages` array of {name, position, color?, is_won?, is_lost?} to seed pipeline stages in one call.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        is_default: { type: "boolean" },
        stages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              position: { type: "number" },
              color: { type: "string" },
              is_won: { type: "boolean" },
              is_lost: { type: "boolean" },
            },
            required: ["name", "position"],
          },
        },
      },
      required: ["name"],
    },
    handler: async (db, userId, args) => {
      const { data: pipeline, error } = await db.from("pipelines")
        .insert({
          name: args.name,
          is_default: args.is_default ?? false,
          user_id: userId,
        }).select().single();
      if (error) throw new Error(error.message);

      let stages: unknown[] = [];
      if (Array.isArray(args.stages) && args.stages.length) {
        const rows = args.stages.map((s: any) => ({ ...s, pipeline_id: pipeline.id, user_id: userId }));
        const { data, error: stErr } = await db.from("pipeline_stages")
          .insert(rows).select();
        if (stErr) throw new Error(stErr.message);
        stages = data ?? [];
      }
      return { ...pipeline, stages };
    },
  },
  {
    name: "create_pipeline_stage",
    description: "Add a stage to an existing pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { type: "string" },
        name: { type: "string" },
        position: { type: "number" },
        color: { type: "string" },
        is_won: { type: "boolean" },
        is_lost: { type: "boolean" },
      },
      required: ["pipeline_id", "name", "position"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("pipeline_stages")
        .insert({ ...args, user_id: userId }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  // ─── Email templates ─────────────────────────────────────
  {
    name: "list_email_templates",
    description: "List email templates (welcome emails, follow-ups, etc).",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string" },
        limit: { type: "number" },
      },
    },
    handler: async (db, userId, args) => {
      let q = db.from("email_templates").select("*").eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(clampLimit(args.limit, 50));
      if (args.category) q = q.eq("category", args.category);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "create_email_template",
    description:
      "Write a reusable email template. Merge tags: {{first_name}}, {{last_name}}, {{email}}, {{company}}.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Internal name, e.g. 'Welcome email'" },
        subject: { type: "string" },
        body_html: { type: "string", description: "HTML body of the email" },
        body_text: { type: "string" },
        category: { type: "string", description: "e.g. welcome, follow_up, nurture" },
        is_default: { type: "boolean" },
      },
      required: ["name"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("email_templates")
        .insert({ ...args, user_id: userId }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  // ─── Sequences & scheduling ──────────────────────────────
  {
    name: "list_sequences",
    description: "List email sequences.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string" }, limit: { type: "number" } },
    },
    handler: async (db, userId, args) => {
      let q = db.from("sequences").select("*").eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(clampLimit(args.limit, 50));
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "get_sequence",
    description: "Get a sequence including steps.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("sequences").select("*")
        .eq("user_id", userId).eq("id", args.id).single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "create_sequence",
    description:
      "Create an email sequence with ordered steps. Each step: { subject, body_html OR template_id, delay_days (offset from enrollment) }. For an immediate welcome email use one step with delay_days=0.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        trigger_type: { type: "string", description: "e.g. manual, on_contact_create, on_deal_stage" },
        status: { type: "string", description: "active or paused (default active)" },
        from_email: { type: "string" },
        from_name: { type: "string" },
        steps: {
          type: "array",
          description: "Ordered list of steps the sequence runs for each enrolled contact.",
          items: {
            type: "object",
            properties: {
              subject: { type: "string" },
              body_html: { type: "string" },
              template_id: { type: "string" },
              delay_days: { type: "number" },
              delay_hours: { type: "number" },
            },
          },
        },
      },
      required: ["name", "trigger_type", "steps"],
    },
    handler: async (db, userId, args) => {
      const { data, error } = await db.from("sequences").insert({
        name: args.name,
        description: args.description ?? null,
        trigger_type: args.trigger_type,
        status: args.status ?? "active",
        from_email: args.from_email ?? null,
        from_name: args.from_name ?? null,
        steps: args.steps,
        user_id: userId,
      }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "enroll_contact_in_sequence",
    description:
      "Schedule a sequence to run for a contact. `next_email_at` sets when the first step fires (defaults to now). Use this to schedule welcome emails or drip campaigns. Returns the enrollment row.",
    inputSchema: {
      type: "object",
      properties: {
        sequence_id: { type: "string" },
        contact_id: { type: "string" },
        next_email_at: {
          type: "string",
          description: "ISO-8601 timestamp for first send. Defaults to now.",
        },
      },
      required: ["sequence_id", "contact_id"],
    },
    handler: async (db, userId, args) => {
      const nextAt = args.next_email_at ?? new Date().toISOString();
      const { data, error } = await db.from("sequence_enrollments").insert({
        sequence_id: args.sequence_id,
        contact_id: args.contact_id,
        user_id: userId,
        current_step: 0,
        status: "active",
        enrolled_at: new Date().toISOString(),
        next_email_at: nextAt,
      }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "list_sequence_enrollments",
    description: "List sequence enrollments (who is scheduled for what, and when).",
    inputSchema: {
      type: "object",
      properties: {
        sequence_id: { type: "string" },
        contact_id: { type: "string" },
        status: { type: "string" },
        limit: { type: "number" },
      },
    },
    handler: async (db, userId, args) => {
      let q = db.from("sequence_enrollments")
        .select("*, sequences(name), contacts(first_name,last_name,email)")
        .eq("user_id", userId)
        .order("next_email_at", { ascending: true })
        .limit(clampLimit(args.limit, 50));
      if (args.sequence_id) q = q.eq("sequence_id", args.sequence_id);
      if (args.contact_id) q = q.eq("contact_id", args.contact_id);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "schedule_welcome_email",
    description:
      "Convenience tool: given a contact and an email (subject + HTML body), create a one-step 'welcome' sequence and enroll the contact so it is sent at `send_at` (defaults to now). Returns { sequence, enrollment }.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        subject: { type: "string" },
        body_html: { type: "string" },
        from_email: { type: "string" },
        from_name: { type: "string" },
        send_at: { type: "string", description: "ISO-8601 time to send. Defaults to now." },
        sequence_name: { type: "string", description: "Optional friendly name for the sequence." },
      },
      required: ["contact_id", "subject", "body_html"],
    },
    handler: async (db, userId, args) => {
      const seqName = args.sequence_name
        ?? `Welcome email · ${new Date().toISOString().slice(0, 10)}`;
      const { data: sequence, error: seqErr } = await db.from("sequences").insert({
        name: seqName,
        description: "Created via MCP schedule_welcome_email",
        trigger_type: "manual",
        status: "active",
        from_email: args.from_email ?? null,
        from_name: args.from_name ?? null,
        steps: [{
          subject: args.subject,
          body_html: args.body_html,
          delay_days: 0,
        }],
        user_id: userId,
      }).select().single();
      if (seqErr) throw new Error(seqErr.message);

      const nextAt = args.send_at ?? new Date().toISOString();
      const { data: enrollment, error: enrErr } = await db.from("sequence_enrollments")
        .insert({
          sequence_id: sequence.id,
          contact_id: args.contact_id,
          user_id: userId,
          current_step: 0,
          status: "active",
          enrolled_at: new Date().toISOString(),
          next_email_at: nextAt,
        }).select().single();
      if (enrErr) throw new Error(enrErr.message);

      return { sequence, enrollment };
    },
  },
];

const toolsListing = TOOLS.map(({ name, description, inputSchema }) => ({
  name,
  description,
  inputSchema,
}));

async function authenticate(req: Request): Promise<{ userId: string; db: SupabaseClient } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonRpcError(null, -32001, "Unauthorized: missing Authorization header", 401);
  }
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) {
    return jsonRpcError(null, -32001, "Unauthorized: invalid token", 401);
  }
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  return { userId: user.id, db };
}

async function handleRpc(
  rpc: JsonRpcRequest,
  db: SupabaseClient,
  userId: string,
): Promise<Response> {
  const { id, method, params } = rpc;

  // Notifications: no response body
  if (id === undefined || id === null) {
    return new Response(null, { status: 202, headers: corsHeaders });
  }

  try {
    switch (method) {
      case "initialize":
        return jsonRpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        });

      case "ping":
        return jsonRpcResult(id, {});

      case "tools/list":
        return jsonRpcResult(id, { tools: toolsListing });

      case "tools/call": {
        const name = (params?.name as string) ?? "";
        const args = (params?.arguments as Record<string, any>) ?? {};
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) {
          return jsonRpcResult(id, {
            isError: true,
            ...toolText(`Unknown tool: ${name}`),
          });
        }
        try {
          const result = await tool.handler(db, userId, args);
          return jsonRpcResult(id, toolText(result));
        } catch (e) {
          return jsonRpcResult(id, {
            isError: true,
            ...toolText(`Tool '${name}' failed: ${(e as Error).message}`),
          });
        }
      }

      case "resources/list":
        return jsonRpcResult(id, { resources: [] });

      case "prompts/list":
        return jsonRpcResult(id, { prompts: [] });

      default:
        return jsonRpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return jsonRpcError(id, -32603, `Internal error: ${(e as Error).message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        server: SERVER_NAME,
        version: SERVER_VERSION,
        protocol: PROTOCOL_VERSION,
        transport: "streamable-http (JSON-RPC 2.0 over POST)",
        tools: toolsListing.map((t) => t.name),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { db, userId } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error: invalid JSON", 400);
  }

  // Batched requests
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map(async (rpc) => {
        const r = await handleRpc(rpc as JsonRpcRequest, db, userId);
        if (r.status === 202) return null;
        return await r.json();
      }),
    );
    const filtered = responses.filter((r) => r !== null);
    return new Response(JSON.stringify(filtered), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return handleRpc(body as JsonRpcRequest, db, userId);
});
