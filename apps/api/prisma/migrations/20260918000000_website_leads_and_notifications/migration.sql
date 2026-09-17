-- The customer site no longer has accounts: a visitor leaves their details as a
-- LEAD before the results, and the lead is the employee's notification. It
-- advances — compared, viewed, chosen — rather than becoming three rows.

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('COMPARED', 'VIEWED', 'CHOSEN');

-- CreateEnum
CREATE TYPE "LeadEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'NOT_CONFIGURED');

-- No sign-in, no password.
ALTER TABLE "customers" DROP COLUMN "passwordHash";

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "companyName" TEXT,
    "criteria" JSONB NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'COMPARED',
    "chosenCartItemId" TEXT,
    "chosenPlanConfigurationId" TEXT,
    "chosenCompanyName" TEXT,
    "chosenPlanName" TEXT,
    "chosenAnnualPrice" DECIMAL(14,2),
    "chosenCurrency" VARCHAR(3),
    "chosenAt" TIMESTAMP(3),
    "choiceEmailStatus" "LeadEmailStatus",
    "choiceEmailedAt" TIMESTAMP(3),
    "choiceEmailError" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_plan_views" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "planConfigurationId" TEXT NOT NULL,
    "planId" TEXT,
    "companyId" TEXT,
    "companyName" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL,
    "annualPrice" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "emailStatus" "LeadEmailStatus" NOT NULL DEFAULT 'PENDING',
    "emailedAt" TIMESTAMP(3),
    "emailError" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_plan_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_chosenCartItemId_key" ON "leads"("chosenCartItemId");

-- CreateIndex
CREATE INDEX "leads_lastActivityAt_idx" ON "leads"("lastActivityAt");

-- CreateIndex
CREATE INDEX "leads_seenAt_idx" ON "leads"("seenAt");

-- CreateIndex
CREATE INDEX "leads_customerId_createdAt_idx" ON "leads"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_plan_views_leadId_viewedAt_idx" ON "lead_plan_views"("leadId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "lead_plan_views_leadId_planConfigurationId_key" ON "lead_plan_views"("leadId", "planConfigurationId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_chosenCartItemId_fkey" FOREIGN KEY ("chosenCartItemId") REFERENCES "customer_cart_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_plan_views" ADD CONSTRAINT "lead_plan_views_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
