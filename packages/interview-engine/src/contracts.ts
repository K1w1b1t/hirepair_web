export const VERSION = 1 as const;
export const OBJECTIVES = [
  'ENTER_FAST',
  'MAXIMIZE_SALARY',
  'CHANGE_FIELD',
  'WORK_REMOTE',
  'BALANCE_STUDY_FAMILY',
] as const;
export type Objective = (typeof OBJECTIVES)[number];
export type Phase = 'preparation' | 'interview' | 'confirmation' | 'ready' | 'writing';
export interface Source {
  id: string;
  version: string;
  text: string;
}
export interface Origin {
  sourceId: string;
  sourceVersion: string;
  quote: string;
}
export interface Experience {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  current: boolean | null;
  origin: Origin;
}
export interface Story {
  id: string;
  experienceId: string;
  text: string;
  turnId: string;
}
export interface Fact {
  id: string;
  experienceId: string;
  storyId: string | null;
  text: string;
  origin: Origin;
  confirmation: 'candidate' | 'confirmed' | 'rejected';
  externallyVerified: boolean;
  usable: boolean;
  revision: number;
}
export interface Criterion {
  id: string;
  text: string;
  kind: 'explicit' | 'implicit';
  category: 'ELIMINATORY' | 'NEGOTIABLE' | 'DECORATIVE';
  quote: string | null;
  reason: string;
  evidenceNeeded: string;
  objectiveBasis: boolean;
  relevance: number;
}
export interface EvidenceLink {
  id: string;
  criterionId: string;
  experienceId: string | null;
  factIds: string[];
  status: 'confirmed' | 'candidate' | 'unknown' | 'declared_absence' | 'contradiction';
  declarationTurnId: string | null;
}
export interface Topic {
  id: string;
  criterionId: string;
  experienceId: string | null;
  missingEvidence: string;
  reason: string;
  impact: number;
  uncertainty: number;
  relevance: number;
}
export interface Turn {
  recordedAt?: number;
  id: string;
  question: { text: string; topicId: string };
  answer: { text: string; kind: 'specific' | 'vague' | 'absence' | 'declined' };
  factIds: string[];
}
export interface Pending {
  id: string;
  criterionId: string | null;
  factIds: string[];
  reason: string;
  blocking: boolean;
}
export interface Inputs {
  resumes: string;
  job: string;
  objective: string;
  facts: string;
}
export interface Derived {
  id: string;
  version: number;
  inputs: Inputs;
  dependencies: string[];
  valid: boolean;
}
export interface Plan extends Derived {
  topics: Topic[];
}
export interface Strategy extends Derived {
  archetype:
    'A_FIRST_JOB' | 'B_CAREER_CHANGE' | 'C_OPERATIONAL' | 'D_SAME_FIELD_RETURN' | 'E_SPECIALIST';
  tone: 'DIRECT' | 'NEUTRAL' | 'CONSULTATIVE' | 'TECHNICAL' | 'WELCOMING';
  reason: string;
  formula: 'CAR' | 'XYZ' | 'SCOPE_COMPLIANCE';
}
export interface Confirmation extends Derived {
  factIds: string[];
}
export interface GroundedContent extends Derived {
  sections: Array<{ text: string; factIds: string[] }>;
}
export interface Session {
  version: 1;
  id: string;
  funnelSessionId: string;
  revision: number;
  phase: Phase;
  objective: { value: Objective; provisional: boolean } | null;
  inputs: Inputs;
  sources: Source[];
  experiences: Experience[];
  stories: Story[];
  facts: Fact[];
  criteria: Criterion[];
  links: EvidenceLink[];
  turns: Turn[];
  pending: Pending[];
  plan: Plan | null;
  strategy: Strategy | null;
  confirmation: Confirmation | null;
  content: GroundedContent | null;
  interruption: {
    kind: 'paused' | 'budget_exhausted' | 'partial';
    reason: string;
    resumePhase: Phase;
  } | null;
  commands: Array<{ id: string; hash: string }>;
}
export interface Extraction {
  experiences: Experience[];
  facts: Array<Pick<Fact, 'id' | 'experienceId' | 'text' | 'origin'>>;
}
export interface CriteriaAnalysis {
  criteria: Criterion[];
  links: EvidenceLink[];
  archetype: Strategy['archetype'];
  reason: string;
}
export interface PreparationRequest {
  version: 1;
  sessionId: string;
  funnelSessionId: string;
  documents: Array<{ id: string; text: string }>;
  jobText?: string;
  targetRole?: string;
  objective: Objective;
  provisional: boolean;
}
export interface PreparationResult {
  version: 1;
  session: Session;
}
export type NextAction =
  | { version: 1; kind: 'prepare'; reason: string }
  | { version: 1; kind: 'investigate'; topic: Topic | null; reason: string }
  | { version: 1; kind: 'confirm'; factIds: string[]; reason: string }
  | { version: 1; kind: 'write'; confirmationVersion: number; reason: string }
  | { version: 1; kind: 'stop'; reason: string };
