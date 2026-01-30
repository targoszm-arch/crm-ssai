-- Add unique constraints for Meet Alfred sync upsert operations

-- Unique constraint for linkedin_connections on linkedin_id
CREATE UNIQUE INDEX IF NOT EXISTS linkedin_connections_linkedin_id_key 
ON linkedin_connections(linkedin_id);

-- Composite unique constraint for linkedin_messages on sender + timestamp
CREATE UNIQUE INDEX IF NOT EXISTS linkedin_messages_sender_timestamp_key 
ON linkedin_messages(sender_linkedin_id, message_timestamp);

-- Partial unique constraint for leads on email (only where email is not null)
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_key 
ON leads(email) WHERE email IS NOT NULL;