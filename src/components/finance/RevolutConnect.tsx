import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Connect Revolut.
 *
 * Revolut's consent lapses periodically, so this is a recurring chore rather
 * than a one-off — which is exactly why it is a button and not a documented
 * console incantation. The authorisation code is single-use and expires in
 * minutes, so the path from "click Enable" to "pasted" has to be short.
 *
 * The code is all that passes through the browser. The refresh token it buys
 * is written straight to a service-role-only table by the edge function and
 * never comes back here: there is no reason for a long-lived credential to
 * exist in a browser tab.
 */

interface RevolutStatus {
  secrets_set: boolean;
  has_refresh_token: boolean;
  obtained_at: string | null;
}

export function RevolutConnect() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["revolut-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-revolut", {
        body: { action: "status" },
      });
      if (error) throw error;
      return data as RevolutStatus;
    },
    retry: false,
  });

  const connect = async () => {
    // Revolut puts the code in the query string, so people paste the whole
    // URL as often as the code itself. Accept both.
    let value = code.trim();
    const match = value.match(/[?&]code=([^&\s]+)/);
    if (match) value = match[1];

    if (!value) {
      toast.error("Paste the code (or the whole redirect URL) first");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-revolut", {
        body: { action: "exchange", code: value },
      });
      const payload = (data ?? {}) as { ok?: boolean; error?: string; message?: string };

      if (payload.error) {
        toast.error(payload.message ?? payload.error);
        return;
      }
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Revolut connected");
      setCode("");
      qc.invalidateQueries({ queryKey: ["revolut-status"] });
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.has_refresh_token ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Connect Revolut
          {isLoading ? null : connected ? (
            <Badge className="bg-emerald-100 text-emerald-800">Connected</Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800">Not connected</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Revolut's consent expires periodically. When syncing starts failing, repeat these
          two steps — nothing else needs changing.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {status && !status.secrets_set && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Set <code className="font-mono">REVOLUT_CLIENT_ID</code>,{" "}
            <code className="font-mono">REVOLUT_PRIVATE_KEY</code> and{" "}
            <code className="font-mono">REVOLUT_REDIRECT_URI</code> in Supabase → Edge Functions
            → Secrets first. Those are set once and do not expire.
          </p>
        )}

        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
            <span>
              In Revolut Business → Settings → API, click <strong>Enable</strong>. You land on your
              redirect URL with <code className="font-mono text-xs">?code=…</code> in the address bar.
              <a
                href="https://business.revolut.com/settings/api"
                target="_blank"
                rel="noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open Revolut <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
            <span>Paste that address bar below and press Connect. Codes expire in minutes, so do it straight away.</span>
          </li>
        </ol>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") connect(); }}
            placeholder="https://www.skillstudio.ai/?code=oa_prod_…  (or just the code)"
            className="font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
          <Button onClick={connect} disabled={busy} className="shrink-0">
            {busy
              ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Connecting…</>
              : <><Check className="mr-2 h-4 w-4" />Connect</>}
          </Button>
        </div>

        {connected && status?.obtained_at && (
          <p className="text-xs text-muted-foreground">
            Connected {new Date(status.obtained_at).toLocaleDateString("en-IE", {
              day: "numeric", month: "short", year: "numeric",
            })}. The refresh token is stored server-side — it never reaches this page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
