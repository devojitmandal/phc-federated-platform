-- PHC Federated Platform — seed data
-- Population per rural PHC: ~35,600 (Rural Health Statistics 2020-21)
-- 2 states × 4 districts × ~2-3 PHCs = 20 facilities

-- ---------------------------------------------------------------------------
-- States
-- ---------------------------------------------------------------------------

INSERT INTO states (id, code, name_en, name_hi) VALUES
  ('11111111-1111-1111-1111-111111111101', 'RJ', 'Rajasthan', 'राजस्थान'),
  ('11111111-1111-1111-1111-111111111102', 'KA', 'Karnataka', 'कर्नाटक');

-- ---------------------------------------------------------------------------
-- Districts (real names; population = sum of PHC populations in district)
-- ---------------------------------------------------------------------------

INSERT INTO districts (id, state_id, code, name_en, name_hi, population) VALUES
  -- Rajasthan
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'RJ-JPR', 'Jaipur', 'जयपुर', 142800),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'RJ-JDH', 'Jodhpur', 'जोधपुर', 106800),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'RJ-UDR', 'Udaipur', 'उदयपुर', 71200),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', 'RJ-AJM', 'Ajmer', 'अजमेर', 71200),
  -- Karnataka
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111102', 'KA-MYS', 'Mysuru', 'मैसूर', 106800),
  ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111102', 'KA-BLG', 'Belagavi', 'बेलगावी', 71200),
  ('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111102', 'KA-DKN', 'Dakshina Kannada', 'दक्षिण कन्नड़', 71200),
  ('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111102', 'KA-TMK', 'Tumakuru', 'तुमकुरु', 71200);

-- ---------------------------------------------------------------------------
-- Facilities (real rural PHC names; ~35,600 pop/PHC with realistic variation)
-- Rural PHC bed capacity: typically 4-6 beds
-- ---------------------------------------------------------------------------

