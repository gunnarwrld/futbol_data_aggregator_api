ALTER TABLE "ApiKey" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Legacy keys retain ordinary access, never key administration.
UPDATE "ApiKey" SET "isAdmin" = false;
