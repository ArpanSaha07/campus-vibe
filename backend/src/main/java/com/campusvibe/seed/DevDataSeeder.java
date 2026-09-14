package com.campusvibe.seed;

import com.campusvibe.user.AuthProvider;
import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.club.ClubService;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.RoleRepository;
import com.campusvibe.user.User;
import com.campusvibe.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
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
 * Creating them through {@link ClubService#createOwnedBy} populates the
 * embedding for free, which is why this is a programmatic seeder rather than a
 * dev-only SQL file.
 *
 * <p><strong>Six of the eight are owned by a demo account; two are left
 * ownerless on purpose.</strong> Since ADR-004 every club created through the
 * product is born with an owner, so without this the club-admin claim queue and
 * the Approve/Reject controls on {@code /admin} would have nothing to act on
 * locally — {@code ClubAdminRequestService.create} refuses a club that already
 * has an owner. The two unowned clubs are what keeps that flow exercisable.
 *
 * <p>Two independent guards keep this out of production: {@code @Profile("dev")}
 * (production runs {@code prod}) and {@code campusvibe.seed.enabled}. It is
 * idempotent per club rather than wholesale: it creates the demo clubs that are
 * missing and leaves everything else alone, so it never fights data you created
 * by hand and never needs the database to be empty to be useful.
 *
 * <p>It used to skip entirely when <em>any</em> club existed, which meant it had
 * never actually run — {@code V6} inserted eight clubs before it, so the guard
 * always tripped. {@code V32} retires those rows; this guard is what stops the
 * two from fighting on a database where a developer kept one of them.
 */
@Component
@Profile("dev")
@ConditionalOnProperty(name = "campusvibe.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DevDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

    /** The demo account the owned clubs belong to. Dev only, and never a real address. */
    private static final String DEMO_OWNER_EMAIL = "demo.owner@campusvibe.local";

    /** Left without an owner so the club-admin claim queue has something to claim. */
    private static final List<String> OWNERLESS = List.of("science-club", "chess-club");

    private final ClubService clubService;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public DevDataSeeder(ClubService clubService, ClubRepository clubRepository,
                         UserRepository userRepository, RoleRepository roleRepository,
                         PasswordEncoder passwordEncoder) {
        this.clubService = clubService;
        this.clubRepository = clubRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<Club> missing = demoClubs().stream()
                .filter(club -> !clubRepository.existsById(club.getId()))
                .toList();
        if (missing.isEmpty()) {
            log.info("Dev seed: all {} demo club(s) already present; nothing to do",
                    demoClubs().size());
            return;
        }

        User demoOwner = demoOwner();

        // Seeded uncategorised, exactly as V6 inserted them: the taxonomy is
        // optional on create, and TaxonomyService reads a null category and an
        // empty interest list as legitimately absent rather than invalid.
        long owned = 0;
        for (Club club : missing) {
            // createdBy is null: nobody created these through the product, and
            // an audit entry naming the demo owner as the creator of a club the
            // seeder made would be a small lie in the club's activity log.
            User owner = OWNERLESS.contains(club.getId()) ? null : demoOwner;
            clubService.createOwnedBy(club, null, List.of(), owner, null);
            if (owner != null) {
                owned++;
            }
        }
        log.info("Dev seed: created {} demo club(s), {} owned by [{}], {} left ownerless "
                        + "so the club-admin claim queue has something to act on",
                missing.size(), owned, DEMO_OWNER_EMAIL, missing.size() - owned);
    }

    /**
     * The account that owns the seeded clubs.
     *
     * <p>Reused if it already exists, so re-seeding after a partial wipe does
     * not fail on the unique address. The password is fixed and public in the
     * source, which is only acceptable because this bean cannot exist outside
     * the {@code dev} profile — see the two guards on the class.
     */
    private User demoOwner() {
        return userRepository.findByEmail(DEMO_OWNER_EMAIL).orElseGet(() -> {
            User user = new User();
            user.setName("Demo Club Owner");
            user.setEmail(DEMO_OWNER_EMAIL);
            user.setPassword(passwordEncoder.encode("demo-owner-password"));
            user.setAuthProvider(AuthProvider.LOCAL);
            user.setEmailVerified(true);
            user.addRole(roleRepository.findByName(RoleName.ROLE_USER.name())
                    .orElseThrow(() -> new IllegalStateException(
                            "ROLE_USER is missing; V7 should have created it")));
            log.info("Dev seed: created demo owner [{}]", DEMO_OWNER_EMAIL);
            return userRepository.save(user);
        });
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
