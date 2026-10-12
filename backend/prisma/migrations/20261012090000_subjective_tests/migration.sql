-- Written-answer questions checked by a teacher, and a per-test limit on leaving the app.
ALTER TYPE "QuestionType" ADD VALUE 'SUBJECTIVE';

CREATE TYPE "EvalStatus" AS ENUM ('AUTO', 'PENDING', 'DONE');

ALTER TABLE "tests" ADD COLUMN "maxLeaves" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "attempts" ADD COLUMN "endReason" TEXT,
ADD COLUMN "evaluation" "EvalStatus" NOT NULL DEFAULT 'AUTO',
ADD COLUMN "checkedAt" TIMESTAMP(3),
ADD COLUMN "checkedById" TEXT;

ALTER TABLE "attempt_answers" ADD COLUMN "textAnswer" TEXT,
ADD COLUMN "imageKeys" TEXT[],
ADD COLUMN "awardedMarks" DECIMAL(5,2),
ADD COLUMN "feedback" TEXT;
