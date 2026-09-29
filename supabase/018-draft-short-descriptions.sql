-- ============================================================
-- Draft short descriptions for ALL topics (batch by theme)
-- Run in Supabase Studio > SQL Editor AFTER migration 017
-- Review and approve at /admin/review-descriptions.html
-- ============================================================

-- 100 yards / approach play / scoring
UPDATE topic_library SET short_description = 'Sharpen your pitching, chipping and putting from inside 100 yards. This is where the scoring happens.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%100 yard%' OR lower(title) LIKE '%scoring game%' OR lower(title) LIKE '%scoring school%');

-- Approach play
UPDATE topic_library SET short_description = 'Improve your approach shots to the green. Better distance control and accuracy where it counts most.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%approach play%';

-- 3 putting tips / putting
UPDATE topic_library SET short_description = 'Fewer putts means lower scores. Work on your stroke, green reading and distance control on the greens.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%putting%' OR lower(title) LIKE '%putt perfect%' OR lower(title) LIKE '%putt masterclass%' OR lower(title) LIKE '%3 putting%' OR lower(title) LIKE '%hole more putts%');

-- Iron strike / contact / consistency
UPDATE topic_library SET short_description = 'Improve your iron contact for a cleaner, more consistent strike. Stop catching the ground or topping the ball.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%iron%strike%' OR lower(title) LIKE '%iron%contact%' OR lower(title) LIKE '%iron%consist%' OR lower(title) LIKE '%contact%iron%' OR lower(title) LIKE '%strike%iron%' OR lower(title) LIKE '%consistent%iron%' OR lower(title) LIKE '%master your iron%');

-- 3/4/5 secrets to improve contact with irons
UPDATE topic_library SET short_description = 'Top tips and drills to improve the quality of your iron strike. Cleaner contact means better shots.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%secrets to%improve%contact%';

-- 4 rules for striking
UPDATE topic_library SET short_description = 'Four simple checks to help you strike the ball more consistently. Great for building confidence with your irons.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%rules for%strik%';

-- Secrets to improve contact
UPDATE topic_library SET short_description = 'Expert tips and drills to improve your ball striking. Cleaner contact with every club in the bag.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%secrets to%improve%';

-- Driver / tee shots / distance / power / gain yards
UPDATE topic_library SET short_description = 'Hit it further from the tee. Work on technique, speed and set-up to add real yards to your drives.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%driver%distance%' OR lower(title) LIKE '%driver%power%' OR lower(title) LIKE '%driver%speed%' OR lower(title) LIKE '%driver%further%' OR lower(title) LIKE '%gain%yard%' OR lower(title) LIKE '%gain%distance%' OR lower(title) LIKE '%gain%power%' OR lower(title) LIKE '%boost%distance%' OR lower(title) LIKE '%boost%driver%' OR lower(title) LIKE '%increase%distance%' OR lower(title) LIKE '%increase%speed%' OR lower(title) LIKE '%increase%power%' OR lower(title) LIKE '%increase%ball speed%' OR lower(title) LIKE '%increase%carry%' OR lower(title) LIKE '%increase%tee%' OR lower(title) LIKE '%increase%yard%' OR lower(title) LIKE '%power%tee%' OR lower(title) LIKE '%power%speed%' OR lower(title) LIKE '%unlock%power%' OR lower(title) LIKE '%unlock%yard%' OR lower(title) LIKE '%unlock%speed%' OR lower(title) LIKE '%generate%speed%' OR lower(title) LIKE '%generate%width%');

-- Driver consistency / routine
UPDATE topic_library SET short_description = 'Build a reliable driver routine for straighter, more confident tee shots every time you play.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%driver%consist%' OR lower(title) LIKE '%driver%routine%' OR lower(title) LIKE '%driver%direction%');

