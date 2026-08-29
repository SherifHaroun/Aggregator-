-- Inputs that appear when a particular ANSWER is chosen, and settings that only
-- apply to some customer types.
--
-- FIRST, "Other" is not an answer. It means "none of these, and here is what it
-- actually is" — and a dropdown that stops at "Other" has thrown the real answer
-- away. `showWhenChoiceId` attaches an input to one answer, so choosing "Other"
-- reveals the box that says what it was, "Specific procedures" reveals the list
-- of which, and "Subject to conditions" reveals the conditions. Everything else
-- stays hidden, so the screen never asks a question the document has not raised.
--
-- SECOND, some questions do not exist for some buyers. A member ratio — "one in
-- twenty members" — is a rule about a group, and an individual policy has no
-- group; putting the box on an individual plan invites an answer that cannot be
-- true. `customerTypes` lists who a setting applies to, and EMPTY MEANS
-- EVERYONE, so nothing that exists today changes.

ALTER TABLE "option_fields" ADD COLUMN "showWhenChoiceId" TEXT;

ALTER TABLE "option_fields"
    ADD COLUMN "customerTypes" "CustomerType"[] DEFAULT ARRAY[]::"CustomerType"[];

CREATE INDEX "option_fields_showWhenChoiceId_idx"
    ON "option_fields" ("showWhenChoiceId");

-- Deleting the answer deletes the input that existed only to describe it.
ALTER TABLE "option_fields"
    ADD CONSTRAINT "option_fields_showWhenChoiceId_fkey"
    FOREIGN KEY ("showWhenChoiceId") REFERENCES "option_choices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
