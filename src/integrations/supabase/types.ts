export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          annual_turnover: number | null
          categories: string | null
          client_id: string | null
          company_name: string
          connection_strength: string | null
          country: string | null
          created_at: string
          description: string | null
          domains: string | null
          employee_count: number | null
          employee_range: string | null
          estimated_arr: number | null
          foundation_date: string | null
          funding_raised: number | null
          id: string
          industry: string | null
          last_interaction: string | null
          linkedin_url: string | null
          size: string | null
          stage: string | null
          twitter_followers: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          annual_turnover?: number | null
          categories?: string | null
          client_id?: string | null
          company_name: string
          connection_strength?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          domains?: string | null
          employee_count?: number | null
          employee_range?: string | null
          estimated_arr?: number | null
          foundation_date?: string | null
          funding_raised?: number | null
          id?: string
          industry?: string | null
          last_interaction?: string | null
          linkedin_url?: string | null
          size?: string | null
          stage?: string | null
          twitter_followers?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          annual_turnover?: number | null
          categories?: string | null
          client_id?: string | null
          company_name?: string
          connection_strength?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          domains?: string | null
          employee_count?: number | null
          employee_range?: string | null
          estimated_arr?: number | null
          foundation_date?: string | null
          funding_raised?: number | null
          id?: string
          industry?: string | null
          last_interaction?: string | null
          linkedin_url?: string | null
          size?: string | null
          stage?: string | null
          twitter_followers?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          avatar: string | null
          company_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_contacted: string | null
          last_name: string | null
          linkedin_url: string | null
          name: string | null
          next_to_contact: string | null
          notes: string | null
          phone: string | null
          talent_partner_name: string | null
          title: string | null
          updated_at: string
          video_link: string | null
          work_location: string | null
        }
        Insert: {
          avatar?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_contacted?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          name?: string | null
          next_to_contact?: string | null
          notes?: string | null
          phone?: string | null
          talent_partner_name?: string | null
          title?: string | null
          updated_at?: string
          video_link?: string | null
          work_location?: string | null
        }
        Update: {
          avatar?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_contacted?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          name?: string | null
          next_to_contact?: string | null
          notes?: string | null
          phone?: string | null
          talent_partner_name?: string | null
          title?: string | null
          updated_at?: string
          video_link?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contacts_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          export_file_url: string | null
          id: string
          notes: string | null
          request_type: string
          requested_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          export_file_url?: string | null
          id?: string
          notes?: string | null
          request_type: string
          requested_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          export_file_url?: string | null
          id?: string
          notes?: string | null
          request_type?: string
          requested_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_name: string
          deal_value: number | null
          expected_close_date: string | null
          id: string
          industry: string | null
          notes: string | null
          owner_id: string | null
          probability: number | null
          stage: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_name: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          owner_id?: string | null
          probability?: number | null
          stage?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_name?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          owner_id?: string | null
          probability?: number | null
          stage?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_responses: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          qualification_status: string | null
          question: string | null
          response: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          qualification_status?: string | null
          question?: string | null
          response?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          qualification_status?: string | null
          question?: string | null
          response?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_date: string | null
          payment_status: string | null
          project_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_date?: string | null
          payment_status?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_date?: string | null
          payment_status?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kv_store_65817682: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      kv_store_958f7923: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      leads: {
        Row: {
          company_id: string | null
          company_name: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          qualification_score: number | null
          source: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          qualification_score?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          qualification_score?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_accounts: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          linkedin_id: string
          profile_data: Json | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          linkedin_id: string
          profile_data?: Json | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          linkedin_id?: string
          profile_data?: Json | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_connections: {
        Row: {
          company: string | null
          company_id: string | null
          connection_status: string | null
          contact_id: string | null
          created_at: string
          headline: string | null
          id: string
          linkedin_id: string
          name: string
          profile_url: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          company_id?: string | null
          connection_status?: string | null
          contact_id?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          linkedin_id: string
          name: string
          profile_url?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          company_id?: string | null
          connection_status?: string | null
          contact_id?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          linkedin_id?: string
          name?: string
          profile_url?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_connections_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_messages: {
        Row: {
          connection_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message_text: string
          message_timestamp: string
          recipient_linkedin_id: string
          sender_linkedin_id: string
          updated_at: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_text: string
          message_timestamp?: string
          recipient_linkedin_id: string
          sender_linkedin_id: string
          updated_at?: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_text?: string
          message_timestamp?: string
          recipient_linkedin_id?: string
          sender_linkedin_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "linkedin_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          filter_json: Json | null
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          filter_json?: Json | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          filter_json?: Json | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string | null
          document_url: string | null
          file_size: number | null
          id: string
          project_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type?: string | null
          document_url?: string | null
          file_size?: number | null
          id?: string
          project_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string | null
          document_url?: string | null
          file_size?: number | null
          id?: string
          project_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          client_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          manager: string | null
          priority: string | null
          progress: number | null
          project_id: string | null
          project_name: string
          start_date: string | null
          status: string | null
          team_members: string[] | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          manager?: string | null
          priority?: string | null
          progress?: number | null
          project_id?: string | null
          project_name: string
          start_date?: string | null
          status?: string | null
          team_members?: string[] | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          manager?: string | null
          priority?: string | null
          progress?: number | null
          project_id?: string | null
          project_name?: string
          start_date?: string | null
          status?: string | null
          team_members?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_name: string
          price: number | null
          proposal_id: string | null
          quantity: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_name: string
          price?: number | null
          proposal_id?: string | null
          quantity?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_name?: string
          price?: number | null
          proposal_id?: string | null
          quantity?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          additional_services: string | null
          amount: number | null
          client_id: string | null
          created_at: string
          expiration_date: string | null
          goals: string | null
          id: string
          project_name: string | null
          proposal_number: string | null
          status: string | null
          title: string
          updated_at: string
          why_us: string | null
        }
        Insert: {
          additional_services?: string | null
          amount?: number | null
          client_id?: string | null
          created_at?: string
          expiration_date?: string | null
          goals?: string | null
          id?: string
          project_name?: string | null
          proposal_number?: string | null
          status?: string | null
          title: string
          updated_at?: string
          why_us?: string | null
        }
        Update: {
          additional_services?: string | null
          amount?: number | null
          client_id?: string | null
          created_at?: string
          expiration_date?: string | null
          goals?: string | null
          id?: string
          project_name?: string | null
          proposal_number?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          why_us?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_opportunities: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_value: number | null
          expected_close_date: string | null
          id: string
          notes: string | null
          opportunity_name: string
          probability: number | null
          stage: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          opportunity_name: string
          probability?: number | null
          stage?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          opportunity_name?: string
          probability?: number | null
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archive: boolean | null
          assigned_to: string | null
          client_id: string | null
          company_id: string | null
          connection: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          linked_deal_id: string | null
          priority: string | null
          project_id: string | null
          status: string | null
          tags: string[] | null
          task_name: string
          updated_at: string
        }
        Insert: {
          archive?: boolean | null
          assigned_to?: string | null
          client_id?: string | null
          company_id?: string | null
          connection?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_deal_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string | null
          tags?: string[] | null
          task_name: string
          updated_at?: string
        }
        Update: {
          archive?: boolean | null
          assigned_to?: string | null
          client_id?: string | null
          company_id?: string | null
          connection?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_deal_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string | null
          tags?: string[] | null
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_deal_id_fkey"
            columns: ["linked_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_tracking: {
        Row: {
          billable: boolean | null
          created_at: string
          date: string
          description: string | null
          hourly_rate: number | null
          hours: number
          id: string
          project_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billable?: boolean | null
          created_at?: string
          date?: string
          description?: string | null
          hourly_rate?: number | null
          hours?: number
          id?: string
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billable?: boolean | null
          created_at?: string
          date?: string
          description?: string | null
          hourly_rate?: number | null
          hours?: number
          id?: string
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_tracking_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consent: {
        Row: {
          consent_type: string
          consented: boolean
          consented_at: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type: string
          consented?: boolean
          consented_at?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          consented?: boolean
          consented_at?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_user_consent: {
        Args: {
          consent_type_param: string
          consented_param: boolean
          ip_address_param?: string
          user_agent_param?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
