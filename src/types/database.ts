export type Database = {
  public: {
    Tables: {
      cv_analysis_history: {
        Row: { id: string; user_id: string; cv_id: string; version: number; input_hash: string; status: string; result: unknown; created_at: string; finished_at: string | null };
        Insert: never; Update: never; Relationships: [];
      };
      career_preferences: {
        Row: { user_id: string; preferences: import("@/lib/company/schema").CareerPreferences; updated_at: string };
        Insert: { user_id: string; preferences: import("@/lib/company/schema").CareerPreferences; updated_at?: string };
        Update: { preferences?: import("@/lib/company/schema").CareerPreferences; updated_at?: string }; Relationships: [];
      };
      company_reports: {
        Row: { id: string; user_id: string; cv_id: string | null; source_url: string; result: import("@/lib/company/schema").CompanyReport; created_at: string };
        Insert: { id?: string; user_id: string; cv_id?: string | null; source_url: string; result: import("@/lib/company/schema").CompanyReport; created_at?: string };
        Update: { result?: import("@/lib/company/schema").CompanyReport }; Relationships: [];
      };
      cvs: { Row: { id:string; user_id:string; file_path:string; file_name:string; extracted_text:string; skills:string[]; analysis:unknown; created_at:string }; Insert: { id?:string; user_id:string; file_path:string; file_name:string; extracted_text:string; skills?:string[]; analysis?:unknown }; Update: { analysis?:unknown; file_name?:string; skills?:string[] }; Relationships: [] };
      applications: {
        Row: { id: string; user_id: string; company: string; role: string; status: "Applied" | "Interview" | "Rejected" | "Offer"; job_text: string; job_analysis: import("@/lib/job-schema").JobDetails | null; match_score: number | null; match_result: import("@/lib/matching-schema").SkillMatch | null; agent_result: import("@/lib/agent-schema").Preparation | null; created_at: string };
        Insert: { id?: string; user_id: string; company: string; role: string; status?: "Applied" | "Interview" | "Rejected" | "Offer"; job_text?: string; job_analysis?: import("@/lib/job-schema").JobDetails | null; match_score?: number | null; created_at?: string };
        Update: { company?: string; role?: string; status?: "Applied" | "Interview" | "Rejected" | "Offer"; job_text?: string; job_analysis?: import("@/lib/job-schema").JobDetails | null; match_score?: number | null; match_result?: import("@/lib/matching-schema").SkillMatch | null; agent_result?: import("@/lib/agent-schema").Preparation | null };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      reserve_cv_analysis: { Args: { p_cv_id: string; p_hash: string; p_force: boolean }; Returns: unknown };
      finish_cv_analysis: { Args: { p_id: string; p_result: unknown }; Returns: unknown };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
