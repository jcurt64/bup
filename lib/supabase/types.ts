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
      campaigns: {
        Row: {
          brief: string | null
          budget_cents: number
          cost_per_contact_cents: number
          created_at: string
          ends_at: string | null
          expiry_warning_sent: boolean
          id: string
          matched_count: number
          name: string
          pro_account_id: string
          spent_cents: number
          starts_at: string
          status: Database["public"]["Enums"]["campaign_status"]
          targeting: Json
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          brief?: string | null
          budget_cents: number
          cost_per_contact_cents: number
          created_at?: string
          ends_at?: string | null
          expiry_warning_sent?: boolean
          id?: string
          matched_count?: number
          name: string
          pro_account_id: string
          spent_cents?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          targeting?: Json
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          brief?: string | null
          budget_cents?: number
          cost_per_contact_cents?: number
          created_at?: string
          ends_at?: string | null
          expiry_warning_sent?: boolean
          id?: string
          matched_count?: number
          name?: string
          pro_account_id?: string
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
          max_prospects: number
          monthly_cents: number
          plan: Database["public"]["Enums"]["pro_plan"]
          updated_at: string
        }
        Insert: {
          max_prospects: number
          monthly_cents: number
          plan: Database["public"]["Enums"]["pro_plan"]
          updated_at?: string
        }
        Update: {
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
          clerk_user_id: string
          code_postal: string | null
          created_at: string
          id: string
          plan: Database["public"]["Enums"]["pro_plan"]
          raison_sociale: string
          secteur: string | null
          siren: string | null
          stripe_customer_id: string | null
          updated_at: string
          ville: string | null
          wallet_balance_cents: number
        }
        Insert: {
          adresse?: string | null
          billing_status?: Database["public"]["Enums"]["pro_billing_status"]
          clerk_user_id: string
          code_postal?: string | null
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["pro_plan"]
          raison_sociale: string
          secteur?: string | null
          siren?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          ville?: string | null
          wallet_balance_cents?: number
        }
        Update: {
          adresse?: string | null
          billing_status?: Database["public"]["Enums"]["pro_billing_status"]
          clerk_user_id?: string
          code_postal?: string | null
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["pro_plan"]
          raison_sociale?: string
          secteur?: string | null
          siren?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          ville?: string | null
          wallet_balance_cents?: number
        }
        Relationships: []
      }
      prospect_identity: {
        Row: {
          email: string | null
          genre: string | null
          naissance: string | null
          nom: string | null
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
          logement: string | null
          mobilite: string | null
          prospect_id: string
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          logement?: string | null
          mobilite?: string | null
          prospect_id: string
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          logement?: string | null
          mobilite?: string | null
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
          foyer: string | null
          prospect_id: string
          sports: string | null
          updated_at: string
          vehicule: string | null
        }
        Insert: {
          animaux?: string | null
          foyer?: string | null
          prospect_id: string
          sports?: string | null
          updated_at?: string
          vehicule?: string | null
        }
        Update: {
          animaux?: string | null
          foyer?: string | null
          prospect_id?: string
          sports?: string | null
          updated_at?: string
          vehicule?: string | null
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
          expires_at: string
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
          expires_at: string
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
          expires_at?: string
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
