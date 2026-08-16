-- Introduces PlanConfiguration: one plan, priced and configured per
-- customer type + geographical coverage.
--
-- Pricing columns move from `plans` to `plan_configurations`, and
-- `plan_options` reattaches from the plan to the configuration.
--
-- SAFE ONLY ON AN EMPTY DATABASE: `plan_options.planConfigurationId` is added
-- NOT NULL with no default, and the dropped `plans` columns are not migrated.
-- The project has never carried data (no seed data by design), so no backfill
-- is required.

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'FAMILY', 'SME');

-- CreateEnum
CREATE TYPE "GeographicalCoverage" AS ENUM ('LOCAL', 'INTERNATIONAL');

-- DropForeignKey
ALTER TABLE "plan_options" DROP CONSTRAINT "plan_options_planId_fkey";

-- DropIndex
DROP INDEX "plan_options_planId_sortOrder_idx";

-- DropIndex
DROP INDEX "plan_options_planId_optionId_key";

-- AlterTable
ALTER TABLE "plans" DROP COLUMN "annualLimit",
DROP COLUMN "annualPrice",
DROP COLUMN "coPayment",
DROP COLUMN "currency",
DROP COLUMN "deductible";

-- AlterTable
ALTER TABLE "plan_options" DROP COLUMN "planId",
ADD COLUMN     "planConfigurationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "plan_configurations" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL,
    "geographicalCoverage" "GeographicalCoverage" NOT NULL,
    "currency" VARCHAR(3),
    "annualPrice" DECIMAL(14,2),
    "annualLimit" DECIMAL(14,2),
    "deductible" DECIMAL(14,2),
    "coPayment" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_configurations_customerType_geographicalCoverage_isAct_idx" ON "plan_configurations"("customerType", "geographicalCoverage", "isActive");

-- CreateIndex
CREATE INDEX "plan_configurations_planId_isActive_idx" ON "plan_configurations"("planId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "plan_configurations_planId_customerType_geographicalCoverag_key" ON "plan_configurations"("planId", "customerType", "geographicalCoverage");

-- CreateIndex
CREATE INDEX "plans_category_idx" ON "plans"("category");

-- CreateIndex
CREATE INDEX "plan_options_planConfigurationId_sortOrder_idx" ON "plan_options"("planConfigurationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "plan_options_planConfigurationId_optionId_key" ON "plan_options"("planConfigurationId", "optionId");

-- AddForeignKey
ALTER TABLE "plan_configurations" ADD CONSTRAINT "plan_configurations_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_options" ADD CONSTRAINT "plan_options_planConfigurationId_fkey" FOREIGN KEY ("planConfigurationId") REFERENCES "plan_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

