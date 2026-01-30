import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Campaign } from "@/hooks/useCampaigns";
import { useActivities } from "@/hooks/useActivities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Mail, BarChart3, Activity, Linkedin, Calendar, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CampaignDetailSheetProps {
  campaign: Campaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignDetailSheet({ campaign, open, onOpenChange }: CampaignDetailSheetProps) {
  const navigate = useNavigate();
  
  // Fetch leads associated with this campaign
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["campaign-leads", campaign?.name],
    queryFn: async () => {
      if (!campaign?.name) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("*, contacts(first_name, last_name, email)")
        .ilike("source", `%${campaign.name}%`)
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!campaign?.name,
  });

  // Fetch activities related to this campaign
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["campaign-activities", campaign?.name],
    queryFn: async () => {
      if (!campaign?.name) return [];
      const { data, error } = await supabase
        .from("activities")
        .select("*, contacts(first_name, last_name)")
        .contains("metadata", { campaign: campaign.name })
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!campaign?.name,
  });

  // Fetch LinkedIn messages from this campaign
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["campaign-messages", campaign?.name],
    queryFn: async () => {
      if (!campaign?.name) return [];
      const { data, error } = await supabase
        .from("linkedin_messages")
        .select("*")
        .eq("campaign_name", campaign.name)
        .order("message_timestamp", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!campaign?.name,
  });

  const renderStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      draft: "bg-muted text-muted-foreground",
      scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      archived: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      ended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    };
    return (
      <Badge className={statusMap[status?.toLowerCase()] || "bg-muted text-muted-foreground"}>
        {status}
      </Badge>
    );
  };

  if (!campaign) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Linkedin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-left">{campaign.name}</SheetTitle>
              <SheetDescription className="text-left">
                {campaign.type} campaign • ID: {campaign.meetalfred_id}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{campaign.total_leads || 0}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{campaign.sent_count || 0}</p>
                <p className="text-xs text-muted-foreground">Messages Sent</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{campaign.open_rate || 0}%</p>
                <p className="text-xs text-muted-foreground">Open Rate</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{renderStatusBadge(campaign.status)}</p>
                <p className="text-xs text-muted-foreground">Status</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              navigate(`/customers?campaign=${encodeURIComponent(campaign.name)}`);
            }}
          >
            <Users className="h-4 w-4 mr-2" />
            View Leads
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              navigate(`/inbox?tab=linkedin&campaign=${encodeURIComponent(campaign.name)}`);
            }}
          >
            <Mail className="h-4 w-4 mr-2" />
            View Messages
          </Button>
        </div>

        <Tabs defaultValue="replies" className="flex-1 mt-4 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="replies">Replies ({messages?.length || 0})</TabsTrigger>
            <TabsTrigger value="leads">Leads ({leads?.length || 0})</TabsTrigger>
            <TabsTrigger value="activity">Activity ({activities?.length || 0})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="replies" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[400px]">
              {messagesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <Card key={msg.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {msg.sender_name || "Unknown"}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {msg.message_text}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.message_timestamp), { addSuffix: true })}
                            </span>
                            {msg.linkedin_conversation_url && (
                              <a 
                                href={msg.linkedin_conversation_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Open
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Mail className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No replies yet</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="leads" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[400px]">
              {leadsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : leads && leads.length > 0 ? (
                <div className="space-y-2">
                  {leads.map((lead) => (
                    <Card key={lead.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {lead.contact_name || lead.contacts?.first_name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">{lead.email || "No email"}</p>
                        </div>
                        <Badge variant="outline">{lead.status}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No leads found</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[400px]">
              {activitiesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : activities && activities.length > 0 ? (
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <Card key={activity.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{activity.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {activity.contacts?.first_name} {activity.contacts?.last_name} •{" "}
                              {activity.occurred_at && formatDistanceToNow(new Date(activity.occurred_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Activity className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No activity recorded</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}