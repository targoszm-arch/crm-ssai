ALTER TABLE linkedin_messages 
ADD COLUMN IF NOT EXISTS raw_payload jsonb;