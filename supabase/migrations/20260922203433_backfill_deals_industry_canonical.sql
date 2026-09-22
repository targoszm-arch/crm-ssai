update deals set industry = 'Healthcare' where industry = 'healthcare';
update deals set industry = 'Professional Services' where industry in ('consulting', 'Consulting / knowledge management', 'Events', 'E-commerce');
update deals set industry = 'Education' where industry = 'education';