INSERT INTO facilities (id, district_id, code, name_en, name_hi, bed_capacity, population_served, lat, lng) VALUES
  -- Jaipur (4 PHCs × ~35,700 avg)
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 'RJ-JPR-AMR', 'PHC Amer', 'पीएचसी आमेर', 6, 35600, 26.988000, 75.852000),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201', 'RJ-JPR-BAS', 'PHC Bassi', 'पीएचसी बस्सी', 6, 35400, 26.838000, 75.978000),
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201', 'RJ-JPR-CKS', 'PHC Chaksu', 'पीएचसी चाकसू', 4, 35800, 26.602000, 75.948000),
  ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222201', 'RJ-JPR-PHG', 'PHC Phagi', 'पीएचसी फागी', 4, 36000, 26.578000, 75.412000),
  -- Jodhpur (3 PHCs)
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222202', 'RJ-JDH-BLR', 'PHC Bilara', 'पीएचसी बिलाड़ा', 6, 35200, 26.178000, 73.138000),
  ('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222202', 'RJ-JDH-OSN', 'PHC Osian', 'पीएचसी ओसियान', 4, 35800, 26.738000, 72.908000),
  ('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222202', 'RJ-JDH-PHD', 'PHC Phalodi', 'पीएचसी फलोदी', 6, 35800, 27.128000, 72.368000),
  -- Udaipur (2 PHCs)
  ('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222203', 'RJ-UDR-GGD', 'PHC Gogunda', 'पीएचसी Gogunda', 4, 35400, 24.778000, 73.688000),
  ('33333333-3333-3333-3333-333333333309', '22222222-2222-2222-2222-222222222203', 'RJ-UDR-KHW', 'PHC Kherwara', 'पीएचसी Kherwara', 6, 35800, 23.988000, 73.578000),
  -- Ajmer (2 PHCs)
  ('33333333-3333-3333-3333-333333333310', '22222222-2222-2222-2222-222222222204', 'RJ-AJM-BWR', 'PHC Beawar', 'पीएचसी Beawar', 6, 35600, 26.108000, 74.318000),
  ('33333333-3333-3333-3333-333333333311', '22222222-2222-2222-2222-222222222204', 'RJ-AJM-KEK', 'PHC Kekri', 'पीएचसी Kekri', 4, 35600, 26.298000, 75.148000),
  -- Mysuru (3 PHCs)
  ('33333333-3333-3333-3333-333333333312', '22222222-2222-2222-2222-222222222205', 'KA-MYS-HNS', 'PHC Hunsur', 'पीएचसी Hunsur', 6, 35600, 12.308000, 76.288000),
  ('33333333-3333-3333-3333-333333333313', '22222222-2222-2222-2222-222222222205', 'KA-MYS-NNJ', 'PHC Nanjangud', 'पीएचसी Nanjangud', 6, 35600, 12.118000, 76.688000),
  ('33333333-3333-3333-3333-333333333314', '22222222-2222-2222-2222-222222222205', 'KA-MYS-TNP', 'PHC T Narasipur', 'पीएचसी T Narasipur', 4, 35600, 12.218000, 76.908000),
  -- Belagavi (2 PHCs)
  ('33333333-3333-3333-3333-333333333315', '22222222-2222-2222-2222-222222222206', 'KA-BLG-ATH', 'PHC Athani', 'पीएचसी Athani', 6, 35600, 16.728000, 75.068000),
  ('33333333-3333-3333-3333-333333333316', '22222222-2222-2222-2222-222222222206', 'KA-BLG-GOK', 'PHC Gokak', 'पीएचसी Gokak', 4, 35600, 16.168000, 74.828000),
  -- Dakshina Kannada (2 PHCs)
  ('33333333-3333-3333-3333-333333333317', '22222222-2222-2222-2222-222222222207', 'KA-DKN-BNT', 'PHC Bantwal', 'पीएचसी Bantwal', 6, 35600, 12.998000, 75.028000),
  ('33333333-3333-3333-3333-333333333318', '22222222-2222-2222-2222-222222222207', 'KA-DKN-PTT', 'PHC Puttur', 'पीएचसी Puttur', 6, 35600, 12.758000, 75.208000),
  -- Tumakuru (2 PHCs)
  ('33333333-3333-3333-3333-333333333319', '22222222-2222-2222-2222-222222222208', 'KA-TMK-KRT', 'PHC Koratagere', 'पीएचसी Koratagere', 4, 35600, 13.518000, 77.238000),
  ('33333333-3333-3333-3333-333333333320', '22222222-2222-2222-2222-222222222208', 'KA-TMK-PVG', 'PHC Pavagada', 'पीएचसी Pavagada', 6, 35600, 14.098000, 77.278000);

-- ---------------------------------------------------------------------------
-- Medicine catalog (~30 Essential Medicines List items common at PHCs)
-- ---------------------------------------------------------------------------

