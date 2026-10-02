-- Administrative transport only. Applied: private_drawing_upload_staging.
CREATE TABLE seoripul_private.drawing_upload_chunks (
  upload_id text NOT NULL,
  part integer NOT NULL CHECK (part >= 0),
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, part)
);
ALTER TABLE seoripul_private.drawing_upload_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE seoripul_private.drawing_upload_chunks FROM PUBLIC, anon, authenticated;

-- Assemble ordered parts through the administrative connection. Check complete
-- part count, length, expected drawing revision, and every saved record key before
-- updating site_drawings. Delete only that upload's parts after a successful
-- replacement, within the same transaction. Never delete construction records.
