/*
  Warnings:

  - You are about to drop the column `correctAnswer` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `explanation` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `question` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `questionId` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `questionType` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `userAnswer` on the `Exam` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "correctAnswer",
DROP COLUMN "explanation",
DROP COLUMN "question",
DROP COLUMN "questionId",
DROP COLUMN "questionType",
DROP COLUMN "title",
DROP COLUMN "userAnswer",
ADD COLUMN     "courseName" TEXT,
ADD COLUMN     "examDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "wrongMCQs" TEXT,
ADD COLUMN     "wrongShortAnswers" TEXT;
