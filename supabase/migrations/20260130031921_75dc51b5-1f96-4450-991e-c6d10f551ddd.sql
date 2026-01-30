-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  subject TEXT,
  body_html TEXT DEFAULT '',
  body_text TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (matching existing pattern)
CREATE POLICY "Allow public read access on email_templates" 
ON public.email_templates 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access on email_templates" 
ON public.email_templates 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access on email_templates" 
ON public.email_templates 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access on email_templates" 
ON public.email_templates 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with starter templates
INSERT INTO public.email_templates (name, category, subject, body_html, body_text, is_default) VALUES
('Welcome Email', 'welcome', 'Welcome to {{company}}!', 
'<h2>Welcome, {{first_name}}!</h2><p>We''re thrilled to have you on board. Here''s what you can expect from us:</p><ul><li>Regular updates on our latest features</li><li>Exclusive tips and insights</li><li>Priority support</li></ul><p>Feel free to reach out if you have any questions.</p><p>Best regards,<br/>The Team</p>', 
'Welcome, {{first_name}}!\n\nWe''re thrilled to have you on board.\n\nBest regards,\nThe Team', 
true),

('Follow-up', 'follow_up', 'Following up on our conversation', 
'<p>Hi {{first_name}},</p><p>I wanted to follow up on our recent conversation. I hope you''ve had a chance to think about what we discussed.</p><p>If you have any questions or would like to continue our discussion, please don''t hesitate to reach out.</p><p>Looking forward to hearing from you.</p><p>Best,</p>', 
'Hi {{first_name}},\n\nI wanted to follow up on our recent conversation.\n\nBest regards', 
true),

('Value Proposition', 'sales', 'How we can help {{company}}', 
'<p>Hi {{first_name}},</p><p>I noticed that {{company}} might benefit from our solution. Here''s how we''ve helped similar companies:</p><ul><li>Increased efficiency by 40%</li><li>Reduced costs by 25%</li><li>Improved customer satisfaction</li></ul><p>Would you be open to a quick 15-minute call to discuss?</p><p>Best,</p>', 
'Hi {{first_name}},\n\nI noticed that {{company}} might benefit from our solution.\n\nBest regards', 
true),

('Meeting Request', 'meeting', 'Quick call to discuss opportunities', 
'<p>Hi {{first_name}},</p><p>I''d love to schedule a brief call to learn more about your needs and explore how we might be able to help.</p><p>Would any of these times work for you?</p><ul><li>Tuesday at 2pm</li><li>Wednesday at 10am</li><li>Thursday at 3pm</li></ul><p>Let me know what works best!</p><p>Best,</p>', 
'Hi {{first_name}},\n\nI''d love to schedule a brief call.\n\nBest regards', 
true),

('Thank You', 'thank_you', 'Thank you, {{first_name}}!', 
'<p>Hi {{first_name}},</p><p>Thank you so much for taking the time to speak with me today. I really enjoyed learning more about {{company}} and your goals.</p><p>As discussed, I''ll send over the additional information shortly.</p><p>Looking forward to our next conversation!</p><p>Best,</p>', 
'Hi {{first_name}},\n\nThank you for taking the time to speak with me today.\n\nBest regards', 
true);