-- Driver extension / follow through
UPDATE topic_library SET short_description = 'Achieve straighter arms through impact and a fuller follow through for more power and consistency.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%driver%extension%' OR lower(title) LIKE '%extension%follow%' OR lower(title) LIKE '%extension%speed%' OR lower(title) LIKE '%extension%import%');

-- Driver vs iron
UPDATE topic_library SET short_description = 'Understand the key differences between your driver and iron swings. Switch confidently between them on the course.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%driver%vs%iron%';

-- Launch driver high
UPDATE topic_library SET short_description = 'Learn to launch the ball higher from the tee for more carry distance, especially in winter conditions.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%launch%driver%';

-- Tee shot tips / improve tee shots
UPDATE topic_library SET short_description = 'Improve your tee shots with expert tips on set-up, technique and club selection. Hit more fairways.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%tee shot%' OR lower(title) LIKE '%improve%tee%' OR lower(title) LIKE '%improve%driv%' OR lower(title) LIKE '%tips to improve%tee%' OR lower(title) LIKE '%tips to improve%driv%' OR lower(title) LIKE '%tips for tee%');

-- Hit it straight / accuracy / reduce curve
UPDATE topic_library SET short_description = 'Stop the ball curving offline. Work on grip, alignment and swing path to hit it straighter with every club.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%hit it straight%' OR lower(title) LIKE '%reduce%curve%' OR lower(title) LIKE '%stop%curv%' OR lower(title) LIKE '%fix the curve%' OR lower(title) LIKE '%one direction%' OR lower(title) LIKE '%accuracy%alignment%' OR lower(title) LIKE '%alignment%accuracy%');

-- Fairway woods / hybrids
UPDATE topic_library SET short_description = 'Get more consistent with your fairway woods and hybrids from the ground. Better contact, more confidence.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%fairway wood%' OR lower(title) LIKE '%fairway%hybrid%' OR lower(title) LIKE '%hybrid%fairway%' OR lower(title) LIKE '%love the fairway%');

-- Hybrid consistency / versatility
UPDATE topic_library SET short_description = 'The hybrid is the most versatile club in the bag. Learn how to use it confidently from fairway, rough and around the green.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%hybrid%consist%' OR lower(title) LIKE '%hybrid%versatil%' OR lower(title) LIKE '%hybrid%hero%' OR lower(title) LIKE '%hybrid%top tip%' OR lower(title) LIKE '%get consistent with the hybrid%');

-- Hybrids general
UPDATE topic_library SET short_description = 'Improve your hybrid play with expert tips on technique, strike and when to use them on the course.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE 'hybrid%' OR lower(title) LIKE '%hybrid%video%' OR lower(title) LIKE '%hybrid%slop%');

-- Fairway shot consistency
UPDATE topic_library SET short_description = 'Hit cleaner, more consistent shots from the fairway. Focus on contact, height and distance control.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%fairway shot%' OR lower(title) LIKE '%fairway%consist%' OR lower(title) LIKE '%fairway%strike%' OR lower(title) LIKE '%find your fairway%');

-- Short game / pitch / chip
UPDATE topic_library SET short_description = 'Sharpen your short game around the green. Better pitching, chipping and putting where it really counts.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%short game%' OR lower(title) LIKE '%pitch%chip%putt%' OR lower(title) LIKE '%pitch%chip%' OR lower(title) LIKE '%pitch%putt%' OR lower(title) LIKE '%sharpen%short%' OR lower(title) LIKE '%precision play%');

-- Pitch it close / pitch perfect
UPDATE topic_library SET short_description = 'Control your pitching distance and get the ball closer to the pin. Turn approach shots into scoring chances.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%pitch%close%' OR lower(title) LIKE '%pitch%perfect%' OR lower(title) LIKE '%pitch%special%' OR lower(title) LIKE '%pitching%distance%' OR lower(title) LIKE '%pitching%closer%');

