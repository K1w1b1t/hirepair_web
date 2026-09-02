-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CANDIDATE', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY_POLICY', 'AI_PROCESSING', 'AUDIO_RETENTION');

-- CreateEnum
CREATE TYPE "EducationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "ProfileSkillKind" AS ENUM ('SKILL', 'TOOL', 'LANGUAGE', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "SessionObjective" AS ENUM ('ENTER_FAST', 'MAXIMIZE_SALARY', 'CHANGE_FIELD', 'WORK_REMOTE', 'BALANCE_STUDY_FAMILY');

-- CreateEnum
CREATE TYPE "Archetype" AS ENUM ('A_FIRST_JOB', 'B_CAREER_CHANGE', 'C_OPERATIONAL', 'D_SAME_FIELD_RETURN', 'E_SPECIALIST');

-- CreateEnum
CREATE TYPE "WritingTone" AS ENUM ('DIRECT', 'NEUTRAL', 'CONSULTATIVE', 'TECHNICAL', 'WELCOMING');

-- CreateEnum
CREATE TYPE "ImpactFormula" AS ENUM ('CAR', 'XYZ', 'SCOPE');

-- CreateEnum
CREATE TYPE "SessionPhase" AS ENUM ('DIAGNOSIS', 'OBJECTIVE', 'ARCHETYPE', 'WRITING_PARAMETERS', 'STORIES', 'JOB', 'RESUME', 'DONE');

-- CreateEnum
CREATE TYPE "FindingKind" AS ENUM ('PARSING', 'SENSITIVE_DATA', 'EMBEDDED_IMAGE', 'LENGTH', 'TIMELINE_GAP', 'INFLATED_DESCRIPTION', 'UNSUPPORTED_SKILL', 'STALE_TARGET', 'OVERQUALIFIED', 'GENERIC_RESUME');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "StorySource" AS ENUM ('VOICE', 'TEXT');

-- CreateEnum
CREATE TYPE "StoryFactKind" AS ENUM ('FACT', 'NUMBER', 'TOOL', 'COMPETENCY', 'QUESTION');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('ELIMINATORY', 'NEGOTIABLE', 'DECORATIVE');

-- CreateEnum
CREATE TYPE "RequirementSituation" AS ENUM ('HAS_AND_PRESENT', 'HAS_NOT_PRESENT', 'DOES_NOT_HAVE');

