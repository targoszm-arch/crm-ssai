// Apollo as an enrichment SOURCE.
//
// This is not a walk-back of the decision to drop Apollo. That decision was about the
// sequencer — cold outbound is parked, so nothing depends on it — and it explicitly kept
// buying prospect data on a pay-per-use tier. This is that tier, and only that: two
// read endpoints, no sequences, no contacts pushed back, no B2B database rebuilt here.
//
// Why it is worth wiring at all. The existing enrichment is Hunter.io for facts and
// OpenAI for everything Hunter does not have, and OpenAI's half is inference — it is
// asked to "make reasonable inferences" and told not to return null. That is fine for
// buying_signals and pain_point, which are opinions anyway, and wrong for employee_count
// or a job title, where a confident guess is indistinguishable from a fact once it is a
// column. Apollo returns those as data. So Apollo goes FIRST and OpenAI fills only what
// is left, which shrinks the inferred surface rather than adding to it.
//
//   POST /api/v1/people/match        — one person
//   GET  /api/v1/organizations/enrich — one company
//
// The verbs differ because Apollo's do. The key travels as an x-api-key header in both
// cases and never as a query parameter, where it would land in every proxy and edge log
// between here and them.

const APOLLO = "https://api.apollo.io/api/v1";

export interface ApolloPerson {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  title?: string | null;
  seniority?: string | null;
  departments?: string[] | null;
  subdepartments?: string[] | null;
  functions?: string[] | null;
  email?: string | null;
  email_status?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  facebook_url?: string | null;
  phone_numbers?: Array<{ raw_number?: string | null; sanitized_number?: string | null }> | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  time_zone?: string | null;
  employment_history?: Array<{
    current?: boolean | null;
    start_date?: string | null;
    organization_name?: string | null;
    title?: string | null;
  }> | null;
  organization?: ApolloOrganization | null;
}

export interface ApolloOrganization {
  id?: string;
  name?: string | null;
  website_url?: string | null;
  primary_domain?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  industry?: string | null;
  keywords?: string[] | null;
  estimated_num_employees?: number | null;
  annual_revenue?: number | null;
  total_funding?: number | null;
  founded_year?: number | null;
  short_description?: string | null;
  raw_address?: string | null;
  country?: string | null;
  city?: string | null;
  publicly_traded_exchange?: string | null;
  technology_names?: string[] | null;
}

export class ApolloError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApolloError";
  }
}

async function apolloFetch<T>(
  apiKey: string,
  path: string,
  init: RequestInit,
): Promise<T | null> {
  const res = await fetch(`${APOLLO}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": apiKey,
      ...(init.headers ?? {}),
    },
  });

  // A miss is not an error. Apollo answers "we have never heard of this one" with a 200
  // and a null body on some endpoints and a 404 on others; both mean the same thing, and
  // neither should abort an enrichment Hunter or OpenAI can still contribute to.
  if (res.status === 404) return null;

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 402 and 422 are the ones worth reading in a log: out of credits, and a request
    // with too little to match on.
    throw new ApolloError(
      `Apollo ${path} failed (${res.status}): ${detail.slice(0, 300)}`,
      res.status,
    );
  }

  return (await res.json()) as T;
}

/**
 * Look up one person. Email is by far the strongest key; name + domain is the fallback
 * Apollo itself recommends, and is what makes this useful for the ~5,700 Meet Alfred
 * contacts that arrived from LinkedIn without an address.
 */
export async function matchPerson(
  apiKey: string,
  input: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    domain?: string | null;
    organizationName?: string | null;
    linkedinUrl?: string | null;
  },
): Promise<ApolloPerson | null> {
  const body: Record<string, unknown> = {};
  if (input.email) body.email = input.email;
  if (input.firstName) body.first_name = input.firstName;
  if (input.lastName) body.last_name = input.lastName;
  if (input.domain) body.domain = input.domain;
  if (input.organizationName) body.organization_name = input.organizationName;
  if (input.linkedinUrl) body.linkedin_url = input.linkedinUrl;

  // Apollo will happily bill a credit for a match on nothing useful and return noise.
  const hasKey = Boolean(
    input.email || input.linkedinUrl || (input.firstName && input.lastName && (input.domain || input.organizationName)),
  );
  if (!hasKey) return null;

  const payload = await apolloFetch<{ person?: ApolloPerson | null }>(
    apiKey,
    "/people/match",
    { method: "POST", body: JSON.stringify(body) },
  );
  return payload?.person ?? null;
}

/** Look up one company by domain. Apollo has no useful company match on name alone. */
export async function enrichOrganization(
  apiKey: string,
  domain: string,
): Promise<ApolloOrganization | null> {
  if (!domain) return null;
  const payload = await apolloFetch<{ organization?: ApolloOrganization | null }>(
    apiKey,
    `/organizations/enrich?domain=${encodeURIComponent(domain)}`,
    { method: "GET" },
  );
  return payload?.organization ?? null;
}

/** `https://www.acme.co.uk/careers` -> `acme.co.uk`. Bare domains pass through. */
export function toDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return trimmed.replace(/^(https?:\/\/)?(www\.)?/i, "").split("/")[0].toLowerCase() || null;
  }
}

