-- ============================================================
-- Draft short descriptions for topic library
-- Run in Supabase Studio > SQL Editor AFTER migration 017
--
-- These are drafts. Review and approve at:
-- /admin/review-descriptions.html
-- ============================================================

-- Match on title (case-insensitive). Only sets where short_description is null.

UPDATE topic_library SET short_description = 'Learn how to lower scores from inside 100 yards with improved wedges, pitching and smarter shot selection.', short_description_status = 'draft' WHERE lower(title) = lower('100 yards & in scoring school') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Build a repeatable putting routine and learn how to read greens. Fewer putts means lower scores.', short_description_status = 'draft' WHERE lower(title) = lower('Putting masterclass') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Improve your short game around the green. Better chips and pitches save more shots than anything else.', short_description_status = 'draft' WHERE lower(title) = lower('Short game fundamentals') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'A complete session covering driving, iron play, short game and putting. Find the quickest wins in your game.', short_description_status = 'draft' WHERE lower(title) = lower('Full game coaching class') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Learn how to compress the ball and create cleaner strikes. Work on body movement, low point control and tempo.', short_description_status = 'draft' WHERE lower(title) = lower('Strike your irons purely') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Deliver more clubhead speed into your tee shots without losing consistency. Distance and accuracy together.', short_description_status = 'draft' WHERE lower(title) = lower('Tee shot distance clinic & pace putting') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Learn when and how to use your hybrid from different lies. A great session for improving confidence with long approach shots.', short_description_status = 'draft' WHERE lower(title) = lower('5 ways to use the hybrid') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Improve your pitching and chipping before learning how to hole more putts from inside ten feet. Turn good shots into lower scores.', short_description_status = 'draft' WHERE lower(title) = lower('Pitch, chip & putt') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Master the basics of a good golf swing. Grip, posture, alignment and a smooth tempo that you can trust.', short_description_status = 'draft' WHERE lower(title) = lower('Swing fundamentals') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Get confident with your driver. Learn the set-up changes that help you hit it further and straighter off the tee.', short_description_status = 'draft' WHERE lower(title) = lower('Driver confidence') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Hit your fairway woods and long irons with confidence. The right technique for distance shots from the fairway.', short_description_status = 'draft' WHERE lower(title) = lower('Fairway woods & long irons') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Learn to read the course and pick the right shot for each situation. Play smarter, score lower.', short_description_status = 'draft' WHERE lower(title) = lower('Course management') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Build consistency with your irons from the fairway. Focus on contact, distance control and shot shape.', short_description_status = 'draft' WHERE lower(title) = lower('Fairway shot consistency!') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Get out of bunkers first time, every time. The right technique and the confidence to trust it.', short_description_status = 'draft' WHERE lower(title) = lower('Bunker play') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Work on the mental side of your game. Stay calm, focused and positive when it counts most.', short_description_status = 'draft' WHERE lower(title) = lower('Mental game') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'A relaxed session for newer golfers. Learn the basics in a friendly group with no pressure.', short_description_status = 'draft' WHERE lower(title) = lower('Beginner friendly') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Improve your chipping from around the green. Get the ball closer to the pin and save more pars.', short_description_status = 'draft' WHERE lower(title) = lower('Chipping clinic') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Master the wedge shots from 50 to 100 yards. Control your distance and spin to attack the pin.', short_description_status = 'draft' WHERE lower(title) = lower('Wedge play') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Focus on hitting greens in regulation. The iron shots that set up birdie and par chances.', short_description_status = 'draft' WHERE lower(title) = lower('Approach play') AND short_description IS NULL;

UPDATE topic_library SET short_description = 'Learn to shape your shots left and right on command. A useful skill for navigating any course.', short_description_status = 'draft' WHERE lower(title) = lower('Shot shaping') AND short_description IS NULL;

-- Any topics not matched above will show as "Empty" in the review page.
-- Edit and approve them at /admin/review-descriptions.html
