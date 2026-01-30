import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecoveryStats {
  totalEnrolled: number;
  totalOpened: number;
  totalClicked: number;
  totalRecovered: number;
  openRate: number;
  clickRate: number;
  recoveryRate: number;
}

export interface RecoveryCampaign {
  sequenceId: string;
  sequenceName: string;
  status: string;
  enrolledCount: number;
  openedCount: number;
  clickedCount: number;
  recoveredCount: number;
  openRate: number;
  clickRate: number;
  recoveryRate: number;
}

export function useRecoveryAnalytics() {
  return useQuery({
    queryKey: ['recovery-analytics'],
    queryFn: async () => {
      // Get all sequences with signup_abandonment trigger type
      const { data: sequences, error: seqError } = await supabase
        .from('sequences')
        .select('id, name, status, trigger_type')
        .eq('trigger_type', 'signup_abandonment');

      if (seqError) throw seqError;

      if (!sequences || sequences.length === 0) {
        return {
          stats: {
            totalEnrolled: 0,
            totalOpened: 0,
            totalClicked: 0,
            totalRecovered: 0,
            openRate: 0,
            clickRate: 0,
            recoveryRate: 0,
          } as RecoveryStats,
          campaigns: [] as RecoveryCampaign[],
        };
      }

      const sequenceIds = sequences.map(s => s.id);

      // Get enrollments for these sequences
      const { data: enrollments, error: enrollError } = await supabase
        .from('sequence_enrollments')
        .select('id, sequence_id, status, metadata')
        .in('sequence_id', sequenceIds);

      if (enrollError) throw enrollError;

      const enrollmentIds = enrollments?.map(e => e.id) || [];

      // Get sequence emails for analytics
      const { data: emails, error: emailError } = await supabase
        .from('sequence_emails')
        .select('enrollment_id, status, opened_at, clicked_at, unique_opens, unique_clicks')
        .in('enrollment_id', enrollmentIds);

      if (emailError) throw emailError;

      // Calculate stats per sequence
      const campaigns: RecoveryCampaign[] = sequences.map(seq => {
        const seqEnrollments = enrollments?.filter(e => e.sequence_id === seq.id) || [];
        const seqEnrollmentIds = seqEnrollments.map(e => e.id);
        const seqEmails = emails?.filter(e => seqEnrollmentIds.includes(e.enrollment_id || '')) || [];

        const enrolledCount = seqEnrollments.length;
        const openedCount = seqEmails.filter(e => e.opened_at || (e.unique_opens && e.unique_opens > 0)).length;
        const clickedCount = seqEmails.filter(e => e.clicked_at || (e.unique_clicks && e.unique_clicks > 0)).length;
        
        // Count recovered (enrollments with status = 'completed' and metadata contains recovered: true)
        const recoveredCount = seqEnrollments.filter(e => {
          const metadata = e.metadata as Record<string, unknown> | null;
          return metadata?.recovered === true || e.status === 'completed';
        }).length;

        return {
          sequenceId: seq.id,
          sequenceName: seq.name,
          status: seq.status || 'draft',
          enrolledCount,
          openedCount,
          clickedCount,
          recoveredCount,
          openRate: enrolledCount > 0 ? (openedCount / enrolledCount) * 100 : 0,
          clickRate: enrolledCount > 0 ? (clickedCount / enrolledCount) * 100 : 0,
          recoveryRate: enrolledCount > 0 ? (recoveredCount / enrolledCount) * 100 : 0,
        };
      });

      // Aggregate stats
      const stats: RecoveryStats = {
        totalEnrolled: campaigns.reduce((sum, c) => sum + c.enrolledCount, 0),
        totalOpened: campaigns.reduce((sum, c) => sum + c.openedCount, 0),
        totalClicked: campaigns.reduce((sum, c) => sum + c.clickedCount, 0),
        totalRecovered: campaigns.reduce((sum, c) => sum + c.recoveredCount, 0),
        openRate: 0,
        clickRate: 0,
        recoveryRate: 0,
      };

      if (stats.totalEnrolled > 0) {
        stats.openRate = (stats.totalOpened / stats.totalEnrolled) * 100;
        stats.clickRate = (stats.totalClicked / stats.totalEnrolled) * 100;
        stats.recoveryRate = (stats.totalRecovered / stats.totalEnrolled) * 100;
      }

      return { stats, campaigns };
    },
    staleTime: 30000,
  });
}
