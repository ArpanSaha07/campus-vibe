-- V6__insert_mock_clubs.sql
-- Insert mock club data for testing

INSERT INTO clubs (id, name, description, followers, logo, socialLinks, featured, created_at)
VALUES 
('coding-club', 'Coding Club', 'A community of passionate programmers learning and building together', 120, NULL, '{"email":"coding@campus.com","website":"coding.campus.edu","instagram":"@campuscodingclub"}', true, NOW()),
('photography-society', 'Photography Society', 'Capture the world through our lenses. Join us for workshops and photo walks', 85, NULL, '{"email":"photo@campus.com","instagram":"@campusphoto"}', true, NOW()),
('drama-troupe', 'Drama Troupe', 'Perform, create, and express yourself on stage', 60, NULL, '{"email":"drama@campus.com","website":"drama.campus.edu"}', false, NOW()),
('debate-club', 'Debate Club', 'Sharpen your argumentative skills and compete in tournaments', 95, NULL, '{"email":"debate@campus.com","instagram":"@debatetribe"}', true, NOW()),
('music-ensemble', 'Music Ensemble', 'Play, compose, and jam with fellow musicians', 150, NULL, '{"email":"music@campus.com","instagram":"@campusmusic"}', false, NOW()),
('science-club', 'Science Club', 'Explore the wonders of science through experiments and discussions', 110, NULL, '{"email":"science@campus.com"}', false, NOW()),
('entrepreneur-hub', 'Entrepreneur Hub', 'Build startups, share ideas, and network with innovators', 75, NULL, '{"email":"startup@campus.com","website":"startup.campus.edu"}', true, NOW()),
('chess-club', 'Chess Club', 'Master the game of kings. All skill levels welcome', 45, NULL, '{"email":"chess@campus.com"}', false, NOW());

-- Insert mock club images
INSERT INTO club_images (club_id, url)
VALUES 
('coding-club', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400'),
('coding-club', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80'),
('photography-society', 'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?w=400'),
('drama-troupe', 'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=400'),
('debate-club', 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400'),
('music-ensemble', 'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=400'),
('science-club', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'),
('entrepreneur-hub', 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400');