/** Apollo's seniority vocabulary -> the CRM's. */
const SENIORITY_MAP: Record<string, string> = {
  owner: "Founder",
  founder: "Founder",
  c_suite: "C-Level",
  partner: "C-Level",
  vp: "VP",
  head: "Director",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  entry: "Entry",
  intern: "Entry",
};

/** Apollo's department vocabulary -> the CRM's `function` column. */
const FUNCTION_MAP: Record<string, string> = {
  sales: "Sales",
  marketing: "Marketing",
  engineering: "Engineering",
  information_technology: "Engineering",
  product_management: "Product",
  design: "Design",
  human_resources: "HR",
  finance: "Finance",
  accounting: "Finance",
  operations: "Operations",
  legal: "Legal",
  support: "Customer Success",
  customer_success: "Customer Success",
  consulting: "Operations",
  medical_health: "Operations",
  education: "Operations",
};

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapSeniority(apollo: string | null | undefined): string | null {
  if (!apollo) return null;
  return SENIORITY_MAP[apollo.toLowerCase()] ?? titleCase(apollo);
}

export function mapFunction(departments: string[] | null | undefined): string | null {
  if (!departments?.length) return null;
  for (const dept of departments) {
    const mapped = FUNCTION_MAP[dept.toLowerCase()];
    if (mapped) return mapped;
  }
  return titleCase(departments[0]);
}

export function primaryPhone(person: ApolloPerson): string | null {
  const numbers = person.phone_numbers ?? [];
  for (const entry of numbers) {
    const value = entry.sanitized_number || entry.raw_number;
    if (value) return value;
  }
  return null;
}

/** The start date of the job they are in now, for the CRM's current_job_start_date. */
export function currentJobStartDate(person: ApolloPerson): string | null {
  const current = (person.employment_history ?? []).find((job) => job.current);
  return current?.start_date || null;
}

/**
 * Apollo fields -> CRM `contacts` columns.
 *
 * Only real values are returned; every key here is something Apollo actually stated. What
 * to do with them — overwrite, or fill only what is empty — is the caller's decision, and
 * the two callers make it differently.
 */
export function contactFieldsFromApollo(person: ApolloPerson): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (person.title) fields.title = person.title;
  const seniority = mapSeniority(person.seniority);
  if (seniority) fields.seniority_level = seniority;
  const fn = mapFunction(person.departments ?? person.functions);
  if (fn) fields.function = fn;
  if (person.departments?.length) fields.department = titleCase(person.departments[0]);

  if (person.linkedin_url) fields.linkedin_url = person.linkedin_url;
  if (person.twitter_url) fields.twitter_url = person.twitter_url;
  if (person.facebook_url) fields.facebook_url = person.facebook_url;

  const phone = primaryPhone(person);
  if (phone) fields.phone = phone;

  if (person.city) fields.city = person.city;
  if (person.country) fields.country = person.country;
  if (person.state) fields.region = person.state;
  if (person.time_zone) fields.time_zone = person.time_zone;

  if (person.email_status) {
    fields.email_status = person.email_status;
    // Apollo's verification is only meaningful with a date attached to it.
    fields.email_last_verified_at = new Date().toISOString();
  }

  const started = currentJobStartDate(person);
  if (started) fields.current_job_start_date = started;

  return fields;
}

/** Apollo fields -> CRM `companies` columns. */
export function companyFieldsFromApollo(org: ApolloOrganization): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (org.industry) fields.industry = org.industry;
  if (org.short_description) fields.description = org.short_description;
  if (org.website_url || org.primary_domain) {
    fields.website = org.website_url || `https://${org.primary_domain}`;
  }
  if (org.primary_domain) fields.domains = org.primary_domain;
  if (org.linkedin_url) fields.linkedin_url = org.linkedin_url;

  if (typeof org.estimated_num_employees === "number") {
    fields.employee_count = org.estimated_num_employees;
    fields.employee_range = employeeRange(org.estimated_num_employees);
    fields.size = fields.employee_range;
  }
  // Apollo reports these in whole units of currency, which is what both columns hold.
  if (typeof org.annual_revenue === "number") fields.annual_turnover = org.annual_revenue;
  if (typeof org.total_funding === "number") fields.funding_raised = org.total_funding;

  if (org.founded_year) fields.foundation_date = `${org.founded_year}-01-01`;
  if (org.country) fields.country = org.country;
  if (org.raw_address) fields.address = org.raw_address;

  // `categories` is a single text column in the CRM, not an array.
  if (org.keywords?.length) fields.categories = org.keywords.slice(0, 12).join(", ");

  return fields;
}

/** The bands the CRM's employee_range column already uses elsewhere. */
function employeeRange(count: number): string {
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 500) return "201-500";
  if (count <= 1000) return "501-1000";
  if (count <= 5000) return "1001-5000";
  if (count <= 10000) return "5001-10000";
  return "10000+";
}
