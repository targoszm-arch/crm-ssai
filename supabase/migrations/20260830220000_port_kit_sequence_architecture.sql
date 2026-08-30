-- The sales machine, ported from Kit's structure.
--
-- Kit's onboarding scaffold models a funnel as a state machine where a TAG is both the
-- segment and the trigger: "Clicked Option A" -> "Interest - Product B" -> "Start Product 2
-- Sales Automation". That is the same loop we want, and it is worth copying rather than
-- reinventing.
--
-- What is ported: the sequence shapes, the cadences, and the branch points. What is NOT
-- ported: Kit's demo copy, which is about ramen and vegan recipes. Subjects here are
-- structural placeholders — every one needs rewriting before anything is activated.
--
-- Everything lands as status = 'draft'. Nothing sends. The engine is not scheduled either
-- (there is no process-sequences cron job), so this is safe to apply.

do $$
declare
  v_user uuid := '72242162-aafd-4360-bf6c-d42ef76c6575';

  -- Stable ids so the click routes below can reference the segment sequences, and so
  -- re-running this migration updates rather than duplicates.
  s_indoctrination uuid := '5e900000-0000-4000-8000-000000000001';
  s_welcome        uuid := '5e900000-0000-4000-8000-000000000002';
  s_topic_a        uuid := '5e900000-0000-4000-8000-000000000010';
  s_topic_b        uuid := '5e900000-0000-4000-8000-000000000011';
  s_topic_c        uuid := '5e900000-0000-4000-8000-000000000012';
  s_topic_d        uuid := '5e900000-0000-4000-8000-000000000013';
  s_sales          uuid := '5e900000-0000-4000-8000-000000000020';
  s_cart           uuid := '5e900000-0000-4000-8000-000000000021';
  s_course_welcome uuid := '5e900000-0000-4000-8000-000000000030';
  s_course_done    uuid := '5e900000-0000-4000-8000-000000000031';
  s_reengage       uuid := '5e900000-0000-4000-8000-000000000040';
  s_review         uuid := '5e900000-0000-4000-8000-000000000041';
begin

-- These rows are owned by a specific auth user, and sequences.user_id has a foreign key to
-- auth.users. On a fresh database — supabase db reset, CI, a preview branch — that row does
-- not exist and the first insert would abort the entire migration chain. Seed data must not
-- be able to break schema migrations, so skip quietly when the owner is not there.
if not exists (select 1 from auth.users where id = v_user) then
  raise notice 'Skipping Kit sequence seed: owner % not present in auth.users', v_user;
  return;
end if;

-- ---------------------------------------------------------------------------
-- 1. Entry: welcome, then the indoctrination email that does the segmenting.
-- ---------------------------------------------------------------------------

-- Kit: "Newsletter Intro" + "More about me: Intro follow-up".
insert into sequences (id, user_id, name, description, trigger_type, status, steps) values (
  s_welcome, v_user,
  'Welcome & Nurture',
  'Ported from Kit "Newsletter Intro" + "More about me". Runs on signup, before any pitch.',
  'signup', 'draft',
  '[{"day":0,"subject":"[DRAFT] Welcome — here is what to expect","template":""},
    {"day":2,"subject":"[DRAFT] More about me and why Skill Studio exists","template":""}]'::jsonb
) on conflict (id) do update set name = excluded.name, steps = excluded.steps,
  description = excluded.description, updated_at = now();

-- The one that matters: four cards, four destinations. Kit models this as
-- "Which product is right for you?" -> Pitch Option A/B/C.
insert into sequences (id, user_id, name, description, trigger_type, status, steps) values (
  s_indoctrination, v_user,
  'Indoctrination',
  'Email 2 carries the four topic cards. Whichever card is clicked routes the contact into '
  'a topic sequence via sequence_click_routes. Ported from Kit "Which product is right for you?".',
  'signup', 'draft',
  '[{"day":0,"subject":"[DRAFT] The problem we kept running into","template":""},
    {"day":2,"subject":"[DRAFT] Which of these sounds like you? (four cards — CTAs must match the click routes)","template":""},
    {"day":5,"subject":"[DRAFT] How teams actually use this","template":""},
    {"day":8,"subject":"[DRAFT] Where to start","template":""}]'::jsonb
) on conflict (id) do update set name = excluded.name, steps = excluded.steps,
  description = excluded.description, updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. The four topic sequences a click routes into.
--    Kit: "Pitch Option A / B / C". Cadence 0/3/7 days.
--    Only SOP is a real topic — the other three are placeholders to rename.
-- ---------------------------------------------------------------------------

insert into sequences (id, user_id, name, description, trigger_type, status, steps) values
 (s_topic_a, v_user, 'Topic — SOPs',
  'Entered by clicking the SOP card. Links to SOP courses, articles, blog posts.',
  'manual', 'draft',
  '[{"day":0,"subject":"[DRAFT] You clicked SOPs — start here","template":""},
    {"day":3,"subject":"[DRAFT] The SOP course, and what is in it","template":""},
    {"day":7,"subject":"[DRAFT] Ready to build your first one?","template":""}]'::jsonb),

 (s_topic_b, v_user, 'Topic — RENAME ME (card 2)',
  'Placeholder. Rename to your second card topic and update its click route pattern.',
  'manual', 'draft',
  '[{"day":0,"subject":"[DRAFT] Start here","template":""},
    {"day":3,"subject":"[DRAFT] The course, and what is in it","template":""},
    {"day":7,"subject":"[DRAFT] Ready to start?","template":""}]'::jsonb),

 (s_topic_c, v_user, 'Topic — RENAME ME (card 3)',
  'Placeholder. Rename to your third card topic and update its click route pattern.',
  'manual', 'draft',
  '[{"day":0,"subject":"[DRAFT] Start here","template":""},
    {"day":3,"subject":"[DRAFT] The course, and what is in it","template":""},
    {"day":7,"subject":"[DRAFT] Ready to start?","template":""}]'::jsonb),

 (s_topic_d, v_user, 'Topic — RENAME ME (card 4)',
  'Placeholder. Rename to your fourth card topic and update its click route pattern.',
  'manual', 'draft',
  '[{"day":0,"subject":"[DRAFT] Start here","template":""},
    {"day":3,"subject":"[DRAFT] The course, and what is in it","template":""},
    {"day":7,"subject":"[DRAFT] Ready to start?","template":""}]'::jsonb)
