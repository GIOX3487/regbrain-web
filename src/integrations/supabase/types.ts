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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acn_reports: {
        Row: {
          acn_response: string | null
          assessment_ids: string[] | null
          content: Json
          created_at: string
          id: string
          incident_ids: string[] | null
          report_type: string
          reporting_period_end: string
          reporting_period_start: string
          status: string
          submission_reference: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acn_response?: string | null
          assessment_ids?: string[] | null
          content: Json
          created_at?: string
          id?: string
          incident_ids?: string[] | null
          report_type: string
          reporting_period_end: string
          reporting_period_start: string
          status?: string
          submission_reference?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acn_response?: string | null
          assessment_ids?: string[] | null
          content?: Json
          created_at?: string
          id?: string
          incident_ids?: string[] | null
          report_type?: string
          reporting_period_end?: string
          reporting_period_start?: string
          status?: string
          submission_reference?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      action_plans: {
        Row: {
          assessment_id: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          estimated_cost_eur: number | null
          estimated_hours: number | null
          gap_id: string | null
          id: string
          priority: number
          progress_percentage: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          estimated_cost_eur?: number | null
          estimated_hours?: number | null
          gap_id?: string | null
          id?: string
          priority: number
          progress_percentage?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          estimated_cost_eur?: number | null
          estimated_hours?: number | null
          gap_id?: string | null
          id?: string
          priority?: number
          progress_percentage?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_gap_id_fkey"
            columns: ["gap_id"]
            isOneToOne: false
            referencedRelation: "identified_gaps"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          created_at: string
          file_hash: string
          file_size: number
          id: string
          metadata: Json | null
          model_type: string
          name: string
          status: string
          updated_at: string
          upload_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_hash: string
          file_size: number
          id?: string
          metadata?: Json | null
          model_type: string
          name: string
          status?: string
          updated_at?: string
          upload_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_hash?: string
          file_size?: number
          id?: string
          metadata?: Json | null
          model_type?: string
          name?: string
          status?: string
          updated_at?: string
          upload_date?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_watches: {
        Row: {
          created_at: string
          created_by: string
          document_id: string | null
          id: string
          jurisdiction: string | null
          label: string
          sector: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          document_id?: string | null
          id?: string
          jurisdiction?: string | null
          label: string
          sector?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string | null
          id?: string
          jurisdiction?: string | null
          label?: string
          sector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_watches_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_benchmarks: {
        Row: {
          areas_ahead_of_market: Json | null
          areas_behind_market: Json | null
          assessment_id: string
          competitive_insights: Json | null
          created_at: string
          id: string
          quick_wins: Json | null
          sector_average_compliance: number | null
          sector_position_percentile: number | null
          updated_at: string
          your_compliance: number | null
        }
        Insert: {
          areas_ahead_of_market?: Json | null
          areas_behind_market?: Json | null
          assessment_id: string
          competitive_insights?: Json | null
          created_at?: string
          id?: string
          quick_wins?: Json | null
          sector_average_compliance?: number | null
          sector_position_percentile?: number | null
          updated_at?: string
          your_compliance?: number | null
        }
        Update: {
          areas_ahead_of_market?: Json | null
          areas_behind_market?: Json | null
          assessment_id?: string
          competitive_insights?: Json | null
          created_at?: string
          id?: string
          quick_wins?: Json | null
          sector_average_compliance?: number | null
          sector_position_percentile?: number | null
          updated_at?: string
          your_compliance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_benchmarks_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      board_training: {
        Row: {
          completion_criteria: Json | null
          content: Json
          created_at: string
          description: string
          duration_minutes: number
          id: string
          mandatory: boolean | null
          target_roles: Json
          title: string
          training_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completion_criteria?: Json | null
          content: Json
          created_at?: string
          description: string
          duration_minutes: number
          id?: string
          mandatory?: boolean | null
          target_roles?: Json
          title: string
          training_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completion_criteria?: Json | null
          content?: Json
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          mandatory?: boolean | null
          target_roles?: Json
          title?: string
          training_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chunks: {
        Row: {
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          end_pos: number
          id: string
          start_pos: number
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          end_pos?: number
          id?: string
          start_pos?: number
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          end_pos?: number
          id?: string
          start_pos?: number
        }
        Relationships: [
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_assessments: {
        Row: {
          annual_revenue_eur: number | null
          assessment_type: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          overall_compliance_percentage: number | null
          overall_risk_score: number | null
          requirement_checks: Json | null
          scope_jurisdiction: string
          scope_regulations: string[]
          scope_sector: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_revenue_eur?: number | null
          assessment_type: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          overall_compliance_percentage?: number | null
          overall_risk_score?: number | null
          requirement_checks?: Json | null
          scope_jurisdiction: string
          scope_regulations?: string[]
          scope_sector: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_revenue_eur?: number | null
          assessment_type?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          overall_compliance_percentage?: number | null
          overall_risk_score?: number | null
          requirement_checks?: Json | null
          scope_jurisdiction?: string
          scope_regulations?: string[]
          scope_sector?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_maturity_scores: {
        Row: {
          assessments_score: number
          created_at: string
          documentation_score: number
          id: string
          level: number
          proactivity_score: number
          team_score: number
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          assessments_score?: number
          created_at?: string
          documentation_score?: number
          id?: string
          level?: number
          proactivity_score?: number
          team_score?: number
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          assessments_score?: number
          created_at?: string
          documentation_score?: number
          id?: string
          level?: number
          proactivity_score?: number
          team_score?: number
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_monitors: {
        Row: {
          check_frequency_minutes: number | null
          config: Json | null
          created_at: string
          description: string | null
          id: string
          last_check: string | null
          monitor_type: string
          name: string
          status: string
          total_scans: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_frequency_minutes?: number | null
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          last_check?: string | null
          monitor_type: string
          name: string
          status?: string
          total_scans?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_frequency_minutes?: number | null
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          last_check?: string | null
          monitor_type?: string
          name?: string
          status?: string
          total_scans?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dataset_analyses: {
        Row: {
          analysis_date: string
          anomaly_score: number | null
          created_at: string
          dataset_name: string
          id: string
          model_id: string
          poisoning_indicators: Json | null
          quality_metrics: Json | null
          record_count: number | null
          statistical_checks: Json | null
        }
        Insert: {
          analysis_date?: string
          anomaly_score?: number | null
          created_at?: string
          dataset_name: string
          id?: string
          model_id: string
          poisoning_indicators?: Json | null
          quality_metrics?: Json | null
          record_count?: number | null
          statistical_checks?: Json | null
        }
        Update: {
          analysis_date?: string
          anomaly_score?: number | null
          created_at?: string
          dataset_name?: string
          id?: string
          model_id?: string
          poisoning_indicators?: Json | null
          quality_metrics?: Json | null
          record_count?: number | null
          statistical_checks?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dataset_analyses_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sessions: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          last_activity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          last_activity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          last_activity?: string
          user_id?: string
        }
        Relationships: []
      }
      document_comments: {
        Row: {
          content: string
          created_at: string
          document_id: string
          id: string
          parent_comment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          id?: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_comments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "document_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          jurisdiction: string
          language: string
          sector: string
          source_url: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction: string
          language?: string
          sector: string
          source_url?: string | null
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction?: string
          language?: string
          sector?: string
          source_url?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      gap_analysis_cache: {
        Row: {
          cache_key: string
          created_at: string
          documents_count: number
          id: string
          input_fingerprint: string
          language: string
          regulations: string[]
          result_payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          documents_count?: number
          id?: string
          input_fingerprint: string
          language?: string
          regulations?: string[]
          result_payload: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          documents_count?: number
          id?: string
          input_fingerprint?: string
          language?: string
          regulations?: string[]
          result_payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_documents: {
        Row: {
          assessment_id: string | null
          content: Json
          created_at: string
          document_type: string
          id: string
          metadata: Json | null
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          assessment_id?: string | null
          content: Json
          created_at?: string
          document_type: string
          id?: string
          metadata?: Json | null
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          assessment_id?: string | null
          content?: Json
          created_at?: string
          document_type?: string
          id?: string
          metadata?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_policies: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assessment_id: string | null
          content: Json
          created_at: string
          id: string
          policy_type: string
          review_date: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assessment_id?: string | null
          content: Json
          created_at?: string
          id?: string
          policy_type: string
          review_date?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assessment_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          policy_type?: string
          review_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "generated_policies_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      identified_gaps: {
        Row: {
          article_text_excerpt: string | null
          assessment_id: string
          created_at: string
          coverage_status: string | null
          current_state: string | null
          detection_method: string | null
          evidence: Json | null
          fine_tier_basis: string | null
          gap_description: string
          id: string
          potential_fine_eur: number | null
          potential_fine_max_eur: number | null
          priority: number
          recommended_actions: Json | null
          remediation_effort: string | null
          requirement_description: string
          requirement_reference: string
          resolved_at: string | null
          risk_level: string
          risk_score: number
          semantic_similarity: number | null
          severity: string | null
          source_chunk_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          article_text_excerpt?: string | null
          assessment_id: string
          created_at?: string
          coverage_status?: string | null
          current_state?: string | null
          detection_method?: string | null
          evidence?: Json | null
          fine_tier_basis?: string | null
          gap_description: string
          id?: string
          potential_fine_eur?: number | null
          potential_fine_max_eur?: number | null
          priority: number
          recommended_actions?: Json | null
          remediation_effort?: string | null
          requirement_description: string
          requirement_reference: string
          resolved_at?: string | null
          risk_level: string
          risk_score: number
          semantic_similarity?: number | null
          severity?: string | null
          source_chunk_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          article_text_excerpt?: string | null
          assessment_id?: string
          created_at?: string
          coverage_status?: string | null
          current_state?: string | null
          detection_method?: string | null
          evidence?: Json | null
          fine_tier_basis?: string | null
          gap_description?: string
          id?: string
          potential_fine_eur?: number | null
          potential_fine_max_eur?: number | null
          priority?: number
          recommended_actions?: Json | null
          remediation_effort?: string | null
          requirement_description?: string
          requirement_reference?: string
          resolved_at?: string | null
          risk_level?: string
          risk_score?: number
          semantic_similarity?: number | null
          severity?: string | null
          source_chunk_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "identified_gaps_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identified_gaps_source_chunk_id_fkey"
            columns: ["source_chunk_id"]
            isOneToOne: false
            referencedRelation: "chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      market_intelligence_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          intelligence_data: Json
          jurisdiction: string
          sector: string
          user_role: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          intelligence_data: Json
          jurisdiction: string
          sector: string
          user_role: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          intelligence_data?: Json
          jurisdiction?: string
          sector?: string
          user_role?: string
        }
        Relationships: []
      }
      model_provenance: {
        Row: {
          chain_of_custody: Json | null
          created_at: string
          id: string
          model_id: string
          source_organization: string | null
          source_url: string | null
          training_date: string | null
          updated_at: string
          verification_status: string | null
          version: string | null
        }
        Insert: {
          chain_of_custody?: Json | null
          created_at?: string
          id?: string
          model_id: string
          source_organization?: string | null
          source_url?: string | null
          training_date?: string | null
          updated_at?: string
          verification_status?: string | null
          version?: string | null
        }
        Update: {
          chain_of_custody?: Json | null
          created_at?: string
          id?: string
          model_id?: string
          source_organization?: string | null
          source_url?: string | null
          training_date?: string | null
          updated_at?: string
          verification_status?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_provenance_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_scans: {
        Row: {
          compliance_status: Json | null
          created_at: string
          findings: Json | null
          id: string
          model_id: string
          recommendations: Json | null
          risk_level: string
          scan_date: string
          scan_duration_ms: number | null
          scan_type: string
          trust_score: number | null
        }
        Insert: {
          compliance_status?: Json | null
          created_at?: string
          findings?: Json | null
          id?: string
          model_id: string
          recommendations?: Json | null
          risk_level: string
          scan_date?: string
          scan_duration_ms?: number | null
          scan_type: string
          trust_score?: number | null
        }
        Update: {
          compliance_status?: Json | null
          created_at?: string
          findings?: Json | null
          id?: string
          model_id?: string
          recommendations?: Json | null
          risk_level?: string
          scan_date?: string
          scan_duration_ms?: number | null
          scan_type?: string
          trust_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_scans_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_findings: {
        Row: {
          compliance_impact: Json | null
          created_at: string
          description: string
          finding_type: string
          id: string
          monitor_id: string | null
          monitor_type: string
          recommended_actions: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resource_name: string
          resource_type: string
          severity: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          compliance_impact?: Json | null
          created_at?: string
          description: string
          finding_type: string
          id?: string
          monitor_id?: string | null
          monitor_type: string
          recommended_actions?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resource_name: string
          resource_type: string
          severity: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          compliance_impact?: Json | null
          created_at?: string
          description?: string
          finding_type?: string
          id?: string
          monitor_id?: string | null
          monitor_type?: string
          recommended_actions?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resource_name?: string
          resource_type?: string
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_findings_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "compliance_monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      news_updates: {
        Row: {
          created_at: string
          id: string
          impact_level: string | null
          jurisdiction: string
          published_at: string
          regulation_type: string
          source: string
          source_url: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact_level?: string | null
          jurisdiction?: string
          published_at: string
          regulation_type: string
          source: string
          source_url?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          impact_level?: string | null
          jurisdiction?: string
          published_at?: string
          regulation_type?: string
          source?: string
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          achievement_unlocked: boolean
          compliance_deadlines: boolean
          created_at: string
          email_frequency: string
          id: string
          new_regulations: boolean
          team_activity: boolean
          updated_at: string
          user_id: string
          weekly_insights: boolean
        }
        Insert: {
          achievement_unlocked?: boolean
          compliance_deadlines?: boolean
          created_at?: string
          email_frequency?: string
          id?: string
          new_regulations?: boolean
          team_activity?: boolean
          updated_at?: string
          user_id: string
          weekly_insights?: boolean
        }
        Update: {
          achievement_unlocked?: boolean
          compliance_deadlines?: boolean
          created_at?: string
          email_frequency?: string
          id?: string
          new_regulations?: boolean
          team_activity?: boolean
          updated_at?: string
          user_id?: string
          weekly_insights?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_api_log: {
        Row: {
          action: string | null
          created_at: string
          endpoint: string
          id: string
          partner_id: string
          request_summary: Json | null
          response_summary: Json | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          endpoint: string
          id?: string
          partner_id: string
          request_summary?: Json | null
          response_summary?: Json | null
        }
        Update: {
          action?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          partner_id?: string
          request_summary?: Json | null
          response_summary?: Json | null
        }
        Relationships: []
      }
      partner_api_tokens: {
        Row: {
          active: boolean
          client_secret_hash: string
          created_at: string
          id: string
          partner_id: string
          refresh_token_expires_at: string | null
          refresh_token_hash: string | null
          scopes: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_secret_hash: string
          created_at?: string
          id?: string
          partner_id: string
          refresh_token_expires_at?: string | null
          refresh_token_hash?: string | null
          scopes?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_secret_hash?: string
          created_at?: string
          id?: string
          partner_id?: string
          refresh_token_expires_at?: string | null
          refresh_token_hash?: string | null
          scopes?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_webhooks: {
        Row: {
          active: boolean
          created_at: string
          id: string
          jurisdiction: string
          partner_id: string
          regulations: string[]
          updated_at: string
          webhook_url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          jurisdiction?: string
          partner_id: string
          regulations?: string[]
          updated_at?: string
          webhook_url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          jurisdiction?: string
          partner_id?: string
          regulations?: string[]
          updated_at?: string
          webhook_url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_size: string | null
          compliance_role: string
          created_at: string
          data_role: string | null
          id: string
          jurisdiction: string
          sector: string
          updated_at: string
        }
        Insert: {
          company_size?: string | null
          compliance_role: string
          created_at?: string
          data_role?: string | null
          id: string
          jurisdiction: string
          sector: string
          updated_at?: string
        }
        Update: {
          company_size?: string | null
          compliance_role?: string
          created_at?: string
          data_role?: string | null
          id?: string
          jurisdiction?: string
          sector?: string
          updated_at?: string
        }
        Relationships: []
      }
      query_log: {
        Row: {
          answer: string
          citations: Json | null
          created_at: string
          id: string
          latency_ms: number | null
          model: string
          next_steps: Json | null
          question: string
          risk_level: string | null
          user_id: string
        }
        Insert: {
          answer: string
          citations?: Json | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model: string
          next_steps?: Json | null
          question: string
          risk_level?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          citations?: Json | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string
          next_steps?: Json | null
          question?: string
          risk_level?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rag_eval_runs: {
        Row: {
          article_precision: number | null
          created_at: string
          details: Json
          id: string
          label: string
          mrr: number | null
          queries_total: number
          recall_at_10: number | null
          rerank_enabled: boolean
          run_by: string | null
          updated_at: string
        }
        Insert: {
          article_precision?: number | null
          created_at?: string
          details?: Json
          id?: string
          label?: string
          mrr?: number | null
          queries_total?: number
          recall_at_10?: number | null
          rerank_enabled?: boolean
          run_by?: string | null
          updated_at?: string
        }
        Update: {
          article_precision?: number | null
          created_at?: string
          details?: Json
          id?: string
          label?: string
          mrr?: number | null
          queries_total?: number
          recall_at_10?: number | null
          rerank_enabled?: boolean
          run_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rag_golden_queries: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by: string | null
          expected_articles: string[]
          expected_chunk_keys: string[]
          id: string
          notes: string | null
          query_text: string
          regulation: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          expected_articles?: string[]
          expected_chunk_keys?: string[]
          id?: string
          notes?: string | null
          query_text: string
          regulation?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          expected_articles?: string[]
          expected_chunk_keys?: string[]
          id?: string
          notes?: string | null
          query_text?: string
          regulation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      regulatory_requirements: {
        Row: {
          action_cost_eur: number
          action_hours: number
          active: boolean
          article_number: number
          coverage_keywords: string[]
          coverage_threshold: number | null
          created_at: string | null
          description_en: string
          description_it: string
          gap_description_en: string
          gap_description_it: string
          id: string
          min_keyword_matches: number | null
          paragraph: string | null
          rag_validation_keywords: string[]
          recommended_action_en: string
          recommended_action_it: string
          reference: string
          regulation: string
          remediation_effort: string
          requirement_id: string
          risk_level: string
          source: string
          updated_at: string | null
          verified: boolean
        }
        Insert: {
          action_cost_eur?: number
          action_hours?: number
          active?: boolean
          article_number: number
          coverage_keywords?: string[]
          coverage_threshold?: number | null
          created_at?: string | null
          description_en: string
          description_it: string
          gap_description_en: string
          gap_description_it: string
          id?: string
          min_keyword_matches?: number | null
          paragraph?: string | null
          rag_validation_keywords?: string[]
          recommended_action_en: string
          recommended_action_it: string
          reference: string
          regulation: string
          remediation_effort?: string
          requirement_id: string
          risk_level?: string
          source?: string
          updated_at?: string | null
          verified?: boolean
        }
        Update: {
          action_cost_eur?: number
          action_hours?: number
          active?: boolean
          article_number?: number
          coverage_keywords?: string[]
          coverage_threshold?: number | null
          created_at?: string | null
          description_en?: string
          description_it?: string
          gap_description_en?: string
          gap_description_it?: string
          id?: string
          min_keyword_matches?: number | null
          paragraph?: string | null
          rag_validation_keywords?: string[]
          recommended_action_en?: string
          recommended_action_it?: string
          reference?: string
          regulation?: string
          remediation_effort?: string
          requirement_id?: string
          risk_level?: string
          source?: string
          updated_at?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      remediation_workflows: {
        Row: {
          actual_completion_date: string | null
          assessment_id: string | null
          completed_actions: number
          created_at: string
          current_phase: string
          dependencies: Json | null
          id: string
          milestones: Json | null
          orchestration_rules: Json | null
          start_date: string | null
          status: string
          target_completion_date: string | null
          total_actions: number
          updated_at: string
          user_id: string
          workflow_name: string
          workflow_type: string
        }
        Insert: {
          actual_completion_date?: string | null
          assessment_id?: string | null
          completed_actions?: number
          created_at?: string
          current_phase: string
          dependencies?: Json | null
          id?: string
          milestones?: Json | null
          orchestration_rules?: Json | null
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          total_actions?: number
          updated_at?: string
          user_id: string
          workflow_name: string
          workflow_type: string
        }
        Update: {
          actual_completion_date?: string | null
          assessment_id?: string | null
          completed_actions?: number
          created_at?: string
          current_phase?: string
          dependencies?: Json | null
          id?: string
          milestones?: Json | null
          orchestration_rules?: Json | null
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          total_actions?: number
          updated_at?: string
          user_id?: string
          workflow_name?: string
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_workflows_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_register: {
        Row: {
          assessment_id: string | null
          created_at: string
          existing_controls: Json | null
          id: string
          impact: string
          inherent_risk_score: number
          last_review_date: string | null
          likelihood: string
          next_review_date: string | null
          owner: string | null
          residual_risk_score: number
          review_frequency: string
          risk_appetite: string
          risk_category: string
          risk_description: string
          risk_id: string
          risk_title: string
          status: string
          threat_source: string | null
          treatment_plan: string | null
          updated_at: string
          user_id: string
          vulnerability: string | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          existing_controls?: Json | null
          id?: string
          impact: string
          inherent_risk_score: number
          last_review_date?: string | null
          likelihood: string
          next_review_date?: string | null
          owner?: string | null
          residual_risk_score: number
          review_frequency?: string
          risk_appetite: string
          risk_category: string
          risk_description: string
          risk_id: string
          risk_title: string
          status?: string
          threat_source?: string | null
          treatment_plan?: string | null
          updated_at?: string
          user_id: string
          vulnerability?: string | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          existing_controls?: Json | null
          id?: string
          impact?: string
          inherent_risk_score?: number
          last_review_date?: string | null
          likelihood?: string
          next_review_date?: string | null
          owner?: string | null
          residual_risk_score?: number
          review_frequency?: string
          risk_appetite?: string
          risk_category?: string
          risk_description?: string
          risk_id?: string
          risk_title?: string
          status?: string
          threat_source?: string | null
          treatment_plan?: string | null
          updated_at?: string
          user_id?: string
          vulnerability?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_register_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_benchmarks: {
        Row: {
          adoption_percentage: number
          average_compliance_score: number | null
          average_cost_eur: number | null
          best_practices: Json | null
          common_gaps: Json | null
          data_source: string | null
          id: string
          implementation_timeline_days: number | null
          jurisdiction: string
          last_updated: string
          regulation: string
          requirement_reference: string
          sample_size: number | null
          sector: string
        }
        Insert: {
          adoption_percentage: number
          average_compliance_score?: number | null
          average_cost_eur?: number | null
          best_practices?: Json | null
          common_gaps?: Json | null
          data_source?: string | null
          id?: string
          implementation_timeline_days?: number | null
          jurisdiction: string
          last_updated?: string
          regulation: string
          requirement_reference: string
          sample_size?: number | null
          sector: string
        }
        Update: {
          adoption_percentage?: number
          average_compliance_score?: number | null
          average_cost_eur?: number | null
          best_practices?: Json | null
          common_gaps?: Json | null
          data_source?: string | null
          id?: string
          implementation_timeline_days?: number | null
          jurisdiction?: string
          last_updated?: string
          regulation?: string
          requirement_reference?: string
          sample_size?: number | null
          sector?: string
        }
        Relationships: []
      }
      sentinel_monitoring: {
        Row: {
          active: boolean
          alert_threshold: number | null
          created_at: string
          frequency: string
          id: string
          last_scan: string | null
          model_id: string
          next_scan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          alert_threshold?: number | null
          created_at?: string
          frequency: string
          id?: string
          last_scan?: string | null
          model_id: string
          next_scan: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          alert_threshold?: number | null
          created_at?: string
          frequency?: string
          id?: string
          last_scan?: string | null
          model_id?: string
          next_scan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentinel_monitoring_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      structured_chunks: {
        Row: {
          article_number: number | null
          article_reference: string | null
          celex: string | null
          chunk_key: string | null
          chunk_text: string
          citation_label: string | null
          content_hash: string | null
          context_header: string | null
          created_at: string
          cross_references: string[] | null
          document_id: string
          embedding: string | null
          id: string
          is_obligation: boolean | null
          lang: string | null
          letter: string | null
          paragraph: string | null
          regulation: string
          section_hierarchy: string | null
          source_format: string | null
          unit_type: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          article_number?: number | null
          article_reference?: string | null
          celex?: string | null
          chunk_key?: string | null
          chunk_text: string
          citation_label?: string | null
          content_hash?: string | null
          context_header?: string | null
          created_at?: string
          cross_references?: string[] | null
          document_id: string
          embedding?: string | null
          id?: string
          is_obligation?: boolean | null
          lang?: string | null
          letter?: string | null
          paragraph?: string | null
          regulation: string
          section_hierarchy?: string | null
          source_format?: string | null
          unit_type?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          article_number?: number | null
          article_reference?: string | null
          celex?: string | null
          chunk_key?: string | null
          chunk_text?: string
          citation_label?: string | null
          content_hash?: string | null
          context_header?: string | null
          created_at?: string
          cross_references?: string[] | null
          document_id?: string
          embedding?: string | null
          id?: string
          is_obligation?: boolean | null
          lang?: string | null
          letter?: string | null
          paragraph?: string | null
          regulation?: string
          section_hierarchy?: string | null
          source_format?: string | null
          unit_type?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structured_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      tabletop_exercises: {
        Row: {
          acn_compliant: boolean | null
          action_items: Json | null
          completed_at: string | null
          created_at: string
          duration_minutes: number | null
          effectiveness_score: number | null
          facilitator: string | null
          id: string
          injects: Json | null
          lessons_learned: Json | null
          objectives: Json
          participants: Json
          scenario_description: string
          scenario_type: string
          scheduled_date: string | null
          status: string
          timeline: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acn_compliant?: boolean | null
          action_items?: Json | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          effectiveness_score?: number | null
          facilitator?: string | null
          id?: string
          injects?: Json | null
          lessons_learned?: Json | null
          objectives?: Json
          participants?: Json
          scenario_description: string
          scenario_type: string
          scheduled_date?: string | null
          status?: string
          timeline?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acn_compliant?: boolean | null
          action_items?: Json | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          effectiveness_score?: number | null
          facilitator?: string | null
          id?: string
          injects?: Json | null
          lessons_learned?: Json | null
          objectives?: Json
          participants?: Json
          scenario_description?: string
          scenario_type?: string
          scheduled_date?: string | null
          status?: string
          timeline?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_benefits: {
        Row: {
          discount_percentage: number
          has_advanced_analytics: boolean
          has_collaboration_features: boolean
          has_priority_support: boolean
          id: string
          team_size: number
          updated_at: string
          user_id: string
        }
        Insert: {
          discount_percentage?: number
          has_advanced_analytics?: boolean
          has_collaboration_features?: boolean
          has_priority_support?: boolean
          id?: string
          team_size?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          discount_percentage?: number
          has_advanced_analytics?: boolean
          has_collaboration_features?: boolean
          has_priority_support?: boolean
          id?: string
          team_size?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          invited_at: string
          joined_at: string | null
          member_email: string
          member_user_id: string | null
          permissions: Json | null
          role: string
          status: string
          team_owner_id: string
        }
        Insert: {
          id?: string
          invited_at?: string
          joined_at?: string | null
          member_email: string
          member_user_id?: string | null
          permissions?: Json | null
          role: string
          status?: string
          team_owner_id: string
        }
        Update: {
          id?: string
          invited_at?: string
          joined_at?: string | null
          member_email?: string
          member_user_id?: string | null
          permissions?: Json | null
          role?: string
          status?: string
          team_owner_id?: string
        }
        Relationships: []
      }
      training_completions: {
        Row: {
          certificate_issued: boolean | null
          certificate_url: string | null
          completed_at: string | null
          id: string
          progress_percentage: number
          quiz_score: number | null
          started_at: string
          team_member_id: string | null
          training_id: string
          user_id: string
        }
        Insert: {
          certificate_issued?: boolean | null
          certificate_url?: string | null
          completed_at?: string | null
          id?: string
          progress_percentage?: number
          quiz_score?: number | null
          started_at?: string
          team_member_id?: string | null
          training_id: string
          user_id: string
        }
        Update: {
          certificate_issued?: boolean | null
          certificate_url?: string | null
          completed_at?: string | null
          id?: string
          progress_percentage?: number
          quiz_score?: number | null
          started_at?: string
          team_member_id?: string | null
          training_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_completions_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "board_training"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          earned_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          earned_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          achievement_type?: Database["public"]["Enums"]["achievement_type"]
          earned_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_document_embeddings: {
        Row: {
          assessment_id: string
          created_at: string | null
          document_name: string
          document_type: string | null
          embedding: string | null
          id: string
          section_index: number
          section_text: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string | null
          document_name: string
          document_type?: string | null
          embedding?: string | null
          id?: string
          section_index?: number
          section_text: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string | null
          document_name?: string
          document_type?: string | null
          embedding?: string | null
          id?: string
          section_index?: number
          section_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_document_embeddings_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_document: { Args: { doc_id: string }; Returns: boolean }
      cleanup_expired_demo_sessions: { Args: never; Returns: undefined }
      get_table_info: {
        Args: never
        Returns: {
          columns: Json
          table_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
      match_structured_chunks: {
        Args: {
          filter_article_number?: number
          filter_regulation?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          article_number: number
          article_reference: string
          chunk_text: string
          cross_references: string[]
          document_id: string
          id: string
          is_obligation: boolean
          regulation: string
          section_hierarchy: string
          similarity: number
        }[]
      }
      match_structured_chunks_v2: {
        Args: {
          as_of_date?: string
          filter_article_number?: number
          filter_regulation?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          article_number: number
          article_reference: string
          chunk_key: string
          chunk_text: string
          citation_label: string
          context_header: string
          cross_references: string[]
          document_id: string
          id: string
          is_obligation: boolean
          letter: string
          paragraph: string
          regulation: string
          section_hierarchy: string
          similarity: number
          valid_from: string
          valid_to: string
        }[]
      }
      match_user_document_sections: {
        Args: {
          filter_assessment_id: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          document_name: string
          id: string
          section_index: number
          section_text: string
          similarity: number
        }[]
      }
      trigger_news_update: { Args: never; Returns: string }
      update_team_benefits: { Args: { p_user_id: string }; Returns: undefined }
      update_user_streak: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      achievement_type:
        | "first_assessment"
        | "perfect_compliance"
        | "documents_uploaded_10"
        | "documents_uploaded_50"
        | "documents_uploaded_100"
        | "gap_resolved_10"
        | "gap_resolved_50"
        | "week_streak"
        | "month_streak"
        | "team_builder"
        | "compliance_expert"
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      achievement_type: [
        "first_assessment",
        "perfect_compliance",
        "documents_uploaded_10",
        "documents_uploaded_50",
        "documents_uploaded_100",
        "gap_resolved_10",
        "gap_resolved_50",
        "week_streak",
        "month_streak",
        "team_builder",
        "compliance_expert",
      ],
      app_role: ["admin", "user"],
    },
  },
} as const
