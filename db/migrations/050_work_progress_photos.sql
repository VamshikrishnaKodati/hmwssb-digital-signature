-- Migration 050: Work progress photos.
-- Per-work photo attachments (JPG/JPEG/PNG/WEBP/GIF, <= 10 MB each). The images are
-- appended (never replace an existing photo) and stored against the Work ID +
-- Estimate/Work Order ID + uploading user + timestamp, so they persist when a
-- user revisits the work. This is a new additive table; the legacy
-- WorkProgressPhotos table is intentionally left untouched.

-- 1. Photo table. On attachment the estimate's WorkID is copied across, so the
--    record stands alone even if the estimate header is later edited.
CREATE TABLE IF NOT EXISTS "WorkProgressImages" (
  "PhotoID"      SERIAL PRIMARY KEY,
  "EstimateID"   INTEGER NOT NULL REFERENCES "EstimateHeader"("EstimateID") ON DELETE CASCADE,
  "WorkID"       TEXT,
  "OriginalName" VARCHAR(255) NOT NULL,
  "MimeType"     VARCHAR(128) NOT NULL,
  "StoredName"   VARCHAR(255) NOT NULL,
  "SizeBytes"    INTEGER NOT NULL DEFAULT 0,
  "UploadedBy"   INTEGER REFERENCES "Users"("UserID"),
  "UploadedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Fast per-estimate lookups (all photo operations are per-estimate).
CREATE INDEX IF NOT EXISTS "ix_workprogressimages_estimate"
  ON "WorkProgressImages" ("EstimateID");