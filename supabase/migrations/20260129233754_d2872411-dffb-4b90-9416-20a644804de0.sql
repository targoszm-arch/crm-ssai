-- Fix contacts table: Replace public access with authenticated-only access
DROP POLICY IF EXISTS "Allow public delete access on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow public insert access on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow public read access on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow public update access on contacts" ON public.contacts;

-- Create new policies requiring authentication
CREATE POLICY "Authenticated users can read contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (true);

-- Fix proposal_items table: Replace public access with authenticated-only access
DROP POLICY IF EXISTS "Allow public access on proposal_items" ON public.proposal_items;

CREATE POLICY "Authenticated users can read proposal_items"
ON public.proposal_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert proposal_items"
ON public.proposal_items
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update proposal_items"
ON public.proposal_items
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete proposal_items"
ON public.proposal_items
FOR DELETE
TO authenticated
USING (true);