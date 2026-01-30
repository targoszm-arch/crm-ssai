import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEmailSignature, useSaveEmailSignature } from "@/hooks/useEmailSignature";
import { toast } from "@/hooks/use-toast";

interface SignatureSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignatureSettings({ open, onOpenChange }: SignatureSettingsProps) {
  const { data: signature, isLoading } = useEmailSignature();
  const saveSignature = useSaveEmailSignature();
  const [signatureText, setSignatureText] = useState("");

  useEffect(() => {
    if (signature) {
      setSignatureText(signature.signature_text);
    }
  }, [signature]);

  const handleSave = () => {
    // Convert text to HTML (simple line breaks)
    const signatureHtml = signatureText
      .split("\n")
      .map((line) => `<p style="margin:0">${line || "&nbsp;"}</p>`)
      .join("");

    saveSignature.mutate(
      { signatureHtml, signatureText },
      {
        onSuccess: () => {
          toast({
            title: "Signature Saved",
            description: "Your email signature has been updated.",
          });
          onOpenChange(false);
        },
        onError: (error) => {
          toast({
            title: "Save Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Email Signature</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="signature" className="text-sm text-muted-foreground">
                Your signature will be added to the end of every email you send.
              </Label>
              <Textarea
                id="signature"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="Best regards,&#10;Your Name&#10;Your Title&#10;Company Name"
                rows={6}
                className="mt-2"
              />
            </div>

            {signatureText && (
              <div className="border rounded-md p-3 bg-muted/50">
                <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                <div className="text-sm whitespace-pre-wrap">{signatureText}</div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveSignature.isPending}>
            {saveSignature.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Signature"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
