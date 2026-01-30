import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useContacts } from "@/hooks/useContacts";
import { useCompanies } from "@/hooks/useCompanies";
import { usePipelines, usePipelineStages } from "@/hooks/usePipelines";
import { useCreateDeal, useUpdateDeal, Deal } from "@/hooks/useDeals";
import { LabelSelector } from "@/components/shared/LabelSelector";

const formSchema = z.object({
  deal_name: z.string().min(1, "Title is required"),
  contact_id: z.string().optional(),
  company_id: z.string().optional(),
  deal_value: z.coerce.number().min(0).optional(),
  pipeline_id: z.string().optional(),
  stage: z.string().optional(),
  probability: z.coerce.number().min(0).max(100).optional(),
  expected_close_date: z.date().optional(),
  source_channel: z.string().optional(),
  source_channel_id: z.string().optional(),
  lead_source: z.string().optional(),
  labels: z.string().optional(),
  notes: z.string().optional(),
  industry: z.string().optional(),
  type: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<Deal>;
  initialStage?: string;
  onSuccess?: () => void;
}

export function AddDealModal({
  open,
  onOpenChange,
  initialData,
  initialStage,
  onSuccess,
}: AddDealModalProps) {
  const { data: contacts } = useContacts();
  const { data: companies } = useCompanies();
  const { data: pipelines } = usePipelines();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();

  const defaultPipeline = pipelines?.find((p) => p.is_default) || pipelines?.[0];
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | undefined>(
    initialData?.pipeline_id || defaultPipeline?.id
  );
  
  const { data: stages } = usePipelineStages(selectedPipelineId);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deal_name: initialData?.deal_name || "",
      contact_id: initialData?.contact_id || undefined,
      company_id: initialData?.company_id || undefined,
      deal_value: initialData?.deal_value || undefined,
      pipeline_id: initialData?.pipeline_id || defaultPipeline?.id,
      stage: initialData?.stage || initialStage || stages?.[0]?.name,
      probability: initialData?.probability || 0,
      expected_close_date: initialData?.expected_close_date 
        ? new Date(initialData.expected_close_date) 
        : undefined,
      source_channel: initialData?.source_channel || undefined,
      source_channel_id: initialData?.source_channel_id || undefined,
      lead_source: initialData?.lead_source || undefined,
      labels: initialData?.labels || "",
      notes: initialData?.notes || "",
      industry: initialData?.industry || undefined,
      type: initialData?.type || undefined,
    },
  });

  useEffect(() => {
    if (defaultPipeline && !selectedPipelineId) {
      setSelectedPipelineId(defaultPipeline.id);
      form.setValue("pipeline_id", defaultPipeline.id);
    }
  }, [defaultPipeline, selectedPipelineId, form]);

  useEffect(() => {
    if (stages?.[0] && !form.getValues("stage") && !initialStage) {
      form.setValue("stage", stages[0].name);
    } else if (initialStage) {
      form.setValue("stage", initialStage);
    }
  }, [stages, form, initialStage]);

  const onSubmit = async (data: FormData) => {
    const dealData = {
      ...data,
      expected_close_date: data.expected_close_date?.toISOString(),
    };

    if (initialData?.id) {
      await updateDeal.mutateAsync({ id: initialData.id, ...dealData });
    } else {
      await createDeal.mutateAsync(dealData);
    }

    onOpenChange(false);
    onSuccess?.();
  };

  const isSubmitting = createDeal.isPending || updateDeal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? "Edit Deal" : "Add Deal"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="contact_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select contact" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contacts?.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.first_name} {contact.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select organization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies?.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.company_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deal_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Deal title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="deal_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Value</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="probability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Probability %</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="0"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="pipeline_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pipeline</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedPipelineId(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select pipeline" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pipelines?.map((pipeline) => (
                            <SelectItem key={pipeline.id} value={pipeline.id}>
                              {pipeline.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pipeline Stage Visual */}
                <FormField
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pipeline Stage</FormLabel>
                      <div className="flex flex-wrap gap-1">
                        {stages?.map((stage, index) => (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => field.onChange(stage.name)}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                              field.value === stage.name
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            )}
                          >
                            {stage.name}
                            {index < (stages?.length || 0) - 1 && (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="labels"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Labels</FormLabel>
                      <FormControl>
                        <LabelSelector
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Add labels..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expected_close_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Close Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="source_channel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Channel</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select channel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="source_channel_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Channel ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Campaign ID, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lead_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="existing_customer">Existing Customer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="technology">Technology</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="healthcare">Healthcare</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="consulting">Consulting</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deal Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new_business">New Business</SelectItem>
                          <SelectItem value="expansion">Expansion</SelectItem>
                          <SelectItem value="renewal">Renewal</SelectItem>
                          <SelectItem value="upsell">Upsell</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add notes..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : initialData?.id ? "Update Deal" : "Create Deal"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