-- Chip / chipping
UPDATE topic_library SET short_description = 'Improve your chipping technique for more consistent, confident shots around the green.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%chip%close%' OR lower(title) LIKE '%chip%smart%' OR lower(title) LIKE '%chip%consist%' OR lower(title) LIKE '%chipping%' OR lower(title) LIKE '%club selection around%');

-- Bunker
UPDATE topic_library SET short_description = 'Get out of bunkers with confidence. Learn the right technique for greenside and fairway sand shots.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%bunker%' OR lower(title) LIKE '%escape%sand%' OR lower(title) LIKE '%sand%skill%');

-- Alignment / line up
UPDATE topic_library SET short_description = 'Build a reliable lining-up routine for the course. Better alignment means straighter, more accurate shots.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%alignment%';

-- Rotation / weight transfer / posture
UPDATE topic_library SET short_description = 'Use your body properly through the swing. Better rotation and weight transfer for a cleaner, more powerful strike.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%rotation%' OR lower(title) LIKE '%rotate%' OR lower(title) LIKE '%weight transfer%' OR lower(title) LIKE '%weight shift%' OR lower(title) LIKE '%powerful rotation%');

-- Posture / pivot / pose
UPDATE topic_library SET short_description = 'Check in on your posture, grip and body movement. These fundamentals make everything else easier.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%posture%' OR lower(title) LIKE '%pivot%pose%' OR lower(title) LIKE '%fundamentals%');

-- Stay in posture / stop the lift
UPDATE topic_library SET short_description = 'Stop standing up through the ball. Stay in your posture for a more consistent strike on every shot.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%stay in posture%' OR lower(title) LIKE '%limit the lift%');

-- Stop the sway
UPDATE topic_library SET short_description = 'Stop the sway in your backswing and unlock your full rotation. More power, better contact.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%stop the sway%';

-- Swing rhythm / tempo
UPDATE topic_library SET short_description = 'Find a smooth, repeatable swing rhythm. When the tempo is right, everything else falls into place.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%swing rhythm%' OR lower(title) LIKE '%swing tempo%' OR lower(title) LIKE '%swing easy%' OR lower(title) LIKE '%smooth rhythm%');

-- Mental game / clear the mind / overthinking / free up
UPDATE topic_library SET short_description = 'Quiet the mind over the ball and commit to each shot. Play with more freedom and less overthinking.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%clear the mind%' OR lower(title) LIKE '%free up the mind%' OR lower(title) LIKE '%overthink%' OR lower(title) LIKE '%stop overthink%' OR lower(title) LIKE '%it''s all in the mind%' OR lower(title) LIKE '%stay relaxed%' OR lower(title) LIKE '%think%less%');

-- Connected swing
UPDATE topic_library SET short_description = 'Build a connected swing where your body and arms work together. More consistency with less effort.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%connect%swing%';

-- Compression / rotation
UPDATE topic_library SET short_description = 'Learn to compress the ball for a sharper strike. Better rotation through impact means more control and distance.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%compress%';

-- On course coaching / scoring / scramble
UPDATE topic_library SET short_description = 'Head out on the course with your coach for real-game tips on strategy, club selection and scoring.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%on course%';

-- Full game improver / station rotation / through the bag
UPDATE topic_library SET short_description = 'Work on all parts of your game in one session. Driving, irons, short game and putting with expert tips throughout.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%full game%' OR lower(title) LIKE '%station%' OR lower(title) LIKE '%through the bag%' OR lower(title) LIKE '%switch it up%' OR lower(title) LIKE '%switch the technique%' OR lower(title) LIKE '%quick switch%');

-- Full swing tips / coaching / video
UPDATE topic_library SET short_description = 'Personalised full swing coaching with video feedback. See what you actually do and how to improve it.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%full swing%' OR lower(title) LIKE '%video coaching%' OR lower(title) LIKE '%feel vs real%');

