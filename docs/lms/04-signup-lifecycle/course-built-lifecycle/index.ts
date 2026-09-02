// course-built-lifecycle — the feedback loop.
//
// Without this, the machine cannot tell someone who built a 160-module course from
// someone who logged in once, and every email degrades to generic. That is the current
// failure, and this is the fix: the moment a course exists, the person who made it stops
// being `lifecycle = signup` and becomes `lifecycle = builder`, carrying the title, the
// size of what they built, and the subject cluster that routes their proof link.
//
// FIRED BY two triggers (01-course-built-triggers.sql):
//   - AFTER INSERT ON courses                    — a course now exists
//   - AFTER UPDATE ON course_generation_jobs     — WHEN status becomes 'completed'
//
// INSERT ONLY on courses, deliberately. An AFTER UPDATE trigger there would fire on every
// title tweak, theme change and autosave across 726 rows and hammer the Resend API for
// nothing. The generation-job trigger is what catches the interesting second event: at
// insert a course has no modules and no videos yet, so the counts are 0 and only the
// title is worth having. When generation completes, the counts are real.
//
// Because both events land here, this function is idempotent by construction: it reads
// the current counts and PATCHes them. Running it twice writes the same values twice.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  classifyTopicCluster,
  isExcluded,
  updateContactProperties,
} from "../signup-lifecycle/lifecycle.ts";

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown> | null;
}

/**
 * Resolve which course this event is about, from either trigger.
 *
 * A generation job carries course_id and nothing else useful; a course row is itself the
 * answer. Either way the rest of the function only needs a course id.
 */
function courseIdFrom(payload: WebhookPayload): string | null {
  const record = payload.record ?? {};
  if (payload.table === "courses") return (record.id as string) || null;
  if (payload.table === "course_generation_jobs") return (record.course_id as string) || null;
  // Fall back to whichever is present, so a hand-fired call for testing still works.
  return (record.course_id as string) || (record.id as string) || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const expected = Deno.env.get("WEBHOOK_SECRET");
  if (!expected) return new Response("not configured", { status: 500 });
  if (req.headers.get("x-webhook-secret") !== expected) {
    return new Response("forbidden", { status: 403 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const courseId = courseIdFrom(payload);
  if (!courseId) {
    return new Response(JSON.stringify({ error: "no course id in payload" }), { status: 400 });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("[course-built] RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "not configured" }), { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title, description, created_by")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) throw new Error(`reading course: ${courseError.message}`);
    if (!course) {
      // A generation job can outlive the course it was building.
      console.warn(`[course-built] course ${courseId} not found — nothing to do`);
      return new Response(JSON.stringify({ skipped: "course not found" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!course.created_by) {
      console.warn(`[course-built] course ${courseId} has no created_by — nothing to do`);
      return new Response(JSON.stringify({ skipped: "no owner" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", course.created_by)
      .maybeSingle();
    if (profileError) throw new Error(`reading profile: ${profileError.message}`);

    const email = (profile?.email ?? "").trim().toLowerCase();
    if (!email) {
      console.warn(`[course-built] no email for ${course.created_by} — nothing to do`);
      return new Response(JSON.stringify({ skipped: "no email" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isExcluded(email)) {
      console.log(`[course-built] ${email} is excluded — no Resend update`);
      return new Response(JSON.stringify({ skipped: "excluded" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Counts come from the join tables, not from courses.modules — that jsonb column is
    // empty on all 726 rows and reading it would report every builder as having built
    // nothing, which is precisely the signal this webhook exists to carry.
    const [{ count: moduleCount }, { count: videoCount }] = await Promise.all([
      supabase
        .from("course_modules")
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseId),
      supabase
        .from("course_videos")
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseId),
    ]);

    const result = await updateContactProperties(resendKey, email, {
      course_title: course.title ?? null,
      module_count: moduleCount ?? 0,
      video_count: videoCount ?? 0,
      topic_cluster: classifyTopicCluster(course.title, course.description),
      lifecycle: "builder",
    });

    if (!result.ok) {
      // 404 is the ordinary case for a signup that predates the signup webhook: they have
      // no Resend contact yet. Worth seeing in the logs, not worth failing over.
      console.error(
        `[course-built] Resend ${result.status} for ${email}:`,
        JSON.stringify(result.body),
      );
      return new Response(
        JSON.stringify({ ok: false, status: result.status, email }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[course-built] ${email} -> builder (${moduleCount ?? 0} modules, ${videoCount ?? 0} videos)`,
    );
    return new Response(
      JSON.stringify({
        ok: true,
        email,
        module_count: moduleCount ?? 0,
        video_count: videoCount ?? 0,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[course-built] failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
