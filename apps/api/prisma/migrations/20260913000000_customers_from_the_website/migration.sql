-- Where a customer came from: written down by an employee ("STAFF"), or
-- signed in on the public site themselves ("WEBSITE").
ALTER TABLE "customers" ADD COLUMN "source" VARCHAR(16) NOT NULL DEFAULT 'STAFF';
