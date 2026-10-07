export type Archetype =
  'A_FIRST_JOB' | 'B_CAREER_CHANGE' | 'C_OPERATIONAL' | 'D_SAME_FIELD_RETURN' | 'E_SPECIALIST';
export type Objective =
  'ENTER_FAST' | 'MAXIMIZE_SALARY' | 'CHANGE_FIELD' | 'WORK_REMOTE' | 'BALANCE_STUDY_FAMILY';
export type Tone = 'DIRECT' | 'NEUTRAL' | 'CONSULTATIVE' | 'TECHNICAL' | 'WELCOMING';

export interface JobAnalysisResult {
  targetRole: string;
  summary: string;
  requirements: Array<{ text: string; category: string }>;
  suggestedArchetype: Archetype;
  suggestedObjective: Objective;
  suggestedTone: Tone;
  reason: string;
}

export interface JobPreferences {
  archetype: Archetype;
  objective: Objective;
  tone: Tone;
}

export interface JobDraft {
  hasJob: boolean;
  jobText: string;
  targetRole: string;
  accepted: boolean;
}

export const ANALYSIS_KEY = 'hirepair_job_analysis';
export const GUEST_ID_KEY = 'hirepair_guest_id';

export interface AnalysisSignal {
  targetKind?: string;
  targetRole?: string;
  requirements: unknown[];
}
export const archetypes: Array<{ value: Archetype; label: string }> = [
  { value: 'A_FIRST_JOB', label: 'Primeiro emprego' },
  { value: 'B_CAREER_CHANGE', label: 'Transição de carreira' },
  { value: 'C_OPERATIONAL', label: 'Operacional' },
  { value: 'D_SAME_FIELD_RETURN', label: 'Mesma área' },
  { value: 'E_SPECIALIST', label: 'Especialista' },
];
export const objectives: Array<{ value: Objective; label: string }> = [
  { value: 'ENTER_FAST', label: 'Entrar rápido' },
  { value: 'MAXIMIZE_SALARY', label: 'Maximizar salário' },
  { value: 'CHANGE_FIELD', label: 'Mudar de área' },
  { value: 'WORK_REMOTE', label: 'Trabalhar remoto' },
  { value: 'BALANCE_STUDY_FAMILY', label: 'Conciliar rotina' },
];
export const tones: Array<{ value: Tone; label: string }> = [
  { value: 'DIRECT', label: 'Direto e simples' },
  { value: 'NEUTRAL', label: 'Profissional neutro' },
  { value: 'CONSULTATIVE', label: 'Consultivo' },
  { value: 'TECHNICAL', label: 'Técnico' },
  { value: 'WELCOMING', label: 'Acolhedor' },
];
const archetypeByTargetKind: Record<string, Archetype> = {
  different_track: 'B_CAREER_CHANGE',
  operational: 'C_OPERATIONAL',
  specialist: 'E_SPECIALIST',
  first_job: 'A_FIRST_JOB',
};
const toneByArchetype: Record<Archetype, Tone> = {
  A_FIRST_JOB: 'DIRECT',
  B_CAREER_CHANGE: 'CONSULTATIVE',
  C_OPERATIONAL: 'DIRECT',
  D_SAME_FIELD_RETURN: 'NEUTRAL',
  E_SPECIALIST: 'TECHNICAL',
};
export function deriveChoices(signal: AnalysisSignal) {
  const archetype = archetypeByTargetKind[signal.targetKind ?? ''] ?? 'D_SAME_FIELD_RETURN';
  const tone = toneByArchetype[archetype];
  return {
    archetypes,
    objectives,
    tones,
    selected: {
      archetype,
      objective: archetype === 'B_CAREER_CHANGE' ? 'CHANGE_FIELD' : 'ENTER_FAST',
      tone,
    },
  };
}