-- CreateEnum
CREATE TYPE "ResumeKind" AS ENUM ('DEFAULT', 'JOB_TARGETED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'DOCX', 'MARKDOWN');

-- CreateEnum
CREATE TYPE "ExportChannel" AS ENUM ('DOWNLOAD', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ApplicationChannel" AS ENUM ('AGGREGATOR', 'LINKEDIN', 'WHATSAPP', 'IN_PERSON', 'REFERRAL', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SENT', 'NO_REPLY', 'AUTO_REJECTED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "role" "UserRole" NOT NULL DEFAULT 'CANDIDATE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "headline" TEXT,
    "phone" TEXT,
    "contactEmail" TEXT,
    "city" TEXT,
    "state" TEXT,
    "summary" TEXT,
    "objective" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileExperience" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT,
    "startedOn" DATE,
    "endedOn" DATE,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isInformal" BOOLEAN NOT NULL DEFAULT false,
    "isPersonalProject" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileEducation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "institution" TEXT,
    "startedOn" DATE,
    "endedOn" DATE,
    "status" "EducationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileSkill" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProfileSkillKind" NOT NULL DEFAULT 'SKILL',
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileLink" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "objective" "SessionObjective",
    "archetype" "Archetype",
    "tone" "WritingTone",
    "formula" "ImpactFormula",
    "phase" "SessionPhase" NOT NULL DEFAULT 'DIAGNOSIS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTarget" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "extractedText" TEXT,
    "pageCount" INTEGER,
    "imageCount" INTEGER,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticFinding" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "documentId" TEXT,
    "kind" "FindingKind" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "periodStart" DATE,
    "periodEnd" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "label" TEXT,
    "source" "StorySource" NOT NULL DEFAULT 'TEXT',
    "transcript" TEXT,
    "audioStoragePath" TEXT,
    "audioDeletedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryFact" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "kind" "StoryFactKind" NOT NULL,
    "value" TEXT NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "sourceUrl" TEXT,
    "rawText" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequirement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" "RequirementCategory" NOT NULL,
    "reason" TEXT,
    "situation" "RequirementSituation",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionTargetId" TEXT,
    "jobId" TEXT,
    "kind" "ResumeKind" NOT NULL DEFAULT 'DEFAULT',
    "archetype" "Archetype",
    "title" TEXT,
    "contentMarkdown" TEXT,
    "content" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeExport" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "channel" "ExportChannel" NOT NULL,
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT,
    "jobId" TEXT,
    "company" TEXT,
    "role" TEXT,
    "channel" "ApplicationChannel" NOT NULL DEFAULT 'OTHER',
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SENT',
    "lastStatusAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "UserConsent_userId_type_idx" ON "UserConsent"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "ProfileExperience_profileId_sortOrder_idx" ON "ProfileExperience"("profileId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProfileEducation_profileId_sortOrder_idx" ON "ProfileEducation"("profileId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProfileSkill_profileId_kind_idx" ON "ProfileSkill"("profileId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileSkill_profileId_kind_name_key" ON "ProfileSkill"("profileId", "kind", "name");

-- CreateIndex
CREATE INDEX "ProfileLink_profileId_sortOrder_idx" ON "ProfileLink"("profileId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Session_publicCode_key" ON "Session"("publicCode");

-- CreateIndex
CREATE INDEX "Session_userId_createdAt_idx" ON "Session"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_deletedAt_idx" ON "Session"("deletedAt");

-- CreateIndex
CREATE INDEX "SessionTarget_sessionId_sortOrder_idx" ON "SessionTarget"("sessionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTarget_sessionId_role_key" ON "SessionTarget"("sessionId", "role");

-- CreateIndex
CREATE INDEX "UploadedDocument_sessionId_idx" ON "UploadedDocument"("sessionId");

-- CreateIndex
CREATE INDEX "DiagnosticFinding_sessionId_severity_idx" ON "DiagnosticFinding"("sessionId", "severity");

-- CreateIndex
CREATE INDEX "DiagnosticFinding_documentId_idx" ON "DiagnosticFinding"("documentId");

-- CreateIndex
CREATE INDEX "Story_sessionId_idx" ON "Story"("sessionId");

-- CreateIndex
CREATE INDEX "StoryFact_storyId_kind_idx" ON "StoryFact"("storyId", "kind");

-- CreateIndex
CREATE INDEX "Job_sessionId_idx" ON "Job"("sessionId");

-- CreateIndex
CREATE INDEX "JobRequirement_jobId_category_idx" ON "JobRequirement"("jobId", "category");

-- CreateIndex
CREATE INDEX "Resume_userId_createdAt_idx" ON "Resume"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Resume_sessionTargetId_idx" ON "Resume"("sessionTargetId");

-- CreateIndex
CREATE INDEX "Resume_jobId_idx" ON "Resume"("jobId");

-- CreateIndex
CREATE INDEX "Resume_deletedAt_idx" ON "Resume"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Resume_sessionId_version_key" ON "Resume"("sessionId", "version");

-- CreateIndex
CREATE INDEX "ResumeExport_resumeId_createdAt_idx" ON "ResumeExport"("resumeId", "createdAt");

-- CreateIndex
CREATE INDEX "Application_userId_appliedAt_idx" ON "Application"("userId", "appliedAt");

-- CreateIndex
CREATE INDEX "Application_userId_status_idx" ON "Application"("userId", "status");

-- CreateIndex
CREATE INDEX "Application_resumeId_idx" ON "Application"("resumeId");

-- CreateIndex
CREATE INDEX "Application_jobId_idx" ON "Application"("jobId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileExperience" ADD CONSTRAINT "ProfileExperience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEducation" ADD CONSTRAINT "ProfileEducation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSkill" ADD CONSTRAINT "ProfileSkill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileLink" ADD CONSTRAINT "ProfileLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTarget" ADD CONSTRAINT "SessionTarget_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticFinding" ADD CONSTRAINT "DiagnosticFinding_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticFinding" ADD CONSTRAINT "DiagnosticFinding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequirement" ADD CONSTRAINT "JobRequirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_sessionTargetId_fkey" FOREIGN KEY ("sessionTargetId") REFERENCES "SessionTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeExport" ADD CONSTRAINT "ResumeExport_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- SQL manual abaixo do diff gerado: Prisma não modela RLS, grants nem invariantes
-- que atravessam relações. Mantemos estes controles na migration inicial da PR.

-- RLS deny-by-default: a Data API do Supabase não pode expor tabelas public.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileExperience" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileEducation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileSkill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UploadedDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobRequirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Resume" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResumeExport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE target_role text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', target_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', target_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', target_role);
      EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', target_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', current_user, target_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', current_user, target_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', current_user, target_role);
    END IF;
  END LOOP;
END
$$;

-- Impede referências entre agregados de pessoas ou rodadas diferentes de forma
-- atômica, inclusive quando a escrita não passa por um serviço NestJS.
CREATE FUNCTION "assertResumeOwnership"() RETURNS trigger AS $$
DECLARE
  session_user_id text;
  related_session_id text;
BEGIN
  SELECT "userId" INTO session_user_id FROM "Session" WHERE "id" = NEW."sessionId";
  IF session_user_id IS NULL OR session_user_id <> NEW."userId" THEN
    RAISE EXCEPTION 'Resume.userId must match Session.userId';
  END IF;

  IF NEW."sessionTargetId" IS NOT NULL THEN
    SELECT "sessionId" INTO related_session_id FROM "SessionTarget" WHERE "id" = NEW."sessionTargetId";
    IF related_session_id IS NULL OR related_session_id <> NEW."sessionId" THEN
      RAISE EXCEPTION 'Resume.sessionTargetId must belong to Resume.sessionId';
    END IF;
  END IF;

  IF NEW."jobId" IS NOT NULL THEN
    SELECT "sessionId" INTO related_session_id FROM "Job" WHERE "id" = NEW."jobId";
    IF related_session_id IS NULL OR related_session_id <> NEW."sessionId" THEN
      RAISE EXCEPTION 'Resume.jobId must belong to Resume.sessionId';
    END IF;
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Resume_aggregate_integrity"
BEFORE INSERT OR UPDATE OF "userId", "sessionId", "sessionTargetId", "jobId" ON "Resume"
FOR EACH ROW EXECUTE FUNCTION "assertResumeOwnership"();

CREATE FUNCTION "assertApplicationOwnership"() RETURNS trigger AS $$
DECLARE
  resource_user_id text;
BEGIN
  IF NEW."resumeId" IS NOT NULL THEN
    SELECT "userId" INTO resource_user_id FROM "Resume" WHERE "id" = NEW."resumeId";
    IF resource_user_id IS NULL OR resource_user_id <> NEW."userId" THEN
      RAISE EXCEPTION 'Application.resumeId must belong to Application.userId';
    END IF;
  END IF;

  IF NEW."jobId" IS NOT NULL THEN
    SELECT s."userId" INTO resource_user_id
    FROM "Job" j JOIN "Session" s ON s."id" = j."sessionId"
    WHERE j."id" = NEW."jobId";
    IF resource_user_id IS NULL OR resource_user_id <> NEW."userId" THEN
      RAISE EXCEPTION 'Application.jobId must belong to Application.userId';
    END IF;
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Application_aggregate_integrity"
BEFORE INSERT OR UPDATE OF "userId", "resumeId", "jobId" ON "Application"
FOR EACH ROW EXECUTE FUNCTION "assertApplicationOwnership"();
