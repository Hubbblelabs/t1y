-- Default SOS contacts, shown to every child until a coordinator edits or
-- removes them under "What families see → SOS contacts". Inserted once; the
-- fixed ids make a re-run harmless.
INSERT INTO "SosContact" ("id", "name", "phone", "label", "visibleToAll", "active", "sortOrder", "updatedAt")
VALUES
  ('sos_default_ambulance', 'Ambulance', '108', 'Emergency', true, true, -2, CURRENT_TIMESTAMP),
  ('sos_default_emergency', 'Emergency helpline', '112', 'Emergency', true, true, -1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
