export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      booking_windows: {
        Row: {
          club_id: string
          created_at: string
          ends_date: string | null
          ends_time: string | null
          green_id: string | null
          id: string
          is_closure: boolean
          label: string | null
          starts_date: string | null
          starts_time: string | null
          updated_at: string
          weekday: number | null
        }
        Insert: {
          club_id: string
          created_at?: string
          ends_date?: string | null
          ends_time?: string | null
          green_id?: string | null
          id?: string
          is_closure?: boolean
          label?: string | null
          starts_date?: string | null
          starts_time?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          club_id?: string
          created_at?: string
          ends_date?: string | null
          ends_time?: string | null
          green_id?: string | null
          id?: string
          is_closure?: boolean
          label?: string | null
          starts_date?: string | null
          starts_time?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_windows_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_windows_green_id_fkey"
            columns: ["green_id"]
            isOneToOne: false
            referencedRelation: "greens"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booked_by: string | null
          club_id: string
          created_at: string
          ends_at: string
          id: string
          match_id: string | null
          notes: string | null
          party_size: number | null
          purpose: Database["public"]["Enums"]["booking_purpose"]
          rink_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          booked_by?: string | null
          club_id: string
          created_at?: string
          ends_at: string
          id?: string
          match_id?: string | null
          notes?: string | null
          party_size?: number | null
          purpose?: Database["public"]["Enums"]["booking_purpose"]
          rink_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          booked_by?: string | null
          club_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          match_id?: string | null
          notes?: string | null
          party_size?: number | null
          purpose?: Database["public"]["Enums"]["booking_purpose"]
          rink_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rink_id_fkey"
            columns: ["rink_id"]
            isOneToOne: false
            referencedRelation: "rinks"
            referencedColumns: ["id"]
          },
        ]
      }
      club_admin_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          club_id: string
          created_at: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          club_id: string
          created_at?: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          club_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_admin_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_admin_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_admin_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_memberships: {
        Row: {
          club_grading: Database["public"]["Enums"]["player_position"] | null
          club_id: string
          created_at: string
          id: string
          is_primary: boolean
          joined_at: string
          membership_number: string | null
          profile_id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        Insert: {
          club_grading?: Database["public"]["Enums"]["player_position"] | null
          club_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          joined_at?: string
          membership_number?: string | null
          profile_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Update: {
          club_grading?: Database["public"]["Enums"]["player_position"] | null
          club_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          joined_at?: string
          membership_number?: string | null
          profile_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          active: boolean
          city: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          district_id: string
          handicap_enabled: boolean
          id: string
          logo_url: string | null
          name: string
          short_name: string | null
          slug: string
          theme_preset: Database["public"]["Enums"]["club_theme_preset"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          city: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          district_id: string
          handicap_enabled?: boolean
          id?: string
          logo_url?: string | null
          name: string
          short_name?: string | null
          slug: string
          theme_preset?: Database["public"]["Enums"]["club_theme_preset"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          district_id?: string
          handicap_enabled?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
          slug?: string
          theme_preset?: Database["public"]["Enums"]["club_theme_preset"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted: boolean
          accepted_at: string
          created_at: string
          id: string
          ip_address: unknown
          kind: Database["public"]["Enums"]["consent_type"]
          profile_id: string
          user_agent: string | null
          version: string
        }
        Insert: {
          accepted?: boolean
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          kind: Database["public"]["Enums"]["consent_type"]
          profile_id: string
          user_agent?: string | null
          version: string
        }
        Update: {
          accepted?: boolean
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          kind?: Database["public"]["Enums"]["consent_type"]
          profile_id?: string
          user_agent?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          created_at: string
          id: string
          name: string
          province: string
          short_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          province: string
          short_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          province?: string
          short_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      greens: {
        Row: {
          active: boolean
          club_id: string
          created_at: string
          id: string
          name: string
          rink_count: number
          surface: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          club_id: string
          created_at?: string
          id?: string
          name: string
          rink_count?: number
          surface?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          club_id?: string
          created_at?: string
          id?: string
          name?: string
          rink_count?: number
          surface?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "greens_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_profile_id: string | null
          club_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          note: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["invite_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          club_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          note?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          club_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          note?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_accepted_profile_id_fkey"
            columns: ["accepted_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_ends: {
        Row: {
          away_shots: number
          end_number: number
          home_shots: number
          id: string
          match_id: string
          notes: string | null
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          away_shots?: number
          end_number: number
          home_shots?: number
          id?: string
          match_id: string
          notes?: string | null
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          away_shots?: number
          end_number?: number
          home_shots?: number
          id?: string
          match_id?: string
          notes?: string | null
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_ends_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_ends_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_ends_won: number
          away_shots: number
          away_team_id: string | null
          bracket_slot: number | null
          created_at: string
          ends_at: string | null
          home_ends_won: number
          home_shots: number
          home_team_id: string | null
          id: string
          notes: string | null
          rink_id: string | null
          round: number | null
          section_label: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          tournament_id: string
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          away_ends_won?: number
          away_shots?: number
          away_team_id?: string | null
          bracket_slot?: number | null
          created_at?: string
          ends_at?: string | null
          home_ends_won?: number
          home_shots?: number
          home_team_id?: string | null
          id?: string
          notes?: string | null
          rink_id?: string | null
          round?: number | null
          section_label?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          away_ends_won?: number
          away_shots?: number
          away_team_id?: string | null
          bracket_slot?: number | null
          created_at?: string
          ends_at?: string | null
          home_ends_won?: number
          home_shots?: number
          home_team_id?: string | null
          id?: string
          notes?: string | null
          rink_id?: string | null
          round?: number | null
          section_label?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id?: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_rink_id_fkey"
            columns: ["rink_id"]
            isOneToOne: false
            referencedRelation: "rinks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          created_at: string
          email_address: string | null
          email_error: string | null
          email_sent_at: string | null
          email_status: string | null
          id: string
          in_app_status: Database["public"]["Enums"]["message_recipient_status"]
          message_id: string
          profile_id: string
          read_at: string | null
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          email_address?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          id?: string
          in_app_status?: Database["public"]["Enums"]["message_recipient_status"]
          message_id: string
          profile_id: string
          read_at?: string | null
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          email_address?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          id?: string
          in_app_status?: Database["public"]["Enums"]["message_recipient_status"]
          message_id?: string
          profile_id?: string
          read_at?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audience_kind: string
          audience_profile_ids: string[]
          audience_tournament_id: string | null
          body_md: string
          club_id: string
          created_at: string
          id: string
          recipient_count: number
          scheduled_at: string | null
          send_email: boolean
          send_in_app: boolean
          sender_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          audience_kind?: string
          audience_profile_ids?: string[]
          audience_tournament_id?: string | null
          body_md: string
          club_id: string
          created_at?: string
          id?: string
          recipient_count?: number
          scheduled_at?: string | null
          send_email?: boolean
          send_in_app?: boolean
          sender_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          audience_kind?: string
          audience_profile_ids?: string[]
          audience_tournament_id?: string | null
          body_md?: string
          club_id?: string
          created_at?: string
          id?: string
          recipient_count?: number
          scheduled_at?: string | null
          send_email?: boolean
          send_in_app?: boolean
          sender_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_audience_tournament_id_fkey"
            columns: ["audience_tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          club_id: string | null
          created_at: string
          id: string
          kind: string
          profile_id: string
          read: boolean
          read_at: string | null
          related_id: string | null
          related_kind: string | null
          title: string
        }
        Insert: {
          body?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          kind: string
          profile_id: string
          read?: boolean
          read_at?: string | null
          related_id?: string | null
          related_kind?: string | null
          title: string
        }
        Update: {
          body?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          profile_id?: string
          read?: boolean
          read_at?: string | null
          related_id?: string | null
          related_kind?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bsa_number: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          dominant_hand: Database["public"]["Enums"]["dominant_hand"] | null
          email: string | null
          email_opt_in: boolean
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          handicap: number
          id: string
          last_name: string | null
          novice_registered_at: string | null
          phone: string | null
          profile_completed: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bsa_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          dominant_hand?: Database["public"]["Enums"]["dominant_hand"] | null
          email?: string | null
          email_opt_in?: boolean
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          handicap?: number
          id: string
          last_name?: string | null
          novice_registered_at?: string | null
          phone?: string | null
          profile_completed?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bsa_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          dominant_hand?: Database["public"]["Enums"]["dominant_hand"] | null
          email?: string | null
          email_opt_in?: boolean
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          handicap?: number
          id?: string
          last_name?: string | null
          novice_registered_at?: string | null
          phone?: string | null
          profile_completed?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rinks: {
        Row: {
          active: boolean
          created_at: string
          green_id: string
          id: string
          number: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          green_id: string
          id?: string
          number: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          green_id?: string
          id?: string
          number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rinks_green_id_fkey"
            columns: ["green_id"]
            isOneToOne: false
            referencedRelation: "greens"
            referencedColumns: ["id"]
          },
        ]
      }
      t20_assessments: {
        Row: {
          assessed_on: string
          assessor_accreditation_id: string | null
          assessor_id: string
          club_id: string
          created_at: string
          grade: Database["public"]["Enums"]["t20_grade"] | null
          green_speed: number | null
          green_type: string | null
          id: string
          notes: string | null
          pdf_url: string | null
          percentage: number
          profile_id: string
          rubric_version_id: string
          second_marker_name: string | null
          status: string
          submitted_at: string | null
          total_score: number
          updated_at: string
        }
        Insert: {
          assessed_on?: string
          assessor_accreditation_id?: string | null
          assessor_id: string
          club_id: string
          created_at?: string
          grade?: Database["public"]["Enums"]["t20_grade"] | null
          green_speed?: number | null
          green_type?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          percentage?: number
          profile_id: string
          rubric_version_id: string
          second_marker_name?: string | null
          status?: string
          submitted_at?: string | null
          total_score?: number
          updated_at?: string
        }
        Update: {
          assessed_on?: string
          assessor_accreditation_id?: string | null
          assessor_id?: string
          club_id?: string
          created_at?: string
          grade?: Database["public"]["Enums"]["t20_grade"] | null
          green_speed?: number | null
          green_type?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          percentage?: number
          profile_id?: string
          rubric_version_id?: string
          second_marker_name?: string | null
          status?: string
          submitted_at?: string | null
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "t20_assessments_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t20_assessments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t20_assessments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t20_assessments_rubric_version_id_fkey"
            columns: ["rubric_version_id"]
            isOneToOne: false
            referencedRelation: "t20_rubric_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      t20_deliveries: {
        Row: {
          assessment_id: string
          created_at: string
          delivery_index: number
          distance_m: number | null
          hand: string | null
          id: string
          outcome: Json
          points: number
          round: number
          section: Database["public"]["Enums"]["t20_section"]
        }
        Insert: {
          assessment_id: string
          created_at?: string
          delivery_index: number
          distance_m?: number | null
          hand?: string | null
          id?: string
          outcome?: Json
          points?: number
          round: number
          section: Database["public"]["Enums"]["t20_section"]
        }
        Update: {
          assessment_id?: string
          created_at?: string
          delivery_index?: number
          distance_m?: number | null
          hand?: string | null
          id?: string
          outcome?: Json
          points?: number
          round?: number
          section?: Database["public"]["Enums"]["t20_section"]
        }
        Relationships: [
          {
            foreignKeyName: "t20_deliveries_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "t20_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      t20_rubric_versions: {
        Row: {
          activated_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          rubric: Json
          updated_at: string
          version: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          rubric: Json
          updated_at?: string
          version: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          rubric?: Json
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "t20_rubric_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_entries: {
        Row: {
          club_id: string
          created_at: string
          id: string
          notes: string | null
          profile_id: string | null
          seed: number | null
          team_name: string | null
          tournament_id: string
          updated_at: string
          withdrawn: boolean
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string | null
          seed?: number | null
          team_name?: string | null
          tournament_id: string
          updated_at?: string
          withdrawn?: boolean
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string | null
          seed?: number | null
          team_name?: string | null
          tournament_id?: string
          updated_at?: string
          withdrawn?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_team_members: {
        Row: {
          bowl_order: number | null
          created_at: string
          id: string
          position: Database["public"]["Enums"]["player_position"]
          profile_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          bowl_order?: number | null
          created_at?: string
          id?: string
          position: Database["public"]["Enums"]["player_position"]
          profile_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          bowl_order?: number | null
          created_at?: string
          id?: string
          position?: Database["public"]["Enums"]["player_position"]
          profile_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_teams: {
        Row: {
          club_id: string | null
          created_at: string
          handicap_shots: number
          id: string
          name: string | null
          section_label: string | null
          seed: number | null
          tournament_id: string
          updated_at: string
          withdrawn: boolean
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          handicap_shots?: number
          id?: string
          name?: string | null
          section_label?: string | null
          seed?: number | null
          tournament_id: string
          updated_at?: string
          withdrawn?: boolean
        }
        Update: {
          club_id?: string | null
          created_at?: string
          handicap_shots?: number
          id?: string
          name?: string | null
          section_label?: string | null
          seed?: number | null
          tournament_id?: string
          updated_at?: string
          withdrawn?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"]
          category: Database["public"]["Enums"]["category"]
          created_at: string
          created_by: string | null
          ends_at: string | null
          ends_per_match: number | null
          entries_close_at: string | null
          format: Database["public"]["Enums"]["tournament_format"]
          handicap_rule: Database["public"]["Enums"]["handicap_rule"]
          host_club_id: string
          id: string
          max_entries: number | null
          name: string
          scope: Database["public"]["Enums"]["tournament_scope"]
          shots_up_target: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          structure: Database["public"]["Enums"]["tournament_structure"]
          updated_at: string
        }
        Insert: {
          age_group?: Database["public"]["Enums"]["age_group"]
          category?: Database["public"]["Enums"]["category"]
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          ends_per_match?: number | null
          entries_close_at?: string | null
          format: Database["public"]["Enums"]["tournament_format"]
          handicap_rule?: Database["public"]["Enums"]["handicap_rule"]
          host_club_id: string
          id?: string
          max_entries?: number | null
          name: string
          scope?: Database["public"]["Enums"]["tournament_scope"]
          shots_up_target?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          structure: Database["public"]["Enums"]["tournament_structure"]
          updated_at?: string
        }
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"]
          category?: Database["public"]["Enums"]["category"]
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          ends_per_match?: number | null
          entries_close_at?: string | null
          format?: Database["public"]["Enums"]["tournament_format"]
          handicap_rule?: Database["public"]["Enums"]["handicap_rule"]
          host_club_id?: string
          id?: string
          max_entries?: number | null
          name?: string
          scope?: Database["public"]["Enums"]["tournament_scope"]
          shots_up_target?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          structure?: Database["public"]["Enums"]["tournament_structure"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_host_club_id_fkey"
            columns: ["host_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_club_with_dependencies: {
        Args: {
          p_admin_email: string
          p_city: string
          p_contact_email: string
          p_contact_phone: string
          p_district_id: string
          p_greens: Json
          p_logo_path: string
          p_name: string
          p_player_emails: string[]
          p_short_name: string
          p_slug: string
          p_theme_preset: Database["public"]["Enums"]["club_theme_preset"]
        }
        Returns: string
      }
      current_club_ids: { Args: never; Returns: string[] }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_match_participant: {
        Args: { p_match: string; p_profile: string }
        Returns: boolean
      }
      is_message_recipient: {
        Args: { p_message: string; p_profile: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { p_profile: string; p_team: string }
        Returns: boolean
      }
      is_tournament_participant: {
        Args: { p_profile: string; p_tournament: string }
        Returns: boolean
      }
      match_tournament_id: { Args: { p_match: string }; Returns: string }
      message_club_id: { Args: { p_message: string }; Returns: string }
      team_tournament_id: { Args: { p_team: string }; Returns: string }
      tournament_host_club: { Args: { p_tournament: string }; Returns: string }
    }
    Enums: {
      age_group: "open" | "veteran" | "junior" | "u35"
      booking_purpose: "roll_up" | "practice" | "coaching" | "match" | "social"
      booking_status: "booked" | "cancelled"
      category: "men" | "women" | "mixed" | "open"
      club_theme_preset:
        | "atomic-red"
        | "ocean-blue"
        | "sunburst"
        | "midnight"
        | "ruby"
        | "ocean-green"
        | "grape"
        | "white-speckle"
        | "core-black"
      consent_type: "terms" | "privacy" | "marketing"
      dominant_hand: "right" | "left"
      gender: "male" | "female" | "other" | "prefer_not"
      handicap_rule: "scratch" | "handicap_start"
      invite_status: "pending" | "accepted" | "expired" | "revoked"
      match_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "walkover"
        | "cancelled"
      membership_status: "active" | "inactive" | "pending"
      message_channel: "in_app" | "email"
      message_recipient_status: "unread" | "read" | "archived"
      message_status: "draft" | "queued" | "sent" | "failed"
      player_position: "skip" | "third" | "second" | "lead"
      t20_grade: "gold" | "silver" | "bronze" | "fail"
      t20_section:
        | "jacks"
        | "targets"
        | "drive"
        | "control"
        | "trail"
        | "speedhumps_asc"
        | "speedhumps_desc"
      tournament_format:
        | "singles"
        | "pairs"
        | "triples"
        | "fours"
        | "mixed_pairs"
      tournament_scope: "club" | "district" | "provincial" | "national"
      tournament_status:
        | "draft"
        | "open"
        | "in_progress"
        | "completed"
        | "cancelled"
      tournament_structure:
        | "knockout"
        | "round_robin"
        | "sectional"
        | "drawn_social"
      user_role: "super_admin" | "club_admin" | "player"
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
      age_group: ["open", "veteran", "junior", "u35"],
      booking_purpose: ["roll_up", "practice", "coaching", "match", "social"],
      booking_status: ["booked", "cancelled"],
      category: ["men", "women", "mixed", "open"],
      club_theme_preset: [
        "atomic-red",
        "ocean-blue",
        "sunburst",
        "midnight",
        "ruby",
        "ocean-green",
        "grape",
        "white-speckle",
        "core-black",
      ],
      consent_type: ["terms", "privacy", "marketing"],
      dominant_hand: ["right", "left"],
      gender: ["male", "female", "other", "prefer_not"],
      handicap_rule: ["scratch", "handicap_start"],
      invite_status: ["pending", "accepted", "expired", "revoked"],
      match_status: [
        "scheduled",
        "in_progress",
        "completed",
        "walkover",
        "cancelled",
      ],
      membership_status: ["active", "inactive", "pending"],
      message_channel: ["in_app", "email"],
      message_recipient_status: ["unread", "read", "archived"],
      message_status: ["draft", "queued", "sent", "failed"],
      player_position: ["skip", "third", "second", "lead"],
      t20_grade: ["gold", "silver", "bronze", "fail"],
      t20_section: [
        "jacks",
        "targets",
        "drive",
        "control",
        "trail",
        "speedhumps_asc",
        "speedhumps_desc",
      ],
      tournament_format: [
        "singles",
        "pairs",
        "triples",
        "fours",
        "mixed_pairs",
      ],
      tournament_scope: ["club", "district", "provincial", "national"],
      tournament_status: [
        "draft",
        "open",
        "in_progress",
        "completed",
        "cancelled",
      ],
      tournament_structure: [
        "knockout",
        "round_robin",
        "sectional",
        "drawn_social",
      ],
      user_role: ["super_admin", "club_admin", "player"],
    },
  },
} as const

