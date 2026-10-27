export type Database = {
  public: {
    Tables: {
      cvs: { Row: { id:string; user_id:string; file_path:string; file_name:string; extracted_text:string; skills:string[]; analysis:unknown; created_at:string }; Insert: { id?:string; user_id:string; file_path:string; file_name:string; extracted_text:string; skills?:string[]; analysis?:unknown }; Update: { analysis?:unknown; file_name?:string; skills?:string[] }; Relationships: [] };
      applications: {
        Row: { id: string; user_id: string; company: string; role: string; status: "Applied" | "Interview" | "Rejected" | "Offer"; job_text: string; job_analysis: import("@/lib/job-schema").JobDetails | null; match_score: number | null; created_at: string };
        Insert: { id?: string; user_id: string; company: string; role: string; status?: "Applied" | "Interview" | "Rejected" | "Offer"; job_text?: string; job_analysis?: import("@/lib/job-schema").JobDetails | null; match_score?: number | null; created_at?: string };
        Update: { company?: string; role?: string; status?: "Applied" | "Interview" | "Rejected" | "Offer"; job_text?: string; match_score?: number | null };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
