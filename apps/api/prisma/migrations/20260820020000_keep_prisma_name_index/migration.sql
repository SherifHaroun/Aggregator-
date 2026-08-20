-- Keep Prisma's declared index AND the case-insensitive one.
--
-- Prisma cannot express a functional index (`lower("name")`) in schema.prisma,
-- so the previous migration left the case-insensitive index sitting under the
-- name Prisma expects for `name @unique`. That reads as drift the next time
-- anyone runs `prisma migrate dev`.
--
-- Give each index its own name instead: the plain one is what the schema
-- declares, the folded one is what actually makes "Dental" and "dental" the
-- same benefit. The plain index is implied by the folded one, so it costs
-- nothing but keeps the schema and the database honest with each other.
ALTER INDEX "insurance_options_name_key" RENAME TO "insurance_options_name_ci_key";

CREATE UNIQUE INDEX "insurance_options_name_key" ON "insurance_options" ("name");
