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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      challenges: {
        Row: {
          accepted_at: string | null
          challenged_player_id: string
          challenger_player_id: string
          created_at: string
          declined_at: string | null
          expires_at: string
          id: string
          ladder_id: string
          match_id: string | null
          match_type: string
          played_at: string | null
          status: Database["public"]["Enums"]["challenge_status"]
        }
        Insert: {
          accepted_at?: string | null
          challenged_player_id: string
          challenger_player_id: string
          created_at?: string
          declined_at?: string | null
          expires_at: string
          id?: string
          ladder_id: string
          match_id?: string | null
          match_type?: string
          played_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
        }
        Update: {
          accepted_at?: string | null
          challenged_player_id?: string
          challenger_player_id?: string
          created_at?: string
          declined_at?: string | null
          expires_at?: string
          id?: string
          ladder_id?: string
          match_id?: string | null
          match_type?: string
          played_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
        }
        Relationships: [
          {
            foreignKeyName: "challenges_challenged_player_id_fkey"
            columns: ["challenged_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_challenger_player_id_fkey"
            columns: ["challenger_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      club_greens: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_active: boolean
          lane_count: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          lane_count?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lane_count?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_greens_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_news: {
        Row: {
          body: string | null
          club_id: string
          created_at: string | null
          cta_text: string | null
          cta_url: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          starts_at: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          club_id: string
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          starts_at?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          club_id?: string
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          starts_at?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clubs: {
        Row: {
          created_at: string
          district_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          district_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          district_id?: string
          id?: string
          name?: string
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
      districts: {
        Row: {
          created_at: string
          id: string
          name: string
          province_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          province_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          province_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      game_invites: {
        Row: {
          booking_id: string | null
          club_id: string
          created_at: string
          game_format: string
          id: string
          invitee_player_id: string
          inviter_player_id: string
          match_id: string | null
          responded_at: string | null
          status: string
        }
        Insert: {
          booking_id?: string | null
          club_id: string
          created_at?: string
          game_format: string
          id?: string
          invitee_player_id: string
          inviter_player_id: string
          match_id?: string | null
          responded_at?: string | null
          status: string
        }
        Update: {
          booking_id?: string | null
          club_id?: string
          created_at?: string
          game_format?: string
          id?: string
          invitee_player_id?: string
          inviter_player_id?: string
          match_id?: string | null
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_invites_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "lane_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_invitee_player_id_fkey"
            columns: ["invitee_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_inviter_player_id_fkey"
            columns: ["inviter_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_entries: {
        Row: {
          drawn: number
          id: string
          ladder_id: string
          lost: number
          played: number
          player_id: string
          points: number
          position: number
          shot_diff: number
          shots_against: number
          shots_for: number
          stats_updated_at: string | null
          updated_at: string
          won: number
        }
        Insert: {
          drawn?: number
          id?: string
          ladder_id: string
          lost?: number
          played?: number
          player_id: string
          points?: number
          position: number
          shot_diff?: number
          shots_against?: number
          shots_for?: number
          stats_updated_at?: string | null
          updated_at?: string
          won?: number
        }
        Update: {
          drawn?: number
          id?: string
          ladder_id?: string
          lost?: number
          played?: number
          player_id?: string
          points?: number
          position?: number
          shot_diff?: number
          shots_against?: number
          shots_for?: number
          stats_updated_at?: string | null
          updated_at?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "ladder_entries_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      ladders: {
        Row: {
          club_id: string | null
          created_at: string
          district_id: string | null
          id: string
          province_id: string | null
          ruleset_id: string | null
          scope: Database["public"]["Enums"]["ladder_scope"]
          scope_type: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          district_id?: string | null
          id?: string
          province_id?: string | null
          ruleset_id?: string | null
          scope: Database["public"]["Enums"]["ladder_scope"]
          scope_type?: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          district_id?: string | null
          id?: string
          province_id?: string | null
          ruleset_id?: string | null
          scope?: Database["public"]["Enums"]["ladder_scope"]
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladders_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladders_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladders_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladders_ruleset_fk"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
      lane_bookings: {
        Row: {
          booking_date: string
          club_id: string
          created_at: string
          created_by: string
          green_id: string
          id: string
          lane_number: number
          session: string
        }
        Insert: {
          booking_date: string
          club_id: string
          created_at?: string
          created_by?: string
          green_id: string
          id?: string
          lane_number: number
          session: string
        }
        Update: {
          booking_date?: string
          club_id?: string
          created_at?: string
          created_by?: string
          green_id?: string
          id?: string
          lane_number?: number
          session?: string
        }
        Relationships: [
          {
            foreignKeyName: "lane_bookings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lane_bookings_green_id_fkey"
            columns: ["green_id"]
            isOneToOne: false
            referencedRelation: "club_greens"
            referencedColumns: ["id"]
          },
        ]
      }
      match_schedules: {
        Row: {
          booking_id: string | null
          club_id: string
          created_at: string
          game_format: string
          match_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          club_id: string
          created_at?: string
          game_format: string
          match_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          club_id?: string
          created_at?: string
          game_format?: string
          match_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_schedules_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "lane_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_schedules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_schedules_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          admin_final_at: string | null
          admin_final_by: string | null
          challenge_id: string | null
          challenged_player_id: string | null
          challenged_position_at_start: number | null
          challenged_score: number | null
          challenger_player_id: string | null
          challenger_position_at_start: number | null
          challenger_score: number | null
          confirmed_by_a: boolean
          confirmed_by_b: boolean
          created_at: string
          finalized_at: string | null
          finalized_by_admin: boolean | null
          id: string
          ladder_id: string | null
          match_no: number | null
          match_type: string
          player_a: string | null
          player_b: string | null
          round_no: number | null
          score_a: number | null
          score_b: number | null
          slot_a_source_match_id: string | null
          slot_a_source_type: string | null
          slot_b_source_match_id: string | null
          slot_b_source_type: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_by_player_id: string | null
          team_a_id: string | null
          team_b_id: string | null
          tournament_id: string | null
          verified_at: string | null
          winner_player_id: string | null
          winner_team_id: string | null
        }
        Insert: {
          admin_final_at?: string | null
          admin_final_by?: string | null
          challenge_id?: string | null
          challenged_player_id?: string | null
          challenged_position_at_start?: number | null
          challenged_score?: number | null
          challenger_player_id?: string | null
          challenger_position_at_start?: number | null
          challenger_score?: number | null
          confirmed_by_a?: boolean
          confirmed_by_b?: boolean
          created_at?: string
          finalized_at?: string | null
          finalized_by_admin?: boolean | null
          id?: string
          ladder_id?: string | null
          match_no?: number | null
          match_type?: string
          player_a?: string | null
          player_b?: string | null
          round_no?: number | null
          score_a?: number | null
          score_b?: number | null
          slot_a_source_match_id?: string | null
          slot_a_source_type?: string | null
          slot_b_source_match_id?: string | null
          slot_b_source_type?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_by_player_id?: string | null
          team_a_id?: string | null
          team_b_id?: string | null
          tournament_id?: string | null
          verified_at?: string | null
          winner_player_id?: string | null
          winner_team_id?: string | null
        }
        Update: {
          admin_final_at?: string | null
          admin_final_by?: string | null
          challenge_id?: string | null
          challenged_player_id?: string | null
          challenged_position_at_start?: number | null
          challenged_score?: number | null
          challenger_player_id?: string | null
          challenger_position_at_start?: number | null
          challenger_score?: number | null
          confirmed_by_a?: boolean
          confirmed_by_b?: boolean
          created_at?: string
          finalized_at?: string | null
          finalized_by_admin?: boolean | null
          id?: string
          ladder_id?: string | null
          match_no?: number | null
          match_type?: string
          player_a?: string | null
          player_b?: string | null
          round_no?: number | null
          score_a?: number | null
          score_b?: number | null
          slot_a_source_match_id?: string | null
          slot_a_source_type?: string | null
          slot_b_source_match_id?: string | null
          slot_b_source_type?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_by_player_id?: string | null
          team_a_id?: string | null
          team_b_id?: string | null
          tournament_id?: string | null
          verified_at?: string | null
          winner_player_id?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_admin_final_by_fkey"
            columns: ["admin_final_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: true
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player_a_fkey"
            columns: ["player_a"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player_b_fkey"
            columns: ["player_b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_slot_a_source_match_id_fkey"
            columns: ["slot_a_source_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_slot_b_source_match_id_fkey"
            columns: ["slot_b_source_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "tournament_ladder_vw"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "tournament_ladder_vw"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "active_tournaments"
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
            foreignKeyName: "matches_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "tournament_ladder_vw"
            referencedColumns: ["team_id"]
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
      players: {
        Row: {
          club_id: string
          created_at: string
          display_name: string | null
          division: string | null
          gender: string | null
          handicap: number
          id: string
          is_active: boolean
          user_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          display_name?: string | null
          division?: string | null
          gender?: string | null
          handicap?: number
          id?: string
          is_active?: boolean
          user_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          display_name?: string | null
          division?: string | null
          gender?: string | null
          handicap?: number
          id?: string
          is_active?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          club: string | null
          club_id: string | null
          created_at: string
          district_id: string | null
          email: string
          full_name: string
          gender: string | null
          id: string
          is_admin: boolean
          role: string
        }
        Insert: {
          club?: string | null
          club_id?: string | null
          created_at?: string
          district_id?: string | null
          email: string
          full_name: string
          gender?: string | null
          id: string
          is_admin?: boolean
          role: string
        }
        Update: {
          club?: string | null
          club_id?: string | null
          created_at?: string
          district_id?: string | null
          email?: string
          full_name?: string
          gender?: string | null
          id?: string
          is_admin?: boolean
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      provinces: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      rulesets: {
        Row: {
          allow_draws: boolean
          created_at: string
          description: string | null
          fixed_ends: number | null
          id: string
          match_format: string
          name: string
          points_draw: number
          points_loss: number
          points_win: number
          sets_best_of: number | null
          target_score: number | null
          tiebreak_order: string[]
          updated_at: string
        }
        Insert: {
          allow_draws?: boolean
          created_at?: string
          description?: string | null
          fixed_ends?: number | null
          id?: string
          match_format: string
          name: string
          points_draw?: number
          points_loss?: number
          points_win?: number
          sets_best_of?: number | null
          target_score?: number | null
          tiebreak_order?: string[]
          updated_at?: string
        }
        Update: {
          allow_draws?: boolean
          created_at?: string
          description?: string | null
          fixed_ends?: number | null
          id?: string
          match_format?: string
          name?: string
          points_draw?: number
          points_loss?: number
          points_win?: number
          sets_best_of?: number | null
          target_score?: number | null
          tiebreak_order?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          created_at: string
          id: string
          player_id: string
          status: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          status?: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "active_tournaments"
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
          created_at: string
          id: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_team_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_ladder_vw"
            referencedColumns: ["team_id"]
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
          created_at: string
          id: string
          team_handicap: number | null
          team_no: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_handicap?: number | null
          team_no: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_handicap?: number | null
          team_no?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "active_tournaments"
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
          announced_at: string
          club_id: string | null
          created_at: string
          created_by: string | null
          district_id: string | null
          ends_at: string | null
          entries_open: boolean
          format: Database["public"]["Enums"]["tournament_format"]
          gender: string | null
          handicap_notes: string | null
          id: string
          locked_at: string | null
          name: string
          rule_type: string
          scope: Database["public"]["Enums"]["tournament_scope"]
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          target_team_handicap: number | null
        }
        Insert: {
          announced_at?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          district_id?: string | null
          ends_at?: string | null
          entries_open?: boolean
          format: Database["public"]["Enums"]["tournament_format"]
          gender?: string | null
          handicap_notes?: string | null
          id?: string
          locked_at?: string | null
          name: string
          rule_type?: string
          scope: Database["public"]["Enums"]["tournament_scope"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          target_team_handicap?: number | null
        }
        Update: {
          announced_at?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          district_id?: string | null
          ends_at?: string | null
          entries_open?: boolean
          format?: Database["public"]["Enums"]["tournament_format"]
          gender?: string | null
          handicap_notes?: string | null
          id?: string
          locked_at?: string | null
          name?: string
          rule_type?: string
          scope?: Database["public"]["Enums"]["tournament_scope"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          target_team_handicap?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_tournaments: {
        Row: {
          ends_at: string | null
          format: Database["public"]["Enums"]["tournament_format"] | null
          id: string | null
          name: string | null
          scope: Database["public"]["Enums"]["tournament_scope"] | null
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"] | null
        }
        Insert: {
          ends_at?: string | null
          format?: Database["public"]["Enums"]["tournament_format"] | null
          id?: string | null
          name?: string | null
          scope?: Database["public"]["Enums"]["tournament_scope"] | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
        }
        Update: {
          ends_at?: string | null
          format?: Database["public"]["Enums"]["tournament_format"] | null
          id?: string | null
          name?: string | null
          scope?: Database["public"]["Enums"]["tournament_scope"] | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
        }
        Relationships: []
      }
      tournament_ladder_vw: {
        Row: {
          d: number | null
          l: number | null
          p: number | null
          pts: number | null
          sa: number | null
          sd: number | null
          sf: number | null
          team_handicap: number | null
          team_id: string | null
          team_no: number | null
          tournament_id: string | null
          w: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "active_tournaments"
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
      tournament_round_summary: {
        Row: {
          byes: number | null
          completed: number | null
          matches: number | null
          round_complete: boolean | null
          round_no: number | null
          tournament_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "active_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_club_id: { Args: { uid: string }; Returns: string }
      apply_ladder_result: {
        Args: { p_ladder_id: string; p_loser_id: string; p_winner_id: string }
        Returns: undefined
      }
      generate_round1_singles_matches: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      is_club_admin:
        | { Args: { club_uuid: string }; Returns: boolean }
        | { Args: { club: string; uid: string }; Returns: boolean }
      is_super_admin:
        | { Args: never; Returns: boolean }
        | { Args: { uid: string }; Returns: boolean }
      knockout_advance_from_match: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      knockout_generate_next_round: {
        Args: { p_round_no: number; p_tournament_id: string }
        Returns: undefined
      }
      knockout_process_byes: {
        Args: { p_round_no: number; p_tournament_id: string }
        Returns: undefined
      }
      ladder_next_position: { Args: { p_ladder_id: string }; Returns: number }
      ladder_swap_up_one: {
        Args: { p_ladder_id: string; p_winner_player_id: string }
        Returns: undefined
      }
      my_club_id: { Args: never; Returns: string }
      my_player_id: { Args: never; Returns: string }
      recalc_ladder: { Args: { ladder_uuid: string }; Returns: undefined }
      recalc_ladder_positions: {
        Args: { ladder_uuid: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_player_ladders: { Args: { p_user_id: string }; Returns: undefined }
      tournament_cancel: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_generate_doubles_teams: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_generate_knockout_matches: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_generate_knockout_singles_bracket: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_generate_matches: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_generate_round_robin_matches: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_get_standings: {
        Args: { p_tournament_id: string }
        Returns: {
          draws: number
          losses: number
          played: number
          points: number
          score_against: number
          score_diff: number
          score_for: number
          team_id: string
          team_no: number
          wins: number
        }[]
      }
      tournament_lock_entries: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_set_target_handicap: {
        Args: { p_target: number; p_tournament_id: string }
        Returns: undefined
      }
      tournament_start: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
    }
    Enums: {
      challenge_status:
        | "PROPOSED"
        | "ACCEPTED"
        | "DECLINED"
        | "EXPIRED"
        | "PLAYED"
        | "CONFIRMED"
        | "DISPUTED"
        | "ADMIN_FINAL"
      ladder_scope: "CLUB" | "DISTRICT" | "PROVINCE" | "NATIONAL"
      tournament_format: "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL"
      tournament_scope: "CLUB" | "DISTRICT" | "NATIONAL"
      tournament_status: "ANNOUNCED" | "IN_PLAY" | "COMPLETED"
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
      challenge_status: [
        "PROPOSED",
        "ACCEPTED",
        "DECLINED",
        "EXPIRED",
        "PLAYED",
        "CONFIRMED",
        "DISPUTED",
        "ADMIN_FINAL",
      ],
      ladder_scope: ["CLUB", "DISTRICT", "PROVINCE", "NATIONAL"],
      tournament_format: ["SINGLES", "DOUBLES", "TRIPLES", "FOUR_BALL"],
      tournament_scope: ["CLUB", "DISTRICT", "NATIONAL"],
      tournament_status: ["ANNOUNCED", "IN_PLAY", "COMPLETED"],
    },
  },
} as const
