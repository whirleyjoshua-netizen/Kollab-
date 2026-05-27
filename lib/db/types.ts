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
      leads: {
        Row: {
          business_or_event: string | null
          contacted_at: string | null
          created_at: string
          email: string
          id: string
          interest: Database["public"]["Enums"]["lead_interest"]
          ip_hash: string | null
          message: string | null
          name: string
          source_url: string | null
        }
        Insert: {
          business_or_event?: string | null
          contacted_at?: string | null
          created_at?: string
          email: string
          id?: string
          interest?: Database["public"]["Enums"]["lead_interest"]
          ip_hash?: string | null
          message?: string | null
          name: string
          source_url?: string | null
        }
        Update: {
          business_or_event?: string | null
          contacted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          interest?: Database["public"]["Enums"]["lead_interest"]
          ip_hash?: string | null
          message?: string | null
          name?: string
          source_url?: string | null
        }
        Relationships: []
      }
      owners: {
        Row: {
          accent_color: string
          branding_complete: boolean
          business_name: string
          created_at: string
          cta_text: string | null
          id: string
          logo_path: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          branding_complete?: boolean
          business_name?: string
          created_at?: string
          cta_text?: string | null
          id: string
          logo_path?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          branding_complete?: boolean
          business_name?: string
          created_at?: string
          cta_text?: string | null
          id?: string
          logo_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_default: boolean
          location_label: string | null
          owner_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id: string
          is_default?: boolean
          location_label?: string | null
          owner_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          location_label?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          consent_text_snapshot: string
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          height: number | null
          id: string
          ip_hash: string | null
          location_label_snapshot: string | null
          media_type: Database["public"]["Enums"]["media_type"]
          mime_type: string
          owner_id: string
          processing_status: Database["public"]["Enums"]["video_processing_status"]
          qr_code_id: string
          size_bytes: number | null
          status: Database["public"]["Enums"]["video_status"]
          storage_path: string
          thumbnail_path: string | null
          width: number | null
        }
        Insert: {
          consent_text_snapshot: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          ip_hash?: string | null
          location_label_snapshot?: string | null
          media_type?: Database["public"]["Enums"]["media_type"]
          mime_type: string
          owner_id: string
          processing_status?: Database["public"]["Enums"]["video_processing_status"]
          qr_code_id: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["video_status"]
          storage_path: string
          thumbnail_path?: string | null
          width?: number | null
        }
        Update: {
          consent_text_snapshot?: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          ip_hash?: string | null
          location_label_snapshot?: string | null
          media_type?: Database["public"]["Enums"]["media_type"]
          mime_type?: string
          owner_id?: string
          processing_status?: Database["public"]["Enums"]["video_processing_status"]
          qr_code_id?: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["video_status"]
          storage_path?: string
          thumbnail_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      owner_branding: {
        Row: {
          accent_color: string | null
          branding_complete: boolean | null
          business_name: string | null
          cta_text: string | null
          id: string | null
          logo_path: string | null
        }
        Insert: {
          accent_color?: string | null
          branding_complete?: boolean | null
          business_name?: string | null
          cta_text?: string | null
          id?: string | null
          logo_path?: string | null
        }
        Update: {
          accent_color?: string | null
          branding_complete?: boolean | null
          business_name?: string | null
          cta_text?: string | null
          id?: string | null
          logo_path?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      lead_interest: "restaurant" | "wedding" | "event" | "other"
      media_type: "video" | "photo"
      video_processing_status: "uploading" | "ready" | "failed"
      video_status: "new" | "saved" | "hidden"
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
      lead_interest: ["restaurant", "wedding", "event", "other"],
      media_type: ["video", "photo"],
      video_processing_status: ["uploading", "ready", "failed"],
      video_status: ["new", "saved", "hidden"],
    },
  },
} as const
