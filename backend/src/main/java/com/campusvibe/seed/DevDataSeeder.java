package com.campusvibe.seed;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.club.ClubService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Recreates the demo clubs for local development.
 *
 * <p>These eight clubs used to be inserted by {@code V6__insert_mock_clubs.sql}.
 * Two things were wrong with that:
 *
 * <ol>
 *   <li>Flyway runs everywhere, so production would have shipped with fake
 *       clubs and stock photography.</li>
 *   <li>A raw {@code INSERT} bypasses the service layer, and
 *       {@code clubs.embedding} is written by {@code SearchIndexService} as a
 *       side effect of the normal create path. All eight seeded clubs had
 *       {@code embedding IS NULL} and were invisible to the semantic half of
 *       hybrid search — the bug this class fixes as much as the production
 *       leak.</li>
 * </ol>
 *
 * Creating them through {@link ClubService#create} populates the embedding for
 * free, which is why this is a programmatic seeder rather than a dev-only SQL
 * file.
 *
 * <p>Two independent guards keep this out of production: {@code @Profile("dev")}
 * (production runs {@code prod}) and {@code campusvibe.seed.enabled}. It is also
 * idempotent — it skips entirely when any club already exists, so it never
 * fights data you created by hand.
 */
@Component
@Profile("dev")
@ConditionalOnProperty(name = "campusvibe.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DevDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

    private final ClubService clubService;
    private final ClubRepository clubRepository;

    public DevDataSeeder(ClubService clubService, ClubRepository clubRepository) {
        this.clubService = clubService;
        this.clubRepository = clubRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        long existing = clubRepository.count();
        if (existing > 0) {
            log.info("Dev seed: {} club(s) already present; skipping", existing);
            return;
        }

        demoClubs().forEach(clubService::create);
        log.info("Dev seed: created {} demo clubs", demoClubs().size());
    }

    /**
     * The same eight clubs V6 inserted, so a database that has run the V12
     * cleanup converges on identical content — only now with embeddings.
     */
    private static List<Club> demoClubs() {
        return List.of(
                club("coding-club", "Coding Club",
                        "A community of passionate programmers learning and building together",
                        120, true,
                        "{\"email\":\"coding@campus.com\",\"website\":\"coding.campus.edu\",\"instagram\":\"@campuscodingclub\"}",
                        List.of("https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400",
                                "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80")),
                club("photography-society", "Photography Society",
                        "Capture the world through our lenses. Join us for workshops and photo walks",
                        85, true,
                        "{\"email\":\"photo@campus.com\",\"instagram\":\"@campusphoto\"}",
                        List.of("https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?w=400")),
                club("drama-troupe", "Drama Troupe",
                        "Perform, create, and express yourself on stage",
                        60, false,
                        "{\"email\":\"drama@campus.com\",\"website\":\"drama.campus.edu\"}",
                        List.of("https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=400")),
                club("debate-club", "Debate Club",
                        "Sharpen your argumentative skills and compete in tournaments",
                        95, true,
                        "{\"email\":\"debate@campus.com\",\"instagram\":\"@debatetribe\"}",
                        List.of("https://images.unsplash.com/photo-1552664730-d307ca884978?w=400")),
                club("music-ensemble", "Music Ensemble",
                        "Play, compose, and jam with fellow musicians",
                        150, false,
                        "{\"email\":\"music@campus.com\",\"instagram\":\"@campusmusic\"}",
                        List.of("https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=400")),
                club("science-club", "Science Club",
                        "Explore the wonders of science through experiments and discussions",
                        110, false,
                        "{\"email\":\"science@campus.com\"}",
                        List.of("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400")),
                club("entrepreneur-hub", "Entrepreneur Hub",
                        "Build startups, share ideas, and network with innovators",
                        75, true,
                        "{\"email\":\"startup@campus.com\",\"website\":\"startup.campus.edu\"}",
                        List.of("https://images.unsplash.com/photo-1552664730-d307ca884978?w=400")),
                club("chess-club", "Chess Club",
                        "Master the game of kings. All skill levels welcome",
                        45, false,
                        "{\"email\":\"chess@campus.com\"}",
                        List.of()));
    }

    private static Club club(String id, String name, String description, int followers,
                             boolean featured, String socialLinks, List<String> images) {
        Club club = new Club();
        club.setId(id);
        club.setName(name);
        club.setDescription(description);
        club.setFollowers(followers);
        club.setFeatured(featured);
        club.setSocialLinks(socialLinks);
        club.getImages().addAll(images);
        return club;
    }
}
