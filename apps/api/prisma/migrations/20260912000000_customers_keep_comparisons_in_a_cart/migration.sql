-- CUSTOMERS, AND THE COMPARISONS KEPT FOR THEM.
--
-- The broker's employees take calls. A caller becomes a customer record —
-- name required, phone and email as given — and the comparisons run for them
-- go into the customer's CART: a working list, in the order they were run,
-- until the customer settles on one and it is marked chosen.
--
-- A cart entry points at the variant it was saved with and carries a SNAPSHOT
-- of the company, plan and premium, so a plan withdrawn later leaves the entry
-- readable: the customer was quoted a figure on a date, and the cart says so.
-- Deleting a customer takes the cart with it; deleting a variant only unhooks
-- the entries that named it.

CREATE TABLE "customers" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "phone"     TEXT,
  "email"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customers_name_idx" ON "customers"("name");

CREATE TABLE "customer_cart_items" (
  "id"                  TEXT NOT NULL,
  "customerId"          TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "nameSequence"        INTEGER NOT NULL,
  "note"                TEXT,
  "planConfigurationId" TEXT,
  "planId"              TEXT,
  "companyId"           TEXT,
  "companyName"         TEXT NOT NULL,
  "planName"            TEXT NOT NULL,
  "customerType"        "CustomerType" NOT NULL,
  "annualPrice"         DECIMAL(14,2),
  "currency"            VARCHAR(3),
  "criteria"            JSONB NOT NULL,
  "chosenAt"            TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_cart_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_cart_items_customerId_createdAt_idx"
  ON "customer_cart_items"("customerId", "createdAt");
CREATE INDEX "customer_cart_items_planConfigurationId_idx"
  ON "customer_cart_items"("planConfigurationId");

ALTER TABLE "customer_cart_items"
  ADD CONSTRAINT "customer_cart_items_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_cart_items"
  ADD CONSTRAINT "customer_cart_items_planConfigurationId_fkey"
  FOREIGN KEY ("planConfigurationId") REFERENCES "plan_configurations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