INSERT INTO medicines (code, name_en, name_hi, unit, category, reorder_threshold_days) VALUES
  ('PARA500', 'Paracetamol 500mg', 'पैरासिटामोल 500mg', 'tablets', 'Analgesic/Antipyretic', 7),
  ('IBUP400', 'Ibuprofen 400mg', 'आइबुप्रोफेन 400mg', 'tablets', 'Analgesic/Antipyretic', 7),
  ('AMOX500', 'Amoxicillin 500mg', 'अमोक्सिसिलिन 500mg', 'capsules', 'Antibiotic', 5),
  ('AZITH500', 'Azithromycin 500mg', 'Azithromycin 500mg', 'tablets', 'Antibiotic', 5),
  ('CIPRO500', 'Ciprofloxacin 500mg', 'Ciprofloxacin 500mg', 'tablets', 'Antibiotic', 5),
  ('METF500', 'Metformin 500mg', 'Metformin 500mg', 'tablets', 'Antidiabetic', 10),
  ('GLIB5', 'Glibenclamide 5mg', 'Glibenclamide 5mg', 'tablets', 'Antidiabetic', 10),
  ('AMLOD5', 'Amlodipine 5mg', 'Amlodipine 5mg', 'tablets', 'Antihypertensive', 10),
  ('ATEN50', 'Atenolol 50mg', 'Atenolol 50mg', 'tablets', 'Antihypertensive', 10),
  ('LOSAR50', 'Losartan 50mg', 'Losartan 50mg', 'tablets', 'Antihypertensive', 10),
  ('ORS', 'Oral Rehydration Salts', 'ओआरएस', 'sachets', 'Essential', 5),
  ('ZINC20', 'Zinc Sulphate 20mg', 'Zinc Sulphate 20mg', 'tablets', 'Essential', 7),
  ('ALB400', 'Albendazole 400mg', 'Albendazole 400mg', 'tablets', 'Anthelmintic', 14),
  ('FEFOL', 'Ferrous Folate', 'Ferrous Folate', 'tablets', 'Nutritional', 10),
  ('VITA100', 'Vitamin A 100000 IU', 'Vitamin A', 'capsules', 'Nutritional', 14),
  ('VITD60K', 'Vitamin D3 60000 IU', 'Vitamin D3', 'capsules', 'Nutritional', 14),
  ('SALB100', 'Salbutamol Inhaler', 'Salbutamol Inhaler', 'units', 'Respiratory', 7),
  ('CETR10', 'Cetirizine 10mg', 'Cetirizine 10mg', 'tablets', 'Antihistamine', 10),
  ('RAN150', 'Ranitidine 150mg', 'Ranitidine 150mg', 'tablets', 'Gastrointestinal', 10),
  ('OMEP20', 'Omeprazole 20mg', 'Omeprazole 20mg', 'capsules', 'Gastrointestinal', 10),
  ('ORSZINC', 'Zinc ORS Combo Pack', 'Zinc ORS Combo', 'packs', 'Essential', 5),
  ('BCDT', 'Bandage Cotton', 'Bandage Cotton', 'rolls', 'Consumables', 14),
  ('SYRING5', 'Syringe 5ml', 'Syringe 5ml', 'units', 'Consumables', 14),
  ('GLOVES', 'Examination Gloves', 'Examination Gloves', 'pairs', 'Consumables', 14),
  ('IRON100', 'Iron Folic Acid IFA', 'Iron Folic Acid', 'tablets', 'Maternal Health', 10),
  ('TTVAC', 'TT Vaccine', 'TT Vaccine', 'doses', 'Immunization', 7),
  ('BCGVAC', 'BCG Vaccine', 'BCG Vaccine', 'doses', 'Immunization', 7),
  ('OPV', 'Oral Polio Vaccine', 'Oral Polio Vaccine', 'doses', 'Immunization', 7),
  ('DEXTNS', 'Dextrose Normal Saline', 'Dextrose Normal Saline', 'bottles', 'IV Fluid', 7),
  ('HYDRZC', 'Hydrocortisone Cream 1%', 'Hydrocortisone Cream', 'tubes', 'Dermatological', 14);

-- ---------------------------------------------------------------------------
-- Staff (2-4 per facility for demo)
-- ---------------------------------------------------------------------------

INSERT INTO staff (facility_id, name, role) VALUES
  ('33333333-3333-3333-3333-333333333301', 'Dr. Priya Sharma', 'Medical Officer'),
  ('33333333-3333-3333-3333-333333333301', 'Sunita Devi', 'ANM'),
  ('33333333-3333-3333-3333-333333333301', 'Ram Lal Meena', 'Pharmacist'),
  ('33333333-3333-3333-3333-333333333302', 'Dr. Rajesh Kumar', 'Medical Officer'),
  ('33333333-3333-3333-3333-333333333302', 'Kamla Bai', 'ANM'),
  ('33333333-3333-3333-3333-333333333303', 'Dr. Anil Meena', 'Medical Officer'),
  ('33333333-3333-3333-3333-333333333303', 'Geeta Sharma', 'Staff Nurse'),
  ('33333333-3333-3333-3333-333333333312', 'Dr. Lakshmi Gowda', 'Medical Officer'),
  ('33333333-3333-3333-3333-333333333312', 'Manjula Reddy', 'ANM'),
  ('33333333-3333-3333-3333-333333333312', 'Ramesh Naik', 'Pharmacist');

-- Demo profiles are created after auth users exist via scripts/seed-demo-users.ts
