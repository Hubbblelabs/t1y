-- The patient diary's details that the profile did not already ask for: two
-- hospital numbers, the home address and the diabetes educator's name. Added as
-- ordinary (custom) questions, so they appear in the app's profile screen, can
-- be reworded in the dashboard, and are read by the patient-diary export.
-- Fixed ids make a re-run harmless. Not marked "required" here: the app asks
-- for them after a few days of use instead of blocking every profile save.
INSERT INTO "ProfileFieldDefinition"
  ("id", "key", "fieldType", "section", "required", "active", "sortOrder",
   "labelEn", "labelTa", "hintEn", "hintTa", "rules", "updatedAt")
VALUES
  ('pfd_diary_hospital_no', 'hospitalNumber', 'TEXT', 'Hospital and care team', false, true, 140,
   'Hospital number', 'மருத்துவமனை எண்',
   'Your child''s number at the hospital, if there is one.', 'மருத்துவமனையில் உங்கள் குழந்தையின் எண், இருந்தால்.',
   '{"minLength":1,"maxLength":40,"format":"ANY"}', CURRENT_TIMESTAMP),
  ('pfd_diary_other_hospital_no', 'otherHospitalNumber', 'TEXT', 'Hospital and care team', false, true, 150,
   'Other hospital number', 'மற்றொரு மருத்துவமனை எண்',
   'If your child is registered at a second hospital, its number.', 'குழந்தை இரண்டாவது மருத்துவமனையிலும் பதிவு செய்திருந்தால், அதன் எண்.',
   '{"minLength":1,"maxLength":40,"format":"ANY"}', CURRENT_TIMESTAMP),
  ('pfd_diary_address', 'address', 'TEXT', 'Contact', false, true, 65,
   'Home address', 'வீட்டு முகவரி',
   NULL, NULL,
   '{"minLength":1,"maxLength":200,"format":"ANY"}', CURRENT_TIMESTAMP),
  ('pfd_diary_educator', 'educatorName', 'TEXT', 'Hospital and care team', false, true, 160,
   'Diabetes educator''s name', 'நீரிழிவு கல்வியாளரின் பெயர்',
   NULL, NULL,
   '{"minLength":1,"maxLength":120,"format":"ANY"}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
