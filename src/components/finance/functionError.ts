/**
 * The JSON body of a failed `functions.invoke`, or null.
 *
 * FunctionsHttpError carries the raw Response on `context`. Reading it is the
 * only way to see what the function actually said about a non-2xx, and a
 * function that answers 400 with a reason is being helpful, not broken.
 *
 * Returns null rather than throwing on anything unexpected — a relay error, a
 * network failure and an HTML error page all have no JSON body, and none of
 * them should turn a status check into an exception.
 */
export async function readErrorBody(error: unknown): Promise<unknown | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof (context as Response).json !== "function") return null;
  try {
    return await (context as Response).clone().json();
  } catch {
    return null;
  }
}

/**
 * What a sync button should say when its function fails. `String(error)` on a
 * FunctionsHttpError is "Edge Function returned a non-2xx status code", which
 * hides the one thing the function told us — most often that the source was
 * never connected (`not_configured`), a setup step rather than a fault.
 */
export async function describeSyncError(
  error: unknown,
): Promise<{ notConfigured: boolean; message: string }> {
  const body = (await readErrorBody(error)) as { error?: unknown; message?: unknown } | null;
  if (body?.error === "not_configured") {
    return {
      notConfigured: true,
      message: typeof body.message === "string" ? body.message : "Not configured",
    };
  }
  const detail = typeof body?.message === "string"
    ? body.message
    : typeof body?.error === "string"
      ? body.error
      : null;
  return { notConfigured: false, message: detail ?? String(error) };
}
