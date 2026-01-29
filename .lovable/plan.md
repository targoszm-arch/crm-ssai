
# Plan: Fix AI Contact Enrichment

## Problem Summary

The AI enrichment feature doesn't add any data because:

1. **GPT-4o-mini cannot search the web** - It relies solely on training data
2. **Contacts have minimal data** - Often just a name with no email, company, or LinkedIn
3. **Only empty fields get updated** - When AI returns nulls (which it does without context), nothing gets saved
4. **Toast shows "Updated 0 fields"** - Technically works, but user sees no changes

## Solution

Improve the enrichment logic to:
1. Use available data more intelligently (extract company from email domain)
2. Make the AI more creative with inferences
3. Allow overwriting existing fields when user explicitly requests enrichment
4. Add better feedback about what happened

---

## Implementation Details

### 1. Improve the Edge Function Prompt

| Current Issue | Fix |
|--------------|-----|
| AI asked to only provide facts | Allow reasonable inferences based on role patterns |
| No email domain parsing | Extract company name from email domain (e.g., `@bayer.com` -> Bayer) |
| Returns null if uncertain | Provide best-effort guesses with confidence indicators |

### 2. Update Enrichment Logic

| Current Behavior | New Behavior |
|-----------------|--------------|
| Only updates empty fields | Option to update all fields OR force enrichment |
| Silent failure when all nulls | Return helpful message about why no data found |
| No validation of inputs | Warn if contact has insufficient data for enrichment |

### 3. Better User Feedback

| Scenario | Current Feedback | New Feedback |
|----------|-----------------|--------------|
| No email, no LinkedIn | "Updated 0 fields" | "Add email or LinkedIn for better results" |
| Email found, fields enriched | "Updated 3 fields" | "Updated: seniority_level, function, pain_point" |
| All fields already filled | "Updated 0 fields" | "All fields already populated" |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/enrich-contact/index.ts` | Improved prompt, email domain parsing, better response handling |

---

## Updated Edge Function Logic

```text
1. Extract company from email domain if company not linked
   - "john@microsoft.com" -> infer "Microsoft"
   
2. Build richer context for OpenAI
   - Include inferred company
   - Use more directive prompting
   
3. Change AI instructions
   - "Make reasonable professional inferences"
   - "For a Sales Director at a tech company, typical function is Sales"
   
4. Update response handling
   - If contact has no email AND no LinkedIn AND no company:
     Return { success: true, message: "Need more data", enrichedFields: [] }
   - If AI returns data:
     Always update (don't check if field is empty)
```

---

## Example Improved Prompt

```text
Given this contact:
- Name: John Smith  
- Email: john.smith@salesforce.com (Company: Salesforce)
- Title: VP of Sales

Infer professional details. Make reasonable assumptions based on:
- Email domain suggests company type
- Job title indicates seniority and function
- Industry patterns for similar roles

{
  "seniority_level": "VP",  // Inferred from "VP of Sales" title
  "function": "Sales",       // Inferred from "VP of Sales"
  "buying_signals": "As a VP of Sales at an enterprise SaaS company...",
  "interest_level": "High",  // VPs have budget authority
  ...
}
```

---

## Summary

| Change | Impact |
|--------|--------|
| Parse email domains | Extract company context from `@company.com` |
| Better prompting | AI makes reasonable inferences instead of returning nulls |
| Force update mode | Allow refreshing existing data when explicitly requested |
| User feedback | Clear messages about what was/wasn't enriched and why |
