-- EVERY PROVIDER LIST EVER UPLOADED IS KEPT.
--
-- An insurer's list changes every few months, and a question about what a
-- customer was promised last spring needs last spring's file. Replacing the
-- list used to discard the old one; from here each upload is a row of its own,
-- and the network's own columns simply point at the current one.

CREATE TABLE "medical_network_provider_lists" (
  "id"         TEXT NOT NULL,
  "networkId"  TEXT NOT NULL,
  "storedUrl"  TEXT NOT NULL,
  "fileName"   TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medical_network_provider_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medical_network_provider_lists_networkId_uploadedAt_idx"
  ON "medical_network_provider_lists"("networkId", "uploadedAt");

ALTER TABLE "medical_network_provider_lists"
  ADD CONSTRAINT "medical_network_provider_lists_networkId_fkey"
  FOREIGN KEY ("networkId") REFERENCES "medical_networks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The file each network holds today becomes the first entry in its history.
INSERT INTO "medical_network_provider_lists" ("id", "networkId", "storedUrl", "fileName", "uploadedAt")
SELECT
  "id" || '_v1',
  "id",
  "providerListUrl",
  coalesce("providerListFileName", 'Provider list'),
  coalesce("providerListUpdatedAt", CURRENT_TIMESTAMP)
FROM "medical_networks"
WHERE "providerListUrl" IS NOT NULL;
