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
      adherence_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          medication_id: string | null
          occurred_at: string
          patient_id: string
          source: string
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          medication_id?: string | null
          occurred_at?: string
          patient_id: string
          source?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          medication_id?: string | null
          occurred_at?: string
          patient_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "adherence_events_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adherence_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_segments: {
        Row: {
          audience_types: string[]
          created_at: string
          description: string
          filters: Json
          id: string
          institution: string
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          audience_types?: string[]
          created_at?: string
          description?: string
          filters?: Json
          id?: string
          institution?: string
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          audience_types?: string[]
          created_at?: string
          description?: string
          filters?: Json
          id?: string
          institution?: string
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string
          birth_date: string | null
          channel_pref: Database["public"]["Enums"]["message_channel"]
          city: string
          cpf: string
          created_at: string
          email: string
          full_name: string
          id: string
          patient_id: string
          phone: string
          receives_reminders: boolean
          relation: string
          state: string
          status: string
        }
        Insert: {
          address?: string
          birth_date?: string | null
          channel_pref?: Database["public"]["Enums"]["message_channel"]
          city?: string
          cpf?: string
          created_at?: string
          email?: string
          full_name: string
          id?: string
          patient_id: string
          phone?: string
          receives_reminders?: boolean
          relation?: string
          state?: string
          status?: string
        }
        Update: {
          address?: string
          birth_date?: string | null
          channel_pref?: Database["public"]["Enums"]["message_channel"]
          city?: string
          cpf?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          patient_id?: string
          phone?: string
          receives_reminders?: boolean
          relation?: string
          state?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      content_library: {
        Row: {
          audience: string
          audience_types: string[]
          body: string
          category: string
          created_at: string
          filters: Json
          id: string
          segment_id: string | null
          targeting_mode: string
          title: string
        }
        Insert: {
          audience?: string
          audience_types?: string[]
          body: string
          category?: string
          created_at?: string
          filters?: Json
          id?: string
          segment_id?: string | null
          targeting_mode?: string
          title: string
        }
        Update: {
          audience?: string
          audience_types?: string[]
          body?: string
          category?: string
          created_at?: string
          filters?: Json
          id?: string
          segment_id?: string | null
          targeting_mode?: string
          title?: string
        }
        Relationships: []
      }
      crm_sync_log: {
        Row: {
          created_at: string
          crm_name: string
          id: string
          payload: Json
          status: string
        }
        Insert: {
          created_at?: string
          crm_name: string
          id?: string
          payload?: Json
          status?: string
        }
        Update: {
          created_at?: string
          crm_name?: string
          id?: string
          payload?: Json
          status?: string
        }
        Relationships: []
      }
      medications: {
        Row: {
          created_at: string
          dose: string
          end_date: string | null
          id: string
          name: string
          patient_id: string
          schedule: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          dose?: string
          end_date?: string | null
          id?: string
          name: string
          patient_id: string
          schedule?: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          dose?: string
          end_date?: string | null
          id?: string
          name?: string
          patient_id?: string
          schedule?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          contact_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          id: string
          patient_id: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          body: string
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          patient_id: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          patient_id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string
          birth_date: string | null
          channel_pref: Database["public"]["Enums"]["message_channel"]
          city: string
          cpf: string
          created_at: string
          email: string
          full_name: string
          id: string
          institution: string
          notes: string | null
          owner_id: string | null
          phone: string
          stage: Database["public"]["Enums"]["patient_stage"]
          state: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string
          birth_date?: string | null
          channel_pref?: Database["public"]["Enums"]["message_channel"]
          city?: string
          cpf?: string
          created_at?: string
          email?: string
          full_name: string
          id?: string
          institution?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string
          stage?: Database["public"]["Enums"]["patient_stage"]
          state?: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          birth_date?: string | null
          channel_pref?: Database["public"]["Enums"]["message_channel"]
          city?: string
          cpf?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          institution?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string
          stage?: Database["public"]["Enums"]["patient_stage"]
          state?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          institution: string
          professional_registry: string
          role_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          institution?: string
          professional_registry?: string
          role_label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          institution?: string
          professional_registry?: string
          role_label?: string
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_patient: {
        Args: { _patient_id: string; _user_id: string }
        Returns: boolean
      }
      get_user_institution: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "equipe"
      message_channel: "whatsapp" | "sms"
      patient_stage: "diagnostico" | "agudo" | "cronico"
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
      app_role: ["admin", "equipe"],
      message_channel: ["whatsapp", "sms"],
      patient_stage: ["diagnostico", "agudo", "cronico"],
    },
  },
} as const
