-- The app's own AddDealModal always sets pipeline_id, but nothing enforced
-- it at the database level -- the internal MCP server's create_deal tool
-- (supabase/functions/mcp/index.ts) inserts {...args, user_id} straight
-- through with no required fields, so a caller that omits pipeline_id
-- silently created a deal invisible on the Deals/Kanban page (useDealsByStage
-- filters by pipeline_id = <selected pipeline>, and null never matches).
-- All 4 existing null rows were just backfilled; NOT NULL makes it
-- impossible for a future insert from any path to repeat this silently --
-- it now fails loudly instead.
alter table deals alter column pipeline_id set not null;
