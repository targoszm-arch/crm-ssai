-- Add foreign key constraint linking contacts to companies
ALTER TABLE contacts 
ADD CONSTRAINT fk_contacts_company 
FOREIGN KEY (company_id) REFERENCES companies(id) 
ON DELETE SET NULL;

-- Insert sample contacts linked to existing companies
INSERT INTO contacts (first_name, last_name, email, phone, title, work_location, company_id)
SELECT 
  'John', 'Smith', 'john@heygen.com', '+1 555-0101', 'CEO', 'San Francisco, CA', c.id
FROM companies c WHERE c.company_name = 'HeyGen' LIMIT 1;

INSERT INTO contacts (first_name, last_name, email, phone, title, work_location, company_id)
SELECT 
  'Sarah', 'Connor', 'sarah@gamma.app', '+1 555-0102', 'CTO', 'New York, NY', c.id
FROM companies c WHERE c.company_name = 'Gamma' LIMIT 1;

INSERT INTO contacts (first_name, last_name, email, phone, title, work_location, company_id)
SELECT 
  'Mike', 'Johnson', 'mike@revolut.com', '+44 20 7946 0958', 'Product Manager', 'London, UK', c.id
FROM companies c WHERE c.company_name = 'Revolut' LIMIT 1;

INSERT INTO contacts (first_name, last_name, email, phone, title, work_location, company_id)
SELECT 
  'Emma', 'Williams', 'emma@shopify.com', '+1 555-0104', 'Engineering Lead', 'Toronto, Canada', c.id
FROM companies c WHERE c.company_name = 'Shopify' LIMIT 1;

INSERT INTO contacts (first_name, last_name, email, phone, title, work_location, company_id)
SELECT 
  'David', 'Brown', 'david@vercel.com', '+1 555-0105', 'VP Engineering', 'Remote', c.id
FROM companies c WHERE c.company_name = 'Vercel' LIMIT 1;