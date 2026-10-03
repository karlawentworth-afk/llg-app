-- Import 52 videos into the library
-- Run after migration 020
-- Hidden videos: active = false (old, promo, duplicates, unclear)
-- is_free = false for all; Beginner free set applied separately

UPDATE videos SET title = 'Lag putting', category = 'Putting', is_free = false, active = true WHERE wix_file_id = '3fcc04_478a3c560256407ba7c233f7dbd03f83';
UPDATE videos SET title = 'The bump and run', category = 'Chipping and pitching', is_free = false, active = true WHERE wix_file_id = '3fcc04_d584646521ae46f0b34cfb456c5b3766';
UPDATE videos SET title = 'The Texas wedge', category = 'Chipping and pitching', is_free = false, active = true WHERE wix_file_id = '3fcc04_bb4e54caf1514336bad4356b5de1f517';
UPDATE videos SET title = 'Iron striking: the divot', category = 'Irons', is_free = false, active = true WHERE wix_file_id = '3fcc04_7b015e6fa9a547fda4623508172d81c0';
UPDATE videos SET title = 'Tee shot strategy', category = 'Course management', is_free = false, active = true WHERE wix_file_id = '3fcc04_9f11cbaf27d749b6b5a94ebca24d2d0a';
UPDATE videos SET title = 'European Golf School', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_ee9cafad2df74232925036597538f86b';
UPDATE videos SET title = 'Sloping lies', category = 'Course management', is_free = false, active = true WHERE wix_file_id = '3fcc04_0a5aeed112ee48bf81c65c8e22ea988e';
UPDATE videos SET title = 'Hitting from the rough', category = 'Course management', is_free = false, active = true WHERE wix_file_id = '3fcc04_097ca3c2193c4127b8a70389a401f608';
UPDATE videos SET title = 'Etiquette and pace of play', category = 'Rules and etiquette', is_free = false, active = true WHERE wix_file_id = '3fcc04_6224e53572354b16a4425ab53c53f502';
UPDATE videos SET title = 'Online plans', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_ee5351fbb5f64bd2aace53266694fc3b';
UPDATE videos SET title = 'Pre-shot routine', category = 'Mental game and routine', is_free = false, active = true WHERE wix_file_id = '3fcc04_a029dceedc004e86b019d26892a7f51a';
UPDATE videos SET title = 'Pre-shot routine (duplicate)', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_868acf4a4302428b90f8a640f4f4762e';
UPDATE videos SET title = 'Smart course management for beginners', category = 'Course management', is_free = false, active = true WHERE wix_file_id = '3fcc04_793c741c1a8a4d44a9c8763aeb11f305';
UPDATE videos SET title = 'Sloping lies in the bunker', category = 'Bunkers', is_free = false, active = true WHERE wix_file_id = '3fcc04_c1dc88aece3748bca80934424d85ecda';
UPDATE videos SET title = 'The hybrid, your secret weapon', category = 'Woods and hybrids', is_free = false, active = true WHERE wix_file_id = '3fcc04_b45599c7ccea4e5fb9dc50dfeef5435b';
UPDATE videos SET title = 'Dealing with first tee nerves', category = 'Mental game and routine', is_free = false, active = true WHERE wix_file_id = '3fcc04_dfc116347c8040b0a1ada22fecbe1441';
UPDATE videos SET title = 'Long shots from the fairway', category = 'Woods and hybrids', is_free = false, active = true WHERE wix_file_id = '3fcc04_a14e734e3ec746799a9bef5c6c127069';
UPDATE videos SET title = 'The half swing', category = 'Full swing', is_free = false, active = true WHERE wix_file_id = '3fcc04_647bd47cf93c428981caf94ce6e9e77f';
UPDATE videos SET title = 'How to complete a scorecard', category = 'Rules and etiquette', is_free = false, active = true WHERE wix_file_id = '3fcc04_032349633a5d48238bdfc5f77696e010';
UPDATE videos SET title = 'What''s in the bag', category = 'Getting started', is_free = false, active = true WHERE wix_file_id = '3fcc04_09e323e497b148619f498826ca506071';
UPDATE videos SET title = 'Playing in the wind', category = 'Course management', is_free = false, active = true WHERE wix_file_id = '3fcc04_59cdf209e73f40cbacb6de3c521da917';
UPDATE videos SET title = 'Driver consistency', category = 'Driving', is_free = false, active = true WHERE wix_file_id = '3fcc04_bdfa97a0b1644bc6a49daceb0e5f7861';
UPDATE videos SET title = 'Fairway woods: set-up differences', category = 'Woods and hybrids', is_free = false, active = true WHERE wix_file_id = '3fcc04_248ca93297e2410eb952591607790ace';
UPDATE videos SET title = 'The punch shot from under trees', category = 'Course management', is_free = false, active = true WHERE wix_file_id = '3fcc04_8e3ed40685cd4466bd0476c8f1473f34';
UPDATE videos SET title = 'Escaping bunkers with confidence', category = 'Bunkers', is_free = false, active = true WHERE wix_file_id = '3fcc04_728ffff5e3214b008c9404e10c8b8e38';
UPDATE videos SET title = 'Distance control in chipping', category = 'Chipping and pitching', is_free = false, active = true WHERE wix_file_id = '3fcc04_2aa60fa0842345e4afabc9b794df709a';
UPDATE videos SET title = 'The 3 foot putt: never miss a short putt again', category = 'Putting', is_free = false, active = true WHERE wix_file_id = '3fcc04_fc2eb83e31124725af2696c49ea3af7c';
UPDATE videos SET title = 'Putting fundamentals: grip, stance and stroke', category = 'Putting', is_free = false, active = true WHERE wix_file_id = '3fcc04_8c5e836abf8b468a9afa97cff08155bc';
UPDATE videos SET title = 'Reading the green: simple strategies', category = 'Putting', is_free = false, active = true WHERE wix_file_id = '3fcc04_9d5a9f8385e64278aa41fb495ed2cf19';
UPDATE videos SET title = 'Chipping technique: get it up and down', category = 'Chipping and pitching', is_free = false, active = true WHERE wix_file_id = '3fcc04_9fc9ae8940634f30a4821c3ea22cf2c8';
UPDATE videos SET title = 'Warm-up routine for the driving range', category = 'Practice and warm up', is_free = false, active = true WHERE wix_file_id = '3fcc04_92b0a21c231b49f0a40440bb0be89828';
UPDATE videos SET title = 'The pitch shot', category = 'Chipping and pitching', is_free = false, active = true WHERE wix_file_id = '3fcc04_3beff0fc5de646f19cf49869f096e002';
UPDATE videos SET title = 'Understanding your club distances', category = 'Getting started', is_free = false, active = true WHERE wix_file_id = '3fcc04_ed885b94a07c45ab8d8a336a10fdfe1a';
UPDATE videos SET title = 'Video 10-08-2025, 09 36 34 (1)', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_31992cdc526e454fa048c352c279f84d';
UPDATE videos SET title = 'xmas 22', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_9b0dff8464204895aa12898988fc43cd';
UPDATE videos SET title = 'bunker vid', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_a8008022d63346f78d3c81ee1582e8ec';
UPDATE videos SET title = 'THIS WEEKS SESSIONS AT LLG 2103', category = NULL, is_free = false, active = false WHERE wix_file_id = 'e38d12_df83c502f48c4eb3828c832064c045b9';
UPDATE videos SET title = 'W&G partner with LLG', category = NULL, is_free = false, active = false WHERE wix_file_id = 'e38d12_9120ee9654eb47fea8f77ad33156423d';
UPDATE videos SET title = '2023 Solheim Cup', category = NULL, is_free = false, active = false WHERE wix_file_id = 'e38d12_78abe359203144f4908e7196244acb0e';
UPDATE videos SET title = 'IMG_9247', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_0ff44165df4541b1b243a3bf0fb3423f';
UPDATE videos SET title = 'WhatsApp Video 2021-07-05 at 5.07.48 PM', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_4b6f57ce30b74810992605669813d9ca';
UPDATE videos SET title = 'WhatsApp Video 2021-06-01 at 8.15.18 PM', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_91a5357a7ac04aeaa0816a25093be807';
UPDATE videos SET title = 'First week back', category = NULL, is_free = false, active = false WHERE wix_file_id = '8aab4f_828eba86313c4860b6189d0afed2c7db';
UPDATE videos SET title = 'New site video clip', category = NULL, is_free = false, active = false WHERE wix_file_id = '8aab4f_007493853c6e4351b1d45448594ae153';
UPDATE videos SET title = 'LLG Main Intro RC01', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_2d553aae96cb416cba608cc63f8f1af8';
UPDATE videos SET title = 'Analysis Example - putting', category = NULL, is_free = false, active = false WHERE wix_file_id = '8aab4f_f6d7a0d5c20041ca82dc878bd39e97d3';
UPDATE videos SET title = 'Chipping', category = NULL, is_free = false, active = false WHERE wix_file_id = '8aab4f_23568454cf01483e859b45765c3ec208';
UPDATE videos SET title = 'IMG_3740', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_d173d635314f4799892aaddfe7e6e090';
UPDATE videos SET title = 'FREE Analysis', category = NULL, is_free = false, active = false WHERE wix_file_id = '8aab4f_d38a6305018346c294cee378dae93528';
UPDATE videos SET title = 'Putting clip - short', category = NULL, is_free = false, active = false WHERE wix_file_id = '8aab4f_ed9bb852e2d348b880936881fa0536ab';
UPDATE videos SET title = 'Intro Video', category = NULL, is_free = false, active = false WHERE wix_file_id = '8aab4f_c1bbb00a66064b4c9ec3e31e7c2175c4';
UPDATE videos SET title = 'IMG_1612', category = NULL, is_free = false, active = false WHERE wix_file_id = '3fcc04_6ec453348bea478dad0276f2ae6e82b5';

-- Result: 33 active coaching videos, 19 hidden
