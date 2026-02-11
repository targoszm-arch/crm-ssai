import { Copy, Check, Webhook, Key, FileJson } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const WEBHOOK_URL = "https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/lms-webhook";

const ACCEPTED_FIELDS = [
  { name: "crm_user_id", required: true, description: "Your CRM user ID (UUID)" },
  { name: "email", required: true, description: "Lead email address" },
  { name: "name", required: false, description: "Full name" },
  { name: "role", required: false, description: "Job title / role" },
  { name: "company_size", required: false, description: "e.g. 1-10, 11-50, 51-200" },
  { name: "use_case", required: false, description: "How they plan to use the product" },
  { name: "learning_objectives", required: false, description: "Goals or objectives" },
  { name: "marketing_consent", required: false, description: "Boolean – opted in to marketing" },
  { name: "source", required: false, description: "Lead source identifier" },
  { name: "plan", required: false, description: "Plan or tier" },
];

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(label ? `${label} copied` : "Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export default function Settings() {
  const { user } = useAuth();

  const samplePayload = JSON.stringify(
    {
      crm_user_id: user?.id ?? "<your-user-id>",
      email: "lead@example.com",
      name: "Jane Doe",
      role: "VP of Sales",
      company_size: "51-200",
      marketing_consent: true,
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage integrations and webhook configuration.</p>
      </div>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Inbound Lead Webhook</CardTitle>
          </div>
          <CardDescription>
            Use this endpoint to send leads from external apps (Zapier, Make, custom integrations) into your CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Endpoint URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Endpoint URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all">
                {WEBHOOK_URL}
              </code>
              <CopyButton text={WEBHOOK_URL} label="URL" />
            </div>
            <p className="text-xs text-muted-foreground">Method: <Badge variant="secondary" className="ml-1">POST</Badge></p>
          </div>

          {/* Required Headers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Required Headers</label>
            </div>
            <div className="rounded-md border bg-muted px-3 py-2 text-sm font-mono space-y-1">
              <div><span className="text-muted-foreground">Content-Type:</span> application/json</div>
              <div><span className="text-muted-foreground">x-api-key:</span> {"<your CRM_WEBHOOK_API_KEY>"}</div>
            </div>
          </div>

          {/* Accepted Fields */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Accepted Fields</label>
            </div>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">Field</th>
                    <th className="text-left px-3 py-2 font-medium">Required</th>
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ACCEPTED_FIELDS.map((field) => (
                    <tr key={field.name} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{field.name}</td>
                      <td className="px-3 py-2">
                        {field.required ? (
                          <Badge variant="destructive" className="text-[10px]">Required</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Optional</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{field.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Example Payload</label>
              <CopyButton text={samplePayload} label="Payload" />
            </div>
            <pre className="rounded-md border bg-muted px-4 py-3 text-sm font-mono overflow-x-auto">
              {samplePayload}
            </pre>
            <p className="text-xs text-muted-foreground">
              Your <code className="font-mono">crm_user_id</code> is auto-filled from your account: <code className="font-mono text-foreground">{user?.id ?? "—"}</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
