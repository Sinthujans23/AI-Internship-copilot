export type Database = {
  public: {
    Tables: {
      learning_roadmaps:{Row:import("@/lib/learning/schema").SavedRoadmap;Insert:never;Update:never;Relationships:[]};
      learning_tasks:{Row:import("@/lib/learning/schema").LearningTask;Insert:never;Update:never;Relationships:[]};
      learning_advice:{Row:{id:string;user_id:string;roadmap_id:string;progress_hash:string;result:import("@/lib/learning/schema").Advice;mode:string;created_at:string};Insert:{user_id:string;roadmap_id:string;progress_hash:string;result:import("@/lib/learning/schema").Advice;mode:string};Update:never;Relationships:[]};
      company_rag_documents:{Row:{id:string;user_id:string;session_id:string;source_url:string;title:string;source_index:number;source_kind:string;retrieved_at:string};Insert:{id:string;user_id:string;session_id:string;source_url:string;title:string;source_index:number;source_kind:string;retrieved_at:string};Update:never;Relationships:[]};
      company_rag_chunks:{Row:{id:string;user_id:string;session_id:string;document_id:string;ordinal:number;content:string;content_hash:string;embedding:string;embedding_model:string};Insert:{id:string;user_id:string;session_id:string;document_id:string;ordinal:number;content:string;content_hash:string;embedding:string;embedding_model:string};Update:never;Relationships:[]};
      github_analyses: {
        Row:{id:string;user_id:string;username:string;repo_name:string;result:unknown;created_at:string};
        Insert:{user_id:string;username:string;repo_name:string;result:unknown};Update:never;Relationships:[];
      };
      github_skill_approvals: {
        Row:{id:string;user_id:string;analysis_id:string;cv_id:string;skill:string;approved_at:string};
        Insert:{user_id:string;analysis_id:string;cv_id:string;skill:string};Update:never;Relationships:[];
      };
      job_match_runs: {
        Row: {id:string;user_id:string;cv_id:string;context_hash:string;result:unknown;created_at:string};
        Insert: never; Update: {result?:unknown}; Relationships: [];
      };
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
      reserve_learning_request:{Args:Record<string,never>;Returns:undefined};
      save_learning_roadmap:{Args:{p_input:unknown;p_context:unknown;p_plan:unknown;p_mode:string;p_parent?:string};Returns:string};
      update_learning_task:{Args:{p_id:string;p_status:string;p_notes:string;p_url:string|null;p_expected:string};Returns:undefined};
      reserve_company_rag:{Args:{p_url:string};Returns:string};
      retrieve_company_chunks:{Args:{p_session:string;p_model:string;p_vector:string;p_document?:string;p_limit?:number};Returns:unknown};
      reserve_github_request:{Args:Record<string,never>;Returns:undefined};
      reserve_job_match: {Args:{p_cv_id:string;p_hash:string};Returns:string};
      reserve_cv_analysis: { Args: { p_cv_id: string; p_hash: string; p_force: boolean }; Returns: unknown };
      finish_cv_analysis: { Args: { p_id: string; p_result: unknown }; Returns: unknown };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
