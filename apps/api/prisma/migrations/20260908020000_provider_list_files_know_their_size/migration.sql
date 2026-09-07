-- A file in the history shows its size beside its date, as a file listing does.
-- Older rows were recorded before the size was kept, and show none.
ALTER TABLE "medical_network_provider_lists" ADD COLUMN "sizeBytes" INTEGER;
