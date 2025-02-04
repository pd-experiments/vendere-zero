export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ad_metrics: {
        Row: {
          ad_id: string
          clicks: number
          ctr: number | null
          id: string
          impressions: number
        }
        Insert: {
          ad_id: string
          clicks?: number
          ctr?: number | null
          id?: string
          impressions?: number
        }
        Update: {
          ad_id?: string
          clicks?: number
          ctr?: number | null
          id?: string
          impressions?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ad_structured_output"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_structured_output: {
        Row: {
          description_embeddings: string | null
          id: string
          image_description: string
          image_url: string
          name: string | null
          user: string | null
        }
        Insert: {
          description_embeddings?: string | null
          id?: string
          image_description: string
          image_url: string
          name?: string | null
          user?: string | null
        }
        Update: {
          description_embeddings?: string | null
          id?: string
          image_description?: string
          image_url?: string
          name?: string | null
          user?: string | null
        }
        Relationships: []
      }
      features: {
        Row: {
          ad_output_id: string
          category: string
          confidence_score: number
          id: string
          keyword: string
          location: string
          user: string | null
        }
        Insert: {
          ad_output_id: string
          category: string
          confidence_score: number
          id?: string
          keyword: string
          location: string
          user?: string | null
        }
        Update: {
          ad_output_id?: string
          category?: string
          confidence_score?: number
          id?: string
          keyword?: string
          location?: string
          user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "features_ad_output_id_fkey"
            columns: ["ad_output_id"]
            isOneToOne: false
            referencedRelation: "ad_structured_output"
            referencedColumns: ["id"]
          },
        ]
      }
      google_image_ads: {
        Row: {
          advertisement_url: string
          advertiser_name: string | null
          advertiser_url: string | null
          created_at: string | null
          image_url: string | null
          last_shown: string | null
          updated_at: string | null
        }
        Insert: {
          advertisement_url: string
          advertiser_name?: string | null
          advertiser_url?: string | null
          created_at?: string | null
          image_url?: string | null
          last_shown?: string | null
          updated_at?: string | null
        }
        Update: {
          advertisement_url?: string
          advertiser_name?: string | null
          advertiser_url?: string | null
          created_at?: string | null
          image_url?: string | null
          last_shown?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      library_items: {
        Row: {
          avg_sentiment_confidence: number | null
          created_at: string | null
          description: string | null
          features: string[] | null
          id: string
          item_id: string | null
          name: string | null
          preview_url: string | null
          sentiment_tones: string[] | null
          type: Database["public"]["Enums"]["library_item_type"]
          user_id: string | null
        }
        Insert: {
          avg_sentiment_confidence?: number | null
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          item_id?: string | null
          name?: string | null
          preview_url?: string | null
          sentiment_tones?: string[] | null
          type: Database["public"]["Enums"]["library_item_type"]
          user_id?: string | null
        }
        Update: {
          avg_sentiment_confidence?: number | null
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          item_id?: string | null
          name?: string | null
          preview_url?: string | null
          sentiment_tones?: string[] | null
          type?: Database["public"]["Enums"]["library_item_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      sentiment_analysis: {
        Row: {
          ad_output_id: string
          confidence: number
          id: string
          tone: string
          user: string | null
        }
        Insert: {
          ad_output_id: string
          confidence: number
          id?: string
          tone: string
          user?: string | null
        }
        Update: {
          ad_output_id?: string
          confidence?: number
          id?: string
          tone?: string
          user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_analysis_ad_output_id_fkey"
            columns: ["ad_output_id"]
            isOneToOne: false
            referencedRelation: "ad_structured_output"
            referencedColumns: ["id"]
          },
        ]
      }
      video_frames_mapping: {
        Row: {
          created_at: string | null
          frame_id: string
          frame_number: number
          id: string
          user_id: string | null
          video_id: string
          video_timestamp: unknown
        }
        Insert: {
          created_at?: string | null
          frame_id: string
          frame_number: number
          id?: string
          user_id?: string | null
          video_id: string
          video_timestamp: unknown
        }
        Update: {
          created_at?: string | null
          frame_id?: string
          frame_number?: number
          id?: string
          user_id?: string | null
          video_id?: string
          video_timestamp?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "video_frames_mapping_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "ad_structured_output"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_frames_mapping_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          mappings: string[] | null
          name: string
          user_id: string | null
          video_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          mappings?: string[] | null
          name: string
          user_id?: string | null
          video_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          mappings?: string[] | null
          name?: string
          user_id?: string | null
          video_url?: string
        }
        Relationships: []
      }
      visual_attributes: {
        Row: {
          attribute: string
          feature_id: string
          id: string
          value: string
        }
        Insert: {
          attribute: string
          feature_id: string
          id?: string
          value: string
        }
        Update: {
          attribute?: string
          feature_id?: string
          id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_attributes_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fetch_library_items: {
        Args: {
          user_id: string
        }
        Returns: {
          id: string
          type: string
          name: string
          image_url: string
          image_description: string
          features: Json
          sentiment_analysis: Json
          created_at: string
        }[]
      }
      match_ad_descriptions:
        | {
            Args: {
              query_embedding: string
              match_threshold: number
              match_count: number
            }
            Returns: {
              id: string
              name: string
              image_url: string
              image_description: string
              similarity: number
            }[]
          }
        | {
            Args: {
              query_embedding: string
              match_threshold: number
              match_count: number
              user_id: string
            }
            Returns: {
              id: string
              name: string
              image_url: string
              image_description: string
              similarity: number
            }[]
          }
      match_ads: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      library_item_type: "image" | "video"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
