export type GuestArchetype =
  'A_FIRST_JOB' | 'B_CAREER_CHANGE' | 'C_OPERATIONAL' | 'D_SAME_FIELD_RETURN' | 'E_SPECIALIST';
export type GuestObjective =
  'ENTER_FAST' | 'MAXIMIZE_SALARY' | 'CHANGE_FIELD' | 'WORK_REMOTE' | 'BALANCE_STUDY_FAMILY';
export type GuestTone = 'DIRECT' | 'NEUTRAL' | 'CONSULTATIVE' | 'TECHNICAL' | 'WELCOMING';
export type RequirementCategory = 'ELIMINATORY' | 'NEGOTIABLE' | 'DECORATIVE';

export interface GuestAnalysisRequest {
  documents: Array<{ id: string; text: string }>;
  jobText?: string;
  targetRole?: string;
}

export interface GuestAnalysisResponse {
  targetRole: string;
  summary: string;
  requirements: Array<{ text: string; category: RequirementCategory }>;
  suggestedArchetype: GuestArchetype;
  suggestedObjective: GuestObjective;
  suggestedTone: GuestTone;
  reason: string;
}
