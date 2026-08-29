-- Structured benefit entry: optional conditions, and networks that belong to
-- the company rather than to a plan.
--
-- Two changes, both about matching what an insurance document actually says.
--
-- FIRST, a setting becomes either a core field or an ADDITIONAL CONDITION. A
-- document that never mentions a co-payment should not put an empty co-payment
-- box in front of anybody, because an empty box invites a zero and a zero is a
-- claim the document never made. A condition is a toggle instead, and its input
-- appears only when the employee turns it on.
--
-- The toggle's state is deliberately NOT a new column. A row in
-- `plan_option_values` IS the toggle: present means the condition applies —
-- with a figure, or with the figure still blank because the document did not
-- give one — and absent means the document did not state it at all. One fact
-- kept in one place, so the two can never disagree.
--
-- Some conditions need more than one box: "1 in 20 members", "10 sessions per
-- year", "approval every 12 sessions". `parentFieldId` gives a condition its
-- own inputs, one level deep, removed with it when it is switched off.
--
-- SECOND, medical networks move to the company. A network is not something a
-- plan covers — it is the estate of providers a company sells access to, and
-- every plan that company offers picks one. As a benefit it had to be re-typed
-- on every plan of every company. Nothing is migrated here; the values recorded
-- against the old benefit are moved by a separate, reviewed data step, and the
-- benefit is only retired once they are safely across.

ALTER TABLE "option_fields" ADD COLUMN "isOptional" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "option_fields" ADD COLUMN "parentFieldId" TEXT;

CREATE INDEX "option_fields_optionId_parentFieldId_sortOrder_idx"
    ON "option_fields" ("optionId", "parentFieldId", "sortOrder");

-- Switching a condition off takes its inputs with it.
ALTER TABLE "option_fields"
    ADD CONSTRAINT "option_fields_parentFieldId_fkey"
    FOREIGN KEY ("parentFieldId") REFERENCES "option_fields"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "company_medical_networks" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    -- The company's own ranking of its networks, best first.
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_medical_networks_pkey" PRIMARY KEY ("id")
);

-- One company cannot sell two networks of the same name.
CREATE UNIQUE INDEX "company_medical_networks_companyId_name_key"
    ON "company_medical_networks" ("companyId", "name");

CREATE INDEX "company_medical_networks_companyId_sortOrder_idx"
    ON "company_medical_networks" ("companyId", "sortOrder");

ALTER TABLE "company_medical_networks"
    ADD CONSTRAINT "company_medical_networks_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Which network a plan is sold on. NULL where the document does not say.
ALTER TABLE "plans" ADD COLUMN "medicalNetworkId" TEXT;

CREATE INDEX "plans_medicalNetworkId_idx" ON "plans" ("medicalNetworkId");

-- Retiring a network must never delete the plans sold on it; they simply stop
-- naming one, which reads as "not stated" rather than as a plan disappearing.
ALTER TABLE "plans"
    ADD CONSTRAINT "plans_medicalNetworkId_fkey"
    FOREIGN KEY ("medicalNetworkId") REFERENCES "company_medical_networks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
