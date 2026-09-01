/**
 * Typed, user-definable CRM fields.
 *
 * Ported from relixcrm's `lib/people-fields.ts`. The behaviour is theirs; what changed is
 * storage. relixcrm keeps definitions and values as JSON *strings* in Prisma columns, so
 * every accessor parses a string. Here they are Postgres `jsonb`, so the parse functions
 * take `unknown` and the serialisers hand back objects rather than strings. Everything
 * else — id normalisation, the type list, value coercion — is unchanged, deliberately, so
 * the two stay comparable.
 *
 * Why this exists at all: the columns on People and Organisations were a hardcoded
 * `ColumnDefinition[]`, so the Columns popover could only ever toggle a fixed list. You
 * could not add a field, type one, or reorder them. That is the difference between the two
 * codebases, and it is the part worth having.
 */

export type CrmFieldType =
  | "singleLineText"
  | "multiLineText"
  | "number"
  | "singleSelect"
  | "multiPicklist"
  | "date"
  | "dateTime"
  | "checkbox"
  | "userLookup";

export type CrmFieldScope = "global" | "private";

/** Which table a field belongs to. */
export type CrmFieldEntity = "contact" | "company";

export type CrmFieldDefinition = {
  id: string;
  label: string;
  type: CrmFieldType;
  /** True for a column that is a real database column rather than a custom_fields key. */
  builtIn?: boolean;
  /** A built-in that cannot be hidden — the Name column, which is the row's identity. */
  required?: boolean;
  scope?: CrmFieldScope;
  options?: string[];
};

export type CrmFieldValue = string | number | boolean | string[] | null;
export type CrmFieldValues = Record<string, CrmFieldValue>;

export const CRM_FIELD_TYPE_LABELS: Record<CrmFieldType, string> = {
  singleLineText: "Single line text",
  multiLineText: "Long text",
  number: "Number",
  singleSelect: "Single select",
  multiPicklist: "Multi select",
  date: "Date",
  dateTime: "Date and time",
  checkbox: "Checkbox",
  userLookup: "User",
};

/** The types that carry a user-managed option list. */
export const CRM_OPTION_FIELD_TYPES: CrmFieldType[] = ["singleSelect", "multiPicklist"];

const allowedFieldTypes = new Set<CrmFieldType>(
  Object.keys(CRM_FIELD_TYPE_LABELS) as CrmFieldType[],
);

function isCrmFieldType(value: unknown): value is CrmFieldType {
  return typeof value === "string" && allowedFieldTypes.has(value as CrmFieldType);
}

export function normalizeCrmFieldId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * jsonb comes back as an array already; a string is still accepted so a definition written
 * by hand, or by an older column, is not silently dropped.
 */
function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseCrmFieldDefinitions(value: unknown): CrmFieldDefinition[] {
  return asArray(value).flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? normalizeCrmFieldId(candidate.id) : "";
    const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
    const type = isCrmFieldType(candidate.type) ? candidate.type : null;
    const scope: CrmFieldScope = candidate.scope === "global" ? "global" : "private";
    const options = Array.isArray(candidate.options)
      ? candidate.options.filter(
          (option): option is string => typeof option === "string" && option.trim().length > 0,
        )
      : [];

    if (!id || !label || !type) return [];

    return [
      {
        id,
        label,
        type,
        scope,
        builtIn: Boolean(candidate.builtIn),
        required: Boolean(candidate.required),
        options,
      } satisfies CrmFieldDefinition,
    ];
  });
}

/** Returns a plain array for jsonb, not a string — the one deliberate change from relixcrm. */
export function serializeCrmFieldDefinitions(fields: CrmFieldDefinition[]) {
  return fields.map((field) => ({
    id: normalizeCrmFieldId(field.id),
    label: field.label.trim(),
    type: field.type,
    scope: field.scope === "global" ? "global" : "private",
    builtIn: Boolean(field.builtIn),
    required: Boolean(field.required),
    options: (field.options || []).map((option) => option.trim()).filter(Boolean),
  }));
}

export function parseDisplayedCrmFieldIds(value: unknown): string[] {
  return asArray(value)
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeCrmFieldId(item))
    .filter(Boolean);
}

export function serializeDisplayedCrmFieldIds(fieldIds: string[]) {
  return Array.from(
    new Set(fieldIds.map((fieldId) => normalizeCrmFieldId(fieldId)).filter(Boolean)),
  );
}

function normalizeStoredFieldValue(value: unknown): CrmFieldValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return null;
}

export function parseCrmFieldValues(value: unknown): CrmFieldValues {
  let source: unknown = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return {};
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};

  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>).flatMap(([fieldId, fieldValue]) => {
      const normalizedId = normalizeCrmFieldId(fieldId);
      if (!normalizedId) return [];
      return [[normalizedId, normalizeStoredFieldValue(fieldValue)]];
    }),
  );
}

export function serializeCrmFieldValues(values: CrmFieldValues) {
  const nextEntries = Object.entries(values).flatMap(([fieldId, fieldValue]) => {
    const normalizedId = normalizeCrmFieldId(fieldId);
    const normalizedValue = normalizeStoredFieldValue(fieldValue);

    if (!normalizedId || normalizedValue === null || normalizedValue === "") return [];
    if (Array.isArray(normalizedValue) && normalizedValue.length === 0) return [];

    return [[normalizedId, normalizedValue] as const];
  });

  return Object.fromEntries(nextEntries);
}

export function normalizeCrmFieldValueForType(type: CrmFieldType, value: unknown): CrmFieldValue {
  if (value === null || value === undefined) return null;

  switch (type) {
    case "checkbox":
      return Boolean(value);
    case "number": {
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }
    case "multiPicklist":
      if (Array.isArray(value)) {
        return value.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        );
      }
      if (typeof value === "string") {
        return value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
      return [];
    default:
      return typeof value === "string" ? value.trim() : String(value);
  }
}

/**
 * A comma-joined string ("Web Summit, Free Trial") is one value in the column but several
 * labels to a person. Splitting it is why the Labels filter could not match a contact who
 * had more than one: `.in("labels", [...])` compares whole strings.
 */
export function splitLabelList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
