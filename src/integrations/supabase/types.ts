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
          authorization_scope: string[]
          authorization_status: string
          authorized_at: string | null
          authorized_by: string | null
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
          revoked_at: string | null
          state: string
          status: string
        }
        Insert: {
          address?: string
          authorization_scope?: string[]
          authorization_status?: string
          authorized_at?: string | null
          authorized_by?: string | null
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
          revoked_at?: string | null
          state?: string
          status?: string
        }
        Update: {
          address?: string
          authorization_scope?: string[]
          authorization_status?: string
          authorized_at?: string | null
          authorized_by?: string | null
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
          revoked_at?: string | null
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
      content_folders: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          icon: string
          id: string
          institution: string
          label: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          icon?: string
          id?: string
          institution: string
          label: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          icon?: string
          id?: string
          institution?: string
          label?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      institution_whatsapp_settings: {
        Row: {
          append_signature_to_text: boolean
          application_display_name: string | null
          brand_name: string | null
          created_at: string
          created_by: string | null
          custom_signature_text: string | null
          default_template_footer_text: string | null
          id: string
          institution: string
          signature_enabled: boolean
          signature_mode: string
          updated_at: string
          updated_by: string | null
          use_as_template_footer_default: boolean
          use_native_interactive_footer: boolean
        }
        Insert: {
          append_signature_to_text?: boolean
          application_display_name?: string | null
          brand_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_signature_text?: string | null
          default_template_footer_text?: string | null
          id?: string
          institution: string
          signature_enabled?: boolean
          signature_mode?: string
          updated_at?: string
          updated_by?: string | null
          use_as_template_footer_default?: boolean
          use_native_interactive_footer?: boolean
        }
        Update: {
          append_signature_to_text?: boolean
          application_display_name?: string | null
          brand_name?: string | null
          created_at?: string
          created_by?: string | null
          custom_signature_text?: string | null
          default_template_footer_text?: string | null
          id?: string
          institution?: string
          signature_enabled?: boolean
          signature_mode?: string
          updated_at?: string
          updated_by?: string | null
          use_as_template_footer_default?: boolean
          use_native_interactive_footer?: boolean
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
      message_batches: {
        Row: {
          audience_types: string[]
          body: string
          channel: string
          content_id: string | null
          created_at: string
          created_by: string | null
          filters: Json
          finished_at: string | null
          id: string
          institution: string
          last_error: string | null
          name: string
          segment_id: string | null
          started_at: string | null
          status: string
          targeting_mode: string
          template_id: string | null
          total_recipients: number
        }
        Insert: {
          audience_types?: string[]
          body?: string
          channel?: string
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          filters?: Json
          finished_at?: string | null
          id?: string
          institution?: string
          last_error?: string | null
          name?: string
          segment_id?: string | null
          started_at?: string | null
          status?: string
          targeting_mode?: string
          template_id?: string | null
          total_recipients?: number
        }
        Update: {
          audience_types?: string[]
          body?: string
          channel?: string
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          filters?: Json
          finished_at?: string | null
          id?: string
          institution?: string
          last_error?: string | null
          name?: string
          segment_id?: string | null
          started_at?: string | null
          status?: string
          targeting_mode?: string
          template_id?: string | null
          total_recipients?: number
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          audience_types: string[]
          body: string
          body_contact: string | null
          body_patient: string | null
          body_segment: string | null
          category: string
          channel: string
          created_at: string
          created_by: string | null
          description: string
          filters: Json
          id: string
          institution: string
          is_active: boolean
          is_default: boolean
          last_synced_at: string | null
          meta_authentication_config: Json | null
          meta_body_parameter_order: Json | null
          meta_buttons: Json | null
          meta_carousel_cards: Json | null
          meta_category: string | null
          meta_definition: Json | null
          meta_footer_source: string | null
          meta_footer_text: string | null
          meta_has_local_differences: boolean
          meta_header_parameter_order: Json | null
          meta_header_text: string | null
          meta_header_type: string | null
          meta_language: string
          meta_last_synced_at: string | null
          meta_parameter_order: Json
          meta_parent_template_id: string | null
          meta_rejection_reason: string | null
          meta_status: string
          meta_template_id: string | null
          meta_template_name: string | null
          meta_version: number | null
          name: string
          rejection_reason: string | null
          segment_id: string | null
          targeting_mode: string
          template_kind: string
          updated_at: string
          variables: Json
        }
        Insert: {
          audience_types?: string[]
          body: string
          body_contact?: string | null
          body_patient?: string | null
          body_segment?: string | null
          category?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string
          filters?: Json
          id?: string
          institution?: string
          is_active?: boolean
          is_default?: boolean
          last_synced_at?: string | null
          meta_authentication_config?: Json | null
          meta_body_parameter_order?: Json | null
          meta_buttons?: Json | null
          meta_carousel_cards?: Json | null
          meta_category?: string | null
          meta_definition?: Json | null
          meta_footer_source?: string | null
          meta_footer_text?: string | null
          meta_has_local_differences?: boolean
          meta_header_parameter_order?: Json | null
          meta_header_text?: string | null
          meta_header_type?: string | null
          meta_language?: string
          meta_last_synced_at?: string | null
          meta_parameter_order?: Json
          meta_parent_template_id?: string | null
          meta_rejection_reason?: string | null
          meta_status?: string
          meta_template_id?: string | null
          meta_template_name?: string | null
          meta_version?: number | null
          name: string
          rejection_reason?: string | null
          segment_id?: string | null
          targeting_mode?: string
          template_kind?: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          audience_types?: string[]
          body?: string
          body_contact?: string | null
          body_patient?: string | null
          body_segment?: string | null
          category?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string
          filters?: Json
          id?: string
          institution?: string
          is_active?: boolean
          is_default?: boolean
          last_synced_at?: string | null
          meta_authentication_config?: Json | null
          meta_body_parameter_order?: Json | null
          meta_buttons?: Json | null
          meta_carousel_cards?: Json | null
          meta_category?: string | null
          meta_definition?: Json | null
          meta_footer_source?: string | null
          meta_footer_text?: string | null
          meta_has_local_differences?: boolean
          meta_header_parameter_order?: Json | null
          meta_header_text?: string | null
          meta_header_type?: string | null
          meta_language?: string
          meta_last_synced_at?: string | null
          meta_parameter_order?: Json
          meta_parent_template_id?: string | null
          meta_rejection_reason?: string | null
          meta_status?: string
          meta_template_id?: string | null
          meta_template_name?: string | null
          meta_version?: number | null
          name?: string
          rejection_reason?: string | null
          segment_id?: string | null
          targeting_mode?: string
          template_kind?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_meta_parent_template_id_fkey"
            columns: ["meta_parent_template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          batch_id: string | null
          body: string
          branding_settings_snapshot: Json | null
          channel: Database["public"]["Enums"]["message_channel"]
          contact_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          direction: string
          external_message_id: string | null
          failed_at: string | null
          footer_delivery_mode: string | null
          id: string
          interaction_id: string | null
          interaction_title: string | null
          interaction_type: string | null
          last_error: string | null
          location_data: Json | null
          media_asset_id: string | null
          media_filename: string | null
          media_mime_type: string | null
          message_content_type: string | null
          message_type: string | null
          patient_id: string
          provider: string | null
          queued_at: string | null
          raw_message_type: string | null
          reaction_emoji: string | null
          read_at: string | null
          rendered_body: string | null
          resolved_footer_text: string | null
          scheduled_for: string | null
          send_attempts: number
          sent_at: string | null
          status: string
          template_id: string | null
          template_name: string | null
          template_variables: Json
        }
        Insert: {
          batch_id?: string | null
          body: string
          branding_settings_snapshot?: Json | null
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          direction?: string
          external_message_id?: string | null
          failed_at?: string | null
          footer_delivery_mode?: string | null
          id?: string
          interaction_id?: string | null
          interaction_title?: string | null
          interaction_type?: string | null
          last_error?: string | null
          location_data?: Json | null
          media_asset_id?: string | null
          media_filename?: string | null
          media_mime_type?: string | null
          message_content_type?: string | null
          message_type?: string | null
          patient_id: string
          provider?: string | null
          queued_at?: string | null
          raw_message_type?: string | null
          reaction_emoji?: string | null
          read_at?: string | null
          rendered_body?: string | null
          resolved_footer_text?: string | null
          scheduled_for?: string | null
          send_attempts?: number
          sent_at?: string | null
          status?: string
          template_id?: string | null
          template_name?: string | null
          template_variables?: Json
        }
        Update: {
          batch_id?: string | null
          body?: string
          branding_settings_snapshot?: Json | null
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          direction?: string
          external_message_id?: string | null
          failed_at?: string | null
          footer_delivery_mode?: string | null
          id?: string
          interaction_id?: string | null
          interaction_title?: string | null
          interaction_type?: string | null
          last_error?: string | null
          location_data?: Json | null
          media_asset_id?: string | null
          media_filename?: string | null
          media_mime_type?: string | null
          message_content_type?: string | null
          message_type?: string | null
          patient_id?: string
          provider?: string | null
          queued_at?: string | null
          raw_message_type?: string | null
          reaction_emoji?: string | null
          read_at?: string | null
          rendered_body?: string | null
          resolved_footer_text?: string | null
          scheduled_for?: string | null
          send_attempts?: number
          sent_at?: string | null
          status?: string
          template_id?: string | null
          template_name?: string | null
          template_variables?: Json
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
          allergies: string
          birth_date: string | null
          blood_type: string | null
          channel_pref: Database["public"]["Enums"]["message_channel"]
          city: string
          clinical_form: string | null
          comorbidities: string
          cpf: string
          created_at: string
          current_medications: string
          diagnosis_date: string | null
          email: string
          full_name: string
          height_cm: number | null
          id: string
          institution: string
          notes: string | null
          owner_id: string | null
          phone: string
          stage: Database["public"]["Enums"]["patient_stage"]
          state: string
          status: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          address?: string
          allergies?: string
          birth_date?: string | null
          blood_type?: string | null
          channel_pref?: Database["public"]["Enums"]["message_channel"]
          city?: string
          clinical_form?: string | null
          comorbidities?: string
          cpf?: string
          created_at?: string
          current_medications?: string
          diagnosis_date?: string | null
          email?: string
          full_name: string
          height_cm?: number | null
          id?: string
          institution?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string
          stage?: Database["public"]["Enums"]["patient_stage"]
          state?: string
          status?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          address?: string
          allergies?: string
          birth_date?: string | null
          blood_type?: string | null
          channel_pref?: Database["public"]["Enums"]["message_channel"]
          city?: string
          clinical_form?: string | null
          comorbidities?: string
          cpf?: string
          created_at?: string
          current_medications?: string
          diagnosis_date?: string | null
          email?: string
          full_name?: string
          height_cm?: number | null
          id?: string
          institution?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string
          stage?: Database["public"]["Enums"]["patient_stage"]
          state?: string
          status?: string
          updated_at?: string
          weight_kg?: number | null
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
      whatsapp_conversations: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          identity_id: string
          institution: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_outbound_at: string | null
          patient_id: string | null
          service_window_expires_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          identity_id: string
          institution: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_outbound_at?: string | null
          patient_id?: string | null
          service_window_expires_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          identity_id?: string
          institution?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_outbound_at?: string | null
          patient_id?: string | null
          service_window_expires_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_identities: {
        Row: {
          allowed_purposes: string[]
          contact_id: string | null
          created_at: string
          display_name: string | null
          id: string
          institution: string
          is_active: boolean
          opt_in_at: string | null
          opt_in_notice_version: string | null
          opt_in_source: string | null
          opt_in_status: string
          opt_out_at: string | null
          patient_id: string | null
          phone_e164: string
          recipient_type: string
          updated_at: string
          wa_id: string | null
        }
        Insert: {
          allowed_purposes?: string[]
          contact_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          institution: string
          is_active?: boolean
          opt_in_at?: string | null
          opt_in_notice_version?: string | null
          opt_in_source?: string | null
          opt_in_status?: string
          opt_out_at?: string | null
          patient_id?: string | null
          phone_e164: string
          recipient_type?: string
          updated_at?: string
          wa_id?: string | null
        }
        Update: {
          allowed_purposes?: string[]
          contact_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          institution?: string
          is_active?: boolean
          opt_in_at?: string | null
          opt_in_notice_version?: string | null
          opt_in_source?: string | null
          opt_in_status?: string
          opt_out_at?: string | null
          patient_id?: string | null
          phone_e164?: string
          recipient_type?: string
          updated_at?: string
          wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_identities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_identities_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_media_assets: {
        Row: {
          created_at: string
          created_by: string | null
          direction: string
          expires_at: string | null
          filename: string | null
          id: string
          institution: string
          media_type: string
          meta_media_id: string | null
          mime_type: string
          sha256: string | null
          size_bytes: number | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direction?: string
          expires_at?: string | null
          filename?: string | null
          id?: string
          institution: string
          media_type: string
          meta_media_id?: string | null
          mime_type: string
          sha256?: string | null
          size_bytes?: number | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direction?: string
          expires_at?: string | null
          filename?: string | null
          id?: string
          institution?: string
          media_type?: string
          meta_media_id?: string | null
          mime_type?: string
          sha256?: string | null
          size_bytes?: number | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          code_length: number
          contact_id: string | null
          created_at: string
          expires_at: string
          id: string
          identity_id: string | null
          institution: string
          issued_at: string
          max_attempts: number
          message_id: string | null
          otp_type: string
          patient_id: string | null
          purpose: string
          status: string
          template_id: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          code_length?: number
          contact_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          identity_id?: string | null
          institution: string
          issued_at?: string
          max_attempts?: number
          message_id?: string | null
          otp_type?: string
          patient_id?: string | null
          purpose?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          code_length?: number
          contact_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          identity_id?: string | null
          institution?: string
          issued_at?: string
          max_attempts?: number
          message_id?: string | null
          otp_type?: string
          patient_id?: string | null
          purpose?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_otp_codes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_otp_codes_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_otp_codes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_otp_codes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_otp_codes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_unmatched_events: {
        Row: {
          created_at: string
          event_type: string
          external_message_id: string | null
          id: string
          institution: string | null
          linked_identity_id: string | null
          phone_e164: string | null
          received_at: string
          status: string
          updated_at: string
          wa_id: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string
          external_message_id?: string | null
          id?: string
          institution?: string | null
          linked_identity_id?: string | null
          phone_e164?: string | null
          received_at?: string
          status?: string
          updated_at?: string
          wa_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          external_message_id?: string | null
          id?: string
          institution?: string | null
          linked_identity_id?: string | null
          phone_e164?: string | null
          received_at?: string
          status?: string
          updated_at?: string
          wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_unmatched_events_linked_identity_id_fkey"
            columns: ["linked_identity_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_identities"
            referencedColumns: ["id"]
          },
        ]
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
      mark_expired_whatsapp_media: { Args: never; Returns: number }
      whatsapp_window_open: { Args: { _identity_id: string }; Returns: boolean }
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
