alter table public.custom_field_definitions drop constraint custom_field_definitions_field_type_check;
alter table public.custom_field_definitions add constraint custom_field_definitions_field_type_check
  check (field_type in ('text', 'number', 'checkbox', 'select', 'multiselect'));
