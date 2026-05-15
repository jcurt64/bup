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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_broadcast_reads: {
        Row: {
          broadcast_id: string
          clerk_user_id: string
          read_at: string
        }
        Insert: {
          broadcast_id: string
          clerk_user_id: string
          read_at?: string
        }
        Update: {
          broadcast_id?: string
          clerk_user_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_broadcast_reads_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "admin_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_broadcast_recipients: {
        Row: {
          broadcast_id: string
          email: string
          id: string
          open_count: number
          opened_at: string | null
          role: string
          sent_at: string
        }
        Insert: {
          broadcast_id: string
          email: string
          id?: string
          open_count?: number
          opened_at?: string | null
          role: string
          sent_at?: string
        }
        Update: {
          broadcast_id?: string
          email?: string
          id?: string
          open_count?: number
          opened_at?: string | null
          role?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "admin_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_broadcasts: {
        Row: {
          attachment_filename: string | null
          attachment_path: string | null
          audience: Database["public"]["Enums"]["admin_broadcast_audience"]
          body: string
          created_at: string
          created_by_admin_id: string
          id: string
          sent_email_at: string | null
          target_clerk_user_id: string | null
          title: string
          total_recipients: number
        }
        Insert: {
          attachment_filename?: string | null
          attachment_path?: string | null
          audience: Database["public"]["Enums"]["admin_broadcast_audience"]
          body: string
          created_at?: string
          created_by_admin_id: string
          id?: string
          sent_email_at?: string | null
          target_clerk_user_id?: string | null
          title: string
          total_recipients?: number
        }
        Update: {
          attachment_filename?: string | null
          attachment_path?: string | null
          audience?: Database["public"]["Enums"]["admin_broadcast_audience"]
          body?: string
          created_at?: string
          created_by_admin_id?: string
          id?: string
          sent_email_at?: string | null
          target_clerk_user_id?: string | null
          title?: string
          total_recipients?: number
        }
        Relationships: []
      }
      admin_events: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          payload: Json
          pro_account_id: string | null
          prospect_id: string | null
          read_by: Json
          relation_id: string | null
          severity: Database["public"]["Enums"]["admin_event_severity"]
          transaction_id: string | null
          type: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          pro_account_id?: string | null
          prospect_id?: string | null
          read_by?: Json
          relation_id?: string | null
          severity?: Database["public"]["Enums"]["admin_event_severity"]
          transaction_id?: string | null
          type: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          pro_account_id?: string | null
          prospect_id?: string | null
          read_by?: Json
          relation_id?: string | null
          severity?: Database["public"]["Enums"]["admin_event_severity"]
          transaction_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_events_pro_account_id_fkey"
            columns: ["pro_account_id"]
            isOneToOne: false
            referencedRelation: "pro_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_events_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "relations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          id: boolean
          launch_at: string
          updated_at: string | null
        }
        Insert: {
          id?: boolean
          launch_at: string
          updated_at?: string | null
        }
        Update: {
          id?: boolean
          launch_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          auto_resume_at: string | null
          brief: string | null
          budget_cents: number
          budget_reserved_cents: number
          code: string | null
          commission_max_cents: number
          commission_settled_cents: number
          cost_per_contact_cents: number
          created_at: string
          ends_at: string | null
          expiry_warning_sent: boolean
          extended_at: string | null
          extension_paid_cents: number
          extension_used: boolean
          founder_bonus_enabled: boolean
          id: string
          matched_count: number
          name: string
          pause_used: boolean
          paused_at: string | null
          pro_account_id: string
          settled_at: string | null
          spent_cents: number
          starts_at: string
          status: Database["public"]["Enums"]["campaign_status"]
          targeting: Json
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          auto_resume_at?: string | null
          brief?: string | null
          budget_cents: number
          budget_reserved_cents?: number
          code?: string | null
          commission_max_cents?: number
          commission_settled_cents?: number
          cost_per_contact_cents: number
          created_at?: string
          ends_at?: string | null
          expiry_warning_sent?: boolean
          extended_at?: string | null
          extension_paid_cents?: number
          extension_used?: boolean
          founder_bonus_enabled?: boolean
          id?: string
          matched_count?: number
          name: string
          pause_used?: boolean
          paused_at?: string | null
          pro_account_id: string
          settled_at?: string | null
          spent_cents?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          targeting?: Json
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          auto_resume_at?: string | null
          brief?: string | null
          budget_cents?: number
          budget_reserved_cents?: number
          code?: string | null
          commission_max_cents?: number
          commission_settled_cents?: number
          cost_per_contact_cents?: number
          created_at?: string
          ends_at?: string | null
          expiry_warning_sent?: boolean
          extended_at?: string | null
          extension_paid_cents?: number
          extension_used?: boolean
          founder_bonus_enabled?: boolean
          id?: string
          matched_count?: number
          name?: string
          pause_used?: boolean
          paused_at?: string | null
          pro_account_id?: string
          settled_at?: string | null
          spent_cents?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          targeting?: Json
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_pro_account_id_fkey"
            columns: ["pro_account_id"]
            isOneToOne: false
            referencedRelation: "pro_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_pricing: {
        Row: {
          max_campaigns: number
          max_prospects: number
          monthly_cents: number
          plan: Database["public"]["Enums"]["pro_plan"]
          updated_at: string
        }
        Insert: {
          max_campaigns?: number
          max_prospects: number
          monthly_cents: number
          plan: Database["public"]["Enums"]["pro_plan"]
          updated_at?: string
        }
        Update: {
          max_campaigns?: number
          max_prospects?: number
          monthly_cents?: number
          plan?: Database["public"]["Enums"]["pro_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      pro_accounts: {
        Row: {
          adresse: string | null
          billing_status: Database["public"]["Enums"]["pro_billing_status"]
          capital_social_cents: number | null
          clerk_user_id: string
          code_postal: string | null
          created_at: string
          email_tracking_consent: boolean
          email_tracking_consent_given_at: string | null
          forme_juridique: string | null
          id: string
          plan: Database["public"]["Enums"]["pro_plan"]
          plan_cycle_count: number
          raison_sociale: string
          rcs_ville: string | null
          rm_number: string | null
          secteur: string | null
          siren: string | null
          siret: string | null
          stripe_customer_id: string | null
          updated_at: string
          ville: string | null
          wallet_balance_cents: number
          wallet_reserved_cents: number
        }
        Insert: {
          adresse?: string | null
          billing_status?: Database["public"]["Enums"]["pro_billing_status"]
          capital_social_cents?: number | null
          clerk_user_id: string
          code_postal?: string | null
          created_at?: string
          email_tracking_consent?: boolean
          email_tracking_consent_given_at?: string | null
          forme_juridique?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["pro_plan"]
          plan_cycle_count?: number
          raison_sociale: string
          rcs_ville?: string | null
          rm_number?: string | null
          secteur?: string | null
          siren?: string | null
          siret?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          ville?: string | null
          wallet_balance_cents?: number
          wallet_reserved_cents?: number
        }
        Update: {
          adresse?: string | null
          billing_status?: Database["public"]["Enums"]["pro_billing_status"]
          capital_social_cents?: number | null
          clerk_user_id?: string
          code_postal?: string | null
          created_at?: string
          email_tracking_consent?: boolean
          email_tracking_consent_given_at?: string | null
          forme_juridique?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["pro_plan"]
          plan_cycle_count?: number
          raison_sociale?: string
          rcs_ville?: string | null
          rm_number?: string | null
          secteur?: string | null
          siren?: string | null
          siret?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          ville?: string | null
          wallet_balance_cents?: number
          wallet_reserved_cents?: number
        }
        Relationships: []
      }
      pro_contact_actions: {
        Row: {
          campaign_id: string | null
          created_at: string
          email_body: string | null
          email_opened_at: string | null
          email_subject: string | null
          id: string
          kind: Database["public"]["Enums"]["pro_contact_action_kind"]
          pro_account_id: string
          prospect_id: string
          relation_id: string
          tracking_token: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          email_body?: string | null
          email_opened_at?: string | null
          email_subject?: string | null
          id?: string
          kind: Database["public"]["Enums"]["pro_contact_action_kind"]
          pro_account_id: string
          prospect_id: string
          relation_id: string
          tracking_token?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          email_body?: string | null
          email_opened_at?: string | null
          email_subject?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["pro_contact_action_kind"]
          pro_account_id?: string
          prospect_id?: string
          relation_id?: string
          tracking_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_contact_actions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_contact_actions_pro_account_id_fkey"
            columns: ["pro_account_id"]
            isOneToOne: false
            referencedRelation: "pro_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_contact_actions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_contact_actions_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "relations"
            referencedColumns: ["id"]
          },
        ]
      }
      relation_email_aliases: {
        Row: {
          alias_short: string
          created_at: string
          relation_id: string
        }
        Insert: {
          alias_short: string
          created_at?: string
          relation_id: string
        }
        Update: {
          alias_short?: string
          created_at?: string
          relation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relation_email_aliases_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: true
            referencedRelation: "relations"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_contact_reveals: {
        Row: {
          field: string
          id: string
          pro_account_id: string
          relation_id: string
          revealed_at: string
        }
        Insert: {
          field: string
          id?: string
          pro_account_id: string
          relation_id: string
          revealed_at?: string
        }
        Update: {
          field?: string
          id?: string
          pro_account_id?: string
          relation_id?: string
          revealed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_contact_reveals_pro_account_id_fkey"
            columns: ["pro_account_id"]
            isOneToOne: false
            referencedRelation: "pro_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_contact_reveals_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "relations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_identity: {
        Row: {
          email: string | null
          email_tracking_consent: boolean
          email_tracking_consent_given_at: string | null
          genre: string | null
          naissance: string | null
          nom: string | null
          phone_verified_at: string | null
          prenom: string | null
          prospect_id: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          email?: string | null
          email_tracking_consent?: boolean
          email_tracking_consent_given_at?: string | null
          genre?: string | null
          naissance?: string | null
          nom?: string | null
          phone_verified_at?: string | null
          prenom?: string | null
          prospect_id: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          email?: string | null
          email_tracking_consent?: boolean
          email_tracking_consent_given_at?: string | null
          genre?: string | null
          naissance?: string | null
          nom?: string | null
          phone_verified_at?: string | null
          prenom?: string | null
          prospect_id?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_identity_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_localisation: {
        Row: {
          adresse: string | null
          code_postal: string | null
          prospect_id: string
          targeting_radius_km: number
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          prospect_id: string
          targeting_radius_km?: number
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          prospect_id?: string
          targeting_radius_km?: number
          updated_at?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_localisation_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_patrimoine: {
        Row: {
          epargne: string | null
          projets: string | null
          prospect_id: string
          residence: string | null
          updated_at: string
        }
        Insert: {
          epargne?: string | null
          projets?: string | null
          prospect_id: string
          residence?: string | null
          updated_at?: string
        }
        Update: {
          epargne?: string | null
          projets?: string | null
          prospect_id?: string
          residence?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_patrimoine_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_phone_otp: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          phone: string
          prospect_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          phone: string
          prospect_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          phone?: string
          prospect_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_phone_otp_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_pro: {
        Row: {
          poste: string | null
          prospect_id: string
          revenus: string | null
          secteur: string | null
          statut: string | null
          updated_at: string
        }
        Insert: {
          poste?: string | null
          prospect_id: string
          revenus?: string | null
          secteur?: string | null
          statut?: string | null
          updated_at?: string
        }
        Update: {
          poste?: string | null
          prospect_id?: string
          revenus?: string | null
          secteur?: string | null
          statut?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_pro_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_rib: {
        Row: {
          bic: string | null
          created_at: string
          holder_name: string
          iban: string
          prospect_id: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          bic?: string | null
          created_at?: string
          holder_name: string
          iban: string
          prospect_id: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          bic?: string | null
          created_at?: string
          holder_name?: string
          iban?: string
          prospect_id?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_rib_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_score_history: {
        Row: {
          acceptance_pct: number
          completeness_pct: number
          created_at: string
          freshness_pct: number
          prospect_id: string
          score: number
          snapshot_date: string
        }
        Insert: {
          acceptance_pct?: number
          completeness_pct?: number
          created_at?: string
          freshness_pct?: number
          prospect_id: string
          score: number
          snapshot_date: string
        }
        Update: {
          acceptance_pct?: number
          completeness_pct?: number
          created_at?: string
          freshness_pct?: number
          prospect_id?: string
          score?: number
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_score_history_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_vie: {
        Row: {
          animaux: string | null
          animaux_detail: string | null
          foyer: string | null
          logement: string | null
          mobilite: string | null
          prospect_id: string
          sports: string | null
          updated_at: string
          vehicule: string | null
          vehicule_marque: string | null
        }
        Insert: {
          animaux?: string | null
          animaux_detail?: string | null
          foyer?: string | null
          logement?: string | null
          mobilite?: string | null
          prospect_id: string
          sports?: string | null
          updated_at?: string
          vehicule?: string | null
          vehicule_marque?: string | null
        }
        Update: {
          animaux?: string | null
          animaux_detail?: string | null
          foyer?: string | null
          logement?: string | null
          mobilite?: string | null
          prospect_id?: string
          sports?: string | null
          updated_at?: string
          vehicule?: string | null
          vehicule_marque?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_vie_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          all_campaign_types: boolean
          bupp_score: number
          campaign_types: Database["public"]["Enums"]["campaign_type"][]
          categories: string[]
          clerk_user_id: string
          created_at: string
          hidden_tiers: Database["public"]["Enums"]["tier_key"][]
          id: string
          is_founder: boolean
          removed_tiers: Database["public"]["Enums"]["tier_key"][]
          stripe_connect_account_id: string | null
          stripe_details_submitted: boolean
          stripe_payouts_enabled: boolean
          updated_at: string
          verification: Database["public"]["Enums"]["verification_level"]
        }
        Insert: {
          all_campaign_types?: boolean
          bupp_score?: number
          campaign_types?: Database["public"]["Enums"]["campaign_type"][]
          categories?: string[]
          clerk_user_id: string
          created_at?: string
          hidden_tiers?: Database["public"]["Enums"]["tier_key"][]
          id?: string
          is_founder?: boolean
          removed_tiers?: Database["public"]["Enums"]["tier_key"][]
          stripe_connect_account_id?: string | null
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_level"]
        }
        Update: {
          all_campaign_types?: boolean
          bupp_score?: number
          campaign_types?: Database["public"]["Enums"]["campaign_type"][]
          categories?: string[]
          clerk_user_id?: string
          created_at?: string
          hidden_tiers?: Database["public"]["Enums"]["tier_key"][]
          id?: string
          is_founder?: boolean
          removed_tiers?: Database["public"]["Enums"]["tier_key"][]
          stripe_connect_account_id?: string | null
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_level"]
        }
        Relationships: []
      }
      relation_feedback: {
        Row: {
          created_at: string
          id: string
          reason: string
          relation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          relation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          relation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relation_feedback_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "relations"
            referencedColumns: ["id"]
          },
        ]
      }
      relation_reports: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          notified_at: string | null
          notified_by_clerk_id: string | null
          pro_account_id: string
          prospect_id: string
          reason: Database["public"]["Enums"]["relation_report_reason"]
          relation_id: string
          resolved_at: string | null
          resolved_by_clerk_id: string | null
          resolved_note: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          notified_at?: string | null
          notified_by_clerk_id?: string | null
          pro_account_id: string
          prospect_id: string
          reason: Database["public"]["Enums"]["relation_report_reason"]
          relation_id: string
          resolved_at?: string | null
          resolved_by_clerk_id?: string | null
          resolved_note?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          notified_at?: string | null
          notified_by_clerk_id?: string | null
          pro_account_id?: string
          prospect_id?: string
          reason?: Database["public"]["Enums"]["relation_report_reason"]
          relation_id?: string
          resolved_at?: string | null
          resolved_by_clerk_id?: string | null
          resolved_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relation_reports_pro_account_id_fkey"
            columns: ["pro_account_id"]
            isOneToOne: false
            referencedRelation: "pro_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relation_reports_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relation_reports_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: true
            referencedRelation: "relations"
            referencedColumns: ["id"]
          },
        ]
      }
      relations: {
        Row: {
          campaign_id: string
          decided_at: string | null
          escrow_release_at: string | null
          evaluated_at: string | null
          evaluated_by_pro_id: string | null
          evaluation: Database["public"]["Enums"]["relation_evaluation"] | null
          expires_at: string
          founder_bonus_applied: boolean
          founder_vip_bonus_applied: boolean
          id: string
          motif: string
          pro_account_id: string
          prospect_id: string
          reward_cents: number
          sent_at: string
          settled_at: string | null
          status: Database["public"]["Enums"]["relation_status"]
        }
        Insert: {
          campaign_id: string
          decided_at?: string | null
          escrow_release_at?: string | null
          evaluated_at?: string | null
          evaluated_by_pro_id?: string | null
          evaluation?: Database["public"]["Enums"]["relation_evaluation"] | null
          expires_at: string
          founder_bonus_applied?: boolean
          founder_vip_bonus_applied?: boolean
          id?: string
          motif: string
          pro_account_id: string
          prospect_id: string
          reward_cents: number
          sent_at?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["relation_status"]
        }
        Update: {
          campaign_id?: string
          decided_at?: string | null
          escrow_release_at?: string | null
          evaluated_at?: string | null
          evaluated_by_pro_id?: string | null
          evaluation?: Database["public"]["Enums"]["relation_evaluation"] | null
          expires_at?: string
          founder_bonus_applied?: boolean
          founder_vip_bonus_applied?: boolean
          id?: string
          motif?: string
          pro_account_id?: string
          prospect_id?: string
          reward_cents?: number
          sent_at?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["relation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "relations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_evaluated_by_pro_id_fkey"
            columns: ["evaluated_by_pro_id"]
            isOneToOne: false
            referencedRelation: "pro_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_pro_account_id_fkey"
            columns: ["pro_account_id"]
            isOneToOne: false
            referencedRelation: "pro_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          account_kind: Database["public"]["Enums"]["account_kind"]
          amount_cents: number
          campaign_id: string | null
          created_at: string
          description: string
          id: string
          relation_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          account_id: string
          account_kind: Database["public"]["Enums"]["account_kind"]
          amount_cents: number
          campaign_id?: string | null
          created_at?: string
          description: string
          id?: string
          relation_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          account_id?: string
          account_kind?: Database["public"]["Enums"]["account_kind"]
          amount_cents?: number
          campaign_id?: string | null
          created_at?: string
          description?: string
          id?: string
          relation_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "relations"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          interests: string[]
          ip_hash: string | null
          launch_email_sent_at: string | null
          nom: string
          prenom: string
          ref_code: string | null
          referrer_ref_code: string | null
          user_agent: string | null
          ville: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          interests?: string[]
          ip_hash?: string | null
          launch_email_sent_at?: string | null
          nom: string
          prenom: string
          ref_code?: string | null
          referrer_ref_code?: string | null
          user_agent?: string | null
          ville: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          interests?: string[]
          ip_hash?: string | null
          launch_email_sent_at?: string | null
          nom?: string
          prenom?: string
          ref_code?: string | null
          referrer_ref_code?: string | null
          user_agent?: string | null
          ville?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_relation_tx: {
        Args: { p_relation_id: string }
        Returns: undefined
      }
      admin_campaigns_kpis: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      admin_overview_kpis: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      admin_overview_timeseries: {
        Args: { p_end: string; p_start: string }
        Returns: {
          budget_cents: number
          credited_cents: number
          d: string
          pros: number
          prospects: number
          relations_accepted: number
          relations_expired: number
          relations_refused: number
          relations_sent: number
          spent_cents: number
        }[]
      }
      admin_pros_kpis: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      admin_prospects_kpis: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      clerk_user_id: { Args: never; Returns: string }
      close_campaign_settle: {
        Args: { p_campaign_id: string }
        Returns: {
          campaign_id: string
          commission_cents: number
          pro_account_id: string
          released_reserve: number
          rewards_cents: number
        }[]
      }
      count_founder_filleuls: {
        Args: { p_prospect_id: string }
        Returns: number
      }
      is_within_founder_bonus_window: { Args: never; Returns: boolean }
      refund_relation_tx: {
        Args: {
          p_new_status: Database["public"]["Enums"]["relation_status"]
          p_relation_id: string
        }
        Returns: undefined
      }
      settle_ripe_relations: {
        Args: never
        Returns: {
          campaign_id: string
          pro_name: string
          prospect_email: string
          prospect_id: string
          prospect_prenom: string
          relation_id: string
          reward_cents: number
        }[]
      }
      waitlist_stats: {
        Args: never
        Returns: {
          total: number
          villes: number
        }[]
      }
    }
    Enums: {
      account_kind: "prospect" | "pro"
      admin_broadcast_audience: "prospects" | "pros" | "all"
      admin_event_severity: "info" | "warning" | "critical"
      campaign_status: "draft" | "active" | "paused" | "completed" | "canceled"
      campaign_type:
        | "prise_de_contact"
        | "prise_de_rendez_vous"
        | "information_sondage"
        | "devis_chiffrage"
      pro_billing_status: "active" | "past_due" | "canceled" | "trialing"
      pro_contact_action_kind: "call_clicked" | "email_sent"
      pro_plan: "starter" | "pro"
      relation_evaluation: "atteint" | "non_atteint"
      relation_report_reason:
        | "sollicitation_multiple"
        | "faux_compte"
        | "echange_abusif"
      relation_status:
        | "pending"
        | "accepted"
        | "refused"
        | "expired"
        | "settled"
      tier_key: "identity" | "localisation" | "vie" | "pro" | "patrimoine"
      transaction_status: "pending" | "completed" | "failed" | "canceled"
      transaction_type:
        | "credit"
        | "escrow"
        | "withdrawal"
        | "topup"
        | "campaign_charge"
        | "referral_bonus"
        | "refund"
        | "buupp_commission"
      verification_level:
        | "basique"
        | "verifie"
        | "certifie"
        | "confiance"
        | "certifie_confiance"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_kind: ["prospect", "pro"],
      admin_broadcast_audience: ["prospects", "pros", "all"],
      admin_event_severity: ["info", "warning", "critical"],
      campaign_status: ["draft", "active", "paused", "completed", "canceled"],
      campaign_type: [
        "prise_de_contact",
        "prise_de_rendez_vous",
        "information_sondage",
        "devis_chiffrage",
      ],
      pro_billing_status: ["active", "past_due", "canceled", "trialing"],
      pro_contact_action_kind: ["call_clicked", "email_sent"],
      pro_plan: ["starter", "pro"],
      relation_evaluation: ["atteint", "non_atteint"],
      relation_report_reason: [
        "sollicitation_multiple",
        "faux_compte",
        "echange_abusif",
      ],
      relation_status: ["pending", "accepted", "refused", "expired", "settled"],
      tier_key: ["identity", "localisation", "vie", "pro", "patrimoine"],
      transaction_status: ["pending", "completed", "failed", "canceled"],
      transaction_type: [
        "credit",
        "escrow",
        "withdrawal",
        "topup",
        "campaign_charge",
        "referral_bonus",
        "refund",
        "buupp_commission",
      ],
      verification_level: [
        "basique",
        "verifie",
        "certifie",
        "confiance",
        "certifie_confiance",
      ],
    },
  },
} as const
