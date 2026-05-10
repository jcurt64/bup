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
      admin_events: {
        Row: {
          id: string
          type: string
          severity: Database["public"]["Enums"]["admin_event_severity"]
          payload: Json
          prospect_id: string | null
          pro_account_id: string | null
          campaign_id: string | null
          relation_id: string | null
          transaction_id: string | null
          read_by: Json
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          severity?: Database["public"]["Enums"]["admin_event_severity"]
          payload?: Json
          prospect_id?: string | null
          pro_account_id?: string | null
          campaign_id?: string | null
          relation_id?: string | null
          transaction_id?: string | null
          read_by?: Json
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          severity?: Database["public"]["Enums"]["admin_event_severity"]
          payload?: Json
          prospect_id?: string | null
          pro_account_id?: string | null
          campaign_id?: string | null
          relation_id?: string | null
          transaction_id?: string | null
          read_by?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
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
            foreignKeyName: "admin_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
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
          }
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
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          prospect_id: string
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          prospect_id?: string
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
      relations: {
        Row: {
          campaign_id: string
          decided_at: string | null
          escrow_release_at: string | null
          expires_at: string
          founder_bonus_applied: boolean
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
          expires_at: string
          founder_bonus_applied?: boolean
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
          expires_at?: string
          founder_bonus_applied?: boolean
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
      clerk_user_id: { Args: never; Returns: string }
      is_within_founder_bonus_window: {
        Args: never
        Returns: boolean
      }
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
      admin_event_severity: "info" | "warning" | "critical"
      account_kind: "prospect" | "pro"
      campaign_status: "draft" | "active" | "paused" | "completed" | "canceled"
      campaign_type:
        | "prise_de_contact"
        | "prise_de_rendez_vous"
        | "information_sondage"
        | "devis_chiffrage"
      pro_billing_status: "active" | "past_due" | "canceled" | "trialing"
      pro_plan: "starter" | "pro"
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
  public: {
    Enums: {
      account_kind: ["prospect", "pro"],
      campaign_status: ["draft", "active", "paused", "completed", "canceled"],
      campaign_type: [
        "prise_de_contact",
        "prise_de_rendez_vous",
        "information_sondage",
        "devis_chiffrage",
      ],
      pro_billing_status: ["active", "past_due", "canceled", "trialing"],
      pro_plan: ["starter", "pro"],
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