-- Make swing repeatable / consistent
UPDATE topic_library SET short_description = 'Build a repeatable, consistent swing you can trust. The key to playing your best golf more often.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%make your swing%' OR lower(title) LIKE '%achieve%consist%' OR lower(title) LIKE '%become more consist%');

-- Power of wrists
UPDATE topic_library SET short_description = 'Learn when and how to use your wrists in the swing. The right sequence adds power and improves your strike.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%wrist%';

-- Width / power
UPDATE topic_library SET short_description = 'Create more width in your swing for more power and distance. Simple changes that make a real difference.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%width%power%';

-- Extension / follow through (remaining)
UPDATE topic_library SET short_description = 'Focus on arm extension and a full follow through. More speed, straighter shots and better consistency.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%extension%';

-- Trackman / virtual golf / toptracer
UPDATE topic_library SET short_description = 'Use our technology to see your numbers and play virtual golf. Great coaching tips with real data to back them up.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%trackman%' OR lower(title) LIKE '%virtual golf%' OR lower(title) LIKE '%toptracer%');

-- Know your distances / optimal distance
UPDATE topic_library SET short_description = 'Find out how far you really hit each club. Knowing your distances helps you choose the right club every time.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%know your distance%' OR lower(title) LIKE '%understand your distance%' OR lower(title) LIKE '%optimal distance%' OR lower(title) LIKE '%optimum distance%' OR lower(title) LIKE '%how far%');

-- Sloping lies
UPDATE topic_library SET short_description = 'Learn to play confidently from uphill, downhill and sidehill lies. Essential skills for the golf course.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%sloping lie%';

-- Pitching and bunkers combined
UPDATE topic_library SET short_description = 'Two key short game skills in one session. Improve your pitching technique and your bunker play together.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND (lower(title) LIKE '%pitch%bunker%' OR lower(title) LIKE '%bunker%pitch%');

-- Practice effectively
UPDATE topic_library SET short_description = 'Learn how to structure your practice for real improvement. Quality drills that make a difference on the course.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%practice%';

-- Lob shot
UPDATE topic_library SET short_description = 'Learn the high lob shot for getting over bunkers and stopping the ball quickly on the green.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%lob shot%';

-- Ball speed
UPDATE topic_library SET short_description = 'Increase your ball speed for more distance with every club. Simple drills that unlock extra yards.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%ball speed%';

-- Arm extension / improve arm
UPDATE topic_library SET short_description = 'Stop the arms collapsing at impact. Better extension means a cleaner strike and straighter ball flight.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%arm extension%';

-- Reduce slide
UPDATE topic_library SET short_description = 'Stop sliding through the swing and start rotating properly. Better balance, better contact, lower scores.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%reduce the slide%';

-- Centre contact
UPDATE topic_library SET short_description = 'Hit the middle of the clubface more often. Centre contact is the fastest way to better, more consistent shots.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%centre contact%';

-- Golf course alignment / strategy
UPDATE topic_library SET short_description = 'Learn to read the course and line up properly. Smart decisions and good alignment lead to lower scores.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%golf course alignment%';

-- Rules / formats
UPDATE topic_library SET short_description = 'Learn useful rules and popular formats of golf. Helpful knowledge for playing with confidence on the course.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%rules%';

-- Chip over bunkers
UPDATE topic_library SET short_description = 'Build confidence chipping over bunkers to the green. The right technique takes the fear out of these shots.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%chip%over%bunker%';

-- Beginner friendly
UPDATE topic_library SET short_description = 'A relaxed session for newer golfers. Learn the basics in a friendly group with no pressure.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true AND lower(title) LIKE '%beginner%';

-- Catch-all for remaining: use first sentence of description trimmed
-- (these will show as Empty in the review page if not matched above)

-- Anything still null: set a generic draft based on title keywords
UPDATE topic_library SET short_description = 'Join our friendly coaching group for expert tips and drills to improve this area of your game.', short_description_status = 'draft' WHERE short_description IS NULL AND active = true;
