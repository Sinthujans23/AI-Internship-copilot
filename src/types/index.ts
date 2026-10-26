export type ApplicationStatus = "Applied" | "Interview" | "Rejected" | "Offer";
export type Application = { id: string; company: string; role: string; status: ApplicationStatus; appliedAt: string; matchScore: number; location: string; initials: string; color: string; description?: string; notes?: string };
export type JobAnalysis = { title: string; company: string | null; requiredSkills: string[]; preferredSkills: string[]; responsibilities: string[]; qualifications: string[] };
export type CvAnalysis = { skills: string[]; education: string[]; projects: string[]; experience: string[]; qualifications: string[] };
export type MatchResult = { score: number; matched: string[]; missing: string[]; partial: string[]; evidence: string[]; explanation: string };
export type CopilotResult = { job: JobAnalysis; match: MatchResult; bulletSuggestions: Array<{ original: string; suggested: string }>; email: { subject: string; body: string } };
