import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Globe, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useCreateVisitorSite, useVisitorSites, VisitorSite } from "./useWebsiteVisitors";

// Deliberately not called "visitor-tracking.js" or "*-analytics.js": ad-block
// and privacy-extension lists (EasyPrivacy et al.) block scripts by filename
// pattern, so a name that says what it does gets silently dropped in Safari
// and Chrome extensions like AdGuard/1Blocker/uBlock — before it ever reaches
// our own edge function.
function scriptSrc(): string {
  return `${window.location.origin}/ssai-widget.js`;
}

function snippetFor(site: VisitorSite): string {
  return `<script async\n  src="${scriptSrc()}"\n  data-site-key="${site.site_key}"></script>`;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Could not copy — select the text and copy manually.");
        }
      }}
    >
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function CreateSiteForm() {
  const [name, setName] = useState("Skill Studio AI");
  const [domain, setDomain] = useState("");
  const createSite = useCreateVisitorSite();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Set up visitor tracking
        </CardTitle>
        <CardDescription>
          Create a site to get your tracking snippet. Nothing is sent anywhere
          else — the script talks only to your own Supabase function.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="site-name">Site name</Label>
          <Input
            id="site-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Marketing site"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site-domain">Domain (optional)</Label>
          <Input
            id="site-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="skillstudio.ai"
          />
        </div>
        <Button
          onClick={() => {
            if (!name.trim()) {
              toast.error("Give the site a name first.");
              return;
            }
            createSite.mutate(
              { name: name.trim(), domain: domain.trim() || null },
              {
                onSuccess: () => toast.success("Site created — copy the snippet below."),
                onError: (error) =>
                  toast.error(error instanceof Error ? error.message : "Could not create the site"),
              },
            );
          }}
          disabled={createSite.isPending}
        >
          {createSite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create site
        </Button>
      </CardContent>
    </Card>
  );
}

export function TrackingSetup() {
  const { data: sites, isLoading } = useVisitorSites();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!sites || sites.length === 0) return <CreateSiteForm />;

  const site = sites[0];
  const snippet = snippetFor(site);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Paste this into Framer</CardTitle>
          <CardDescription>
            Framer → Site Settings → General → Custom Code → <strong>End of &lt;body&gt; tag</strong>,
            then publish. It works on every page, including Framer's client-side
            navigation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto whitespace-pre">
            {snippet}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={snippet} label="Copy snippet" />
            <CopyButton value={site.site_key} label="Copy site key" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Remove the old trackers</CardTitle>
          <CardDescription>
            While Apollo's and Leadfeeder's scripts are still in Framer's custom
            code they keep firing — and once their quota runs out they fail
            loudly in the browser console.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Delete these from Custom Code</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>Anything loading <code>assets.apollo.io</code> or <code>trackers.apollo.io</code></li>
                <li>Anything loading <code>sc.lfeeder.com</code> or <code>lftracker</code></li>
              </ul>
              <p className="mt-2 text-sm">
                The snippet above never writes to the console and never throws,
                so a failed request stays invisible to visitors.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>What gets stored</AlertTitle>
            <AlertDescription className="text-sm space-y-2">
              <p>
                Raw IP addresses are never written to the database — each one is
                hashed with a server-side salt as soon as the company lookup is
                done. No cookies are set; the session id lives in
                sessionStorage and disappears when the tab closes.
              </p>
              <p>
                An IP address is still personal data under GDPR while it is being
                processed, so mention company-level visitor identification in
                your privacy policy under legitimate interest.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
