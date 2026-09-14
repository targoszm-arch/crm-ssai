-- Each pipeline stage owns a reusable playbook shown from the Deals board.
ALTER TABLE public.pipeline_stages
ADD COLUMN IF NOT EXISTS wiki_content text;