on conflict (id) do update set name = excluded.name, steps = excluded.steps,
  description = excluded.description, updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Sales and recovery. Cadences ported verbatim from Kit.
-- ---------------------------------------------------------------------------

-- Kit "Product 1 Sales Sequence": delays 0, +2, +3, +3, +3 -> days 0,2,5,8,11.
insert into sequences (id, user_id, name, description, trigger_type, status, steps) values (
  s_sales, v_user,
  'Product Sales Sequence',
  'Cadence ported verbatim from Kit "Product 1 Sales Sequence" (0/+2/+3/+3/+3). '
  'Kit''s structure is problem -> outcome -> proof -> inside the product -> is this for you.',
  'manual', 'draft',
  '[{"day":0,"subject":"[DRAFT] The trap (problem)","template":""},
    {"day":2,"subject":"[DRAFT] What becomes possible (outcome)","template":""},
    {"day":5,"subject":"[DRAFT] Customer result (proof)","template":""},
    {"day":8,"subject":"[DRAFT] Inside the product","template":""},
    {"day":11,"subject":"[DRAFT] Is this right for you?","template":""}]'::jsonb
) on conflict (id) do update set name = excluded.name, steps = excluded.steps,
  description = excluded.description, updated_at = now();

-- Kit "Abandoned checkout sequence": 0, +1, +1.
insert into sequences (id, user_id, name, description, trigger_type, status, steps) values (
  s_cart, v_user,
  'Abandoned Checkout Recovery',
  'Cadence ported verbatim from Kit (0/+1/+1). Needs a checkout-abandoned trigger to exist '
  'before it can do anything — nothing currently writes one.',
  'manual', 'draft',
  '[{"day":0,"subject":"[DRAFT] Forgot something?","template":""},
    {"day":1,"subject":"[DRAFT] Almost yours","template":""},
    {"day":2,"subject":"[DRAFT] Going, going","template":""}]'::jsonb
) on conflict (id) do update set name = excluded.name, steps = excluded.steps,
  description = excluded.description, updated_at = now();

-- ---------------------------------------------------------------------------
-- 4. Customer lifecycle — the half that actually fits an LMS.
-- ---------------------------------------------------------------------------

insert into sequences (id, user_id, name, description, trigger_type, status, steps) values
 (s_course_welcome, v_user, 'Course Welcome & Onboarding',
  'Ported from Kit "[Course Name] Welcome & Onboarding". Fires when someone starts a course.',
  'new_customer', 'draft',
  '[{"day":0,"subject":"[DRAFT] You are in — how to get started","template":""},
    {"day":2,"subject":"[DRAFT] The one thing most people skip","template":""},
    {"day":5,"subject":"[DRAFT] How are you getting on?","template":""}]'::jsonb),

 (s_course_done, v_user, 'Course Completion & Upsell',
  'Ported from Kit "[Course Name] Completion Follow-up + Upsell".',
  'post_purchase', 'draft',
  '[{"day":0,"subject":"[DRAFT] You finished — nice work","template":""},
    {"day":3,"subject":"[DRAFT] What to do with it now","template":""},
    {"day":7,"subject":"[DRAFT] The natural next course","template":""}]'::jsonb),

 (s_review, v_user, 'Ask for a Review',
  'Ported from Kit "Ask for a review". Cadence chosen (0/+3) — Kit''s exact delays not read.',
  'post_purchase', 'draft',
  '[{"day":0,"subject":"[DRAFT] Would you tell me how it went?","template":""},
    {"day":3,"subject":"[DRAFT] One quick follow-up","template":""}]'::jsonb),

 (s_reengage, v_user, 'Re-engagement',
  'Ported from Kit "Re-engagement Sequence". Must exclude anyone with a live subscription '
  'before it runs — customer exclusion is a query against the LMS, not a list of names.',
  'manual', 'draft',
  '[{"day":0,"subject":"[DRAFT] Still useful to you?","template":""},
    {"day":4,"subject":"[DRAFT] Last one from me","template":""}]'::jsonb)
on conflict (id) do update set name = excluded.name, steps = excluded.steps,
  description = excluded.description, updated_at = now();

-- ---------------------------------------------------------------------------
-- 5. Wire the four cards to the four topic sequences.
--    Patterns are placeholders: they must match the real CTA URLs in the email.
-- ---------------------------------------------------------------------------

delete from sequence_click_routes
where user_id = v_user and (topic like 'card-%' or topic = 'sop');

insert into sequence_click_routes (user_id, topic, match_pattern, label, enrol_sequence_id, priority, is_active) values
 (v_user, 'sop',    '/sop',            'SOP',    s_topic_a, 10, true),
 (v_user, 'card-2', '/RENAME-card-2',  'Card 2', s_topic_b, 10, false),
 (v_user, 'card-3', '/RENAME-card-3',  'Card 3', s_topic_c, 10, false),
 (v_user, 'card-4', '/RENAME-card-4',  'Card 4', s_topic_d, 10, false);

end $$;
