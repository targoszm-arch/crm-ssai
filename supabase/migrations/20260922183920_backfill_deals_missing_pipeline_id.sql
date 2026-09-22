-- 4 deals had pipeline_id = null (created by something other than the
-- app's own AddDealModal, which always sets it), making them invisible on
-- the Deals/Kanban page since useDealsByStage filters deals by
-- pipeline_id = <selected pipeline> and null never matches that equality.
-- Only one pipeline exists in this CRM, so the backfill is unambiguous.
update deals
set pipeline_id = (select id from pipelines limit 1)
where pipeline_id is null;
