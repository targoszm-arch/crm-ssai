-- Delete placeholder sequences with fake template IDs
DELETE FROM sequences 
WHERE id IN (
  'd58bedee-ab4c-46bf-b683-7f4baf162cf4',
  '07c6ffb9-ccab-468f-9b9e-42c7f704b8c0',
  '14d71219-b6ff-475f-882f-268eb50b470a',
  '35c97305-017b-493a-b65f-f7148f3cb492',
  '0a56ce39-8204-4e6a-96cb-89c5519d2023'
);