-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OptionFieldDataType" AS ENUM ('NUMBER', 'PERCENTAGE', 'CURRENCY', 'TEXT', 'BOOLEAN');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_options" (
    "id" TEXT NOT NULL,
    "insuranceTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_fields" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "dataType" "OptionFieldDataType" NOT NULL,
    "unit" TEXT,
    "helpText" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "option_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "insuranceTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "currency" VARCHAR(3),
    "annualPrice" DECIMAL(14,2),
    "annualLimit" DECIMAL(14,2),
    "deductible" DECIMAL(14,2),
    "coPayment" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_options" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_option_values" (
    "id" TEXT NOT NULL,
    "planOptionId" TEXT NOT NULL,
    "optionFieldId" TEXT NOT NULL,
    "numberValue" DECIMAL(18,4),
    "textValue" TEXT,
    "booleanValue" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_option_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_isActive_idx" ON "companies"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_types_name_key" ON "insurance_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_types_code_key" ON "insurance_types"("code");

-- CreateIndex
CREATE INDEX "insurance_types_isActive_idx" ON "insurance_types"("isActive");

-- CreateIndex
CREATE INDEX "insurance_options_insuranceTypeId_isActive_idx" ON "insurance_options"("insuranceTypeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_options_insuranceTypeId_name_key" ON "insurance_options"("insuranceTypeId", "name");

-- CreateIndex
CREATE INDEX "option_fields_optionId_isActive_idx" ON "option_fields"("optionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "option_fields_optionId_key_key" ON "option_fields"("optionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "option_fields_optionId_label_key" ON "option_fields"("optionId", "label");

-- CreateIndex
CREATE INDEX "plans_companyId_isActive_idx" ON "plans"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "plans_insuranceTypeId_isActive_idx" ON "plans"("insuranceTypeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "plans_companyId_code_key" ON "plans"("companyId", "code");

-- CreateIndex
CREATE INDEX "plan_options_planId_sortOrder_idx" ON "plan_options"("planId", "sortOrder");

-- CreateIndex
CREATE INDEX "plan_options_optionId_idx" ON "plan_options"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_options_planId_optionId_key" ON "plan_options"("planId", "optionId");

-- CreateIndex
CREATE INDEX "plan_option_values_optionFieldId_idx" ON "plan_option_values"("optionFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_option_values_planOptionId_optionFieldId_key" ON "plan_option_values"("planOptionId", "optionFieldId");

-- AddForeignKey
ALTER TABLE "insurance_options" ADD CONSTRAINT "insurance_options_insuranceTypeId_fkey" FOREIGN KEY ("insuranceTypeId") REFERENCES "insurance_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_fields" ADD CONSTRAINT "option_fields_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "insurance_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_insuranceTypeId_fkey" FOREIGN KEY ("insuranceTypeId") REFERENCES "insurance_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_options" ADD CONSTRAINT "plan_options_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_options" ADD CONSTRAINT "plan_options_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "insurance_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_option_values" ADD CONSTRAINT "plan_option_values_planOptionId_fkey" FOREIGN KEY ("planOptionId") REFERENCES "plan_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_option_values" ADD CONSTRAINT "plan_option_values_optionFieldId_fkey" FOREIGN KEY ("optionFieldId") REFERENCES "option_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

