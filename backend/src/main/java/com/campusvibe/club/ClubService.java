package com.campusvibe.club;

import com.campusvibe.clubadmin.AuditEntityType;
import com.campusvibe.clubadmin.ClubAdminService;
import com.campusvibe.clubadmin.ClubAuditAction;
import com.campusvibe.clubadmin.ClubAuditService;
import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.search.SearchIndexService;
import com.campusvibe.taxonomy.TaxonomyService;
import com.campusvibe.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
public class ClubService {

    /**
     * Eight, and the cap is load-bearing.
     *
     * <p>A club that tags itself with thirty interests matches every student,
     * which helps that club not at all and quietly degrades recommendations for
     * everybody else. This is the tag-spam failure that ruins the pattern
     * wherever it is left uncapped.
     */
    private static final int MAX_CLUB_INTERESTS = 8;

    private final ClubRepository clubRepository;
    private final ClubMapper clubMapper;
    private final SearchIndexService searchIndexService;
    private final TaxonomyService taxonomyService;
    private final ClubAdminService clubAdminService;
    private final ClubAuditService clubAuditService;

    public ClubService(ClubRepository clubRepository, ClubMapper clubMapper,
                       SearchIndexService searchIndexService,
                       TaxonomyService taxonomyService,
                       ClubAdminService clubAdminService,
                       ClubAuditService clubAuditService) {
        this.clubRepository = clubRepository;
        this.clubMapper = clubMapper;
        this.searchIndexService = searchIndexService;
        this.taxonomyService = taxonomyService;
        this.clubAdminService = clubAdminService;
        this.clubAuditService = clubAuditService;
    }

    @Transactional(readOnly = true)
    public List<ClubDTO> list() {
        return clubRepository.findAll().stream().map(clubMapper).toList();
    }

    @Transactional(readOnly = true)
    public ClubDTO get(String id) {
        return clubMapper.apply(findClub(id));
    }

    /**
     * Creates a club and installs its first owner, in one transaction.
     *
     * <p>The only way to create a club. There is deliberately no ownerless
     * create: ADR-004 settles that a club is never born without somebody
     * responsible for it, because until now {@code canManageClub} answered 403
     * to the person who had just made the club, and the logo, banner images and
     * social links the create form collects were unsendable as a result.
     *
     * <p>Both creation paths land here. A platform admin creating directly
     * passes themselves; approving a club proposal passes the requester.
     *
     * @param owner the club's first {@code CLUB_OWNER}, or {@code null} to
     *              create the club ownerless. Null exists for one caller --
     *              {@code DevDataSeeder}, which leaves two demo clubs unowned so
     *              the club-admin claim queue has something to act on locally.
     *              Nothing reachable from an HTTP request may pass null.
     * @param createdBy who created the club -- the admin who posted the form,
     *                   or the admin who approved the proposal. Not necessarily
     *                   the owner: approving a proposal creates the club as the
     *                   reviewer and hands it to the requester. Null only for
     *                   the seeder.
     */
    @Transactional
    public ClubDTO createOwnedBy(Club club, String category, List<String> interests,
                                 User owner, User createdBy) {
        if (clubRepository.existsById(club.getId())) {
            throw new DuplicateResourceException("Club with id [%s] already exists".formatted(club.getId()));
        }
        // Validated and applied before the insert, so a bad slug refuses the whole
        // creation rather than leaving a club that exists but is misclassified.
        // Before, not after, for a second reason: Club.id is assigned rather than
        // generated, so Spring Data sees a non-new entity and saveAndFlush goes
        // through em.merge -- which returns a *different* managed instance. Tagging
        // `club` afterwards would write to the detached copy and persist nothing.
        club.setCategorySlug(taxonomyService.requireKnownClubCategory(category));
        club.getInterestSlugs().addAll(
                taxonomyService.requireKnownInterests(interests, MAX_CLUB_INTERESTS, "interest"));
        // saveAndFlush, not save. Club.id is assigned rather than generated, so
        // Hibernate has no reason to issue the INSERT before the transaction
        // commits. indexClub writes the embedding through a raw JDBC UPDATE,
        // which is not a JPA query and so does not trigger a flush either -- it
        // would match zero rows and report nothing, leaving every club created
        // here invisible to semantic search. Events avoid this by accident:
        // their IDENTITY id forces the INSERT immediately.
        Club saved = clubRepository.saveAndFlush(club);

        // `saved`, never `club`: see above. Handing the detached copy to
        // assignFirstOwner would write an assignment pointing at an instance
        // Hibernate is not managing.
        if (owner != null) {
            clubAdminService.assignFirstOwner(saved, owner, createdBy == null ? null : createdBy.getId());
        }

        // Recorded here rather than at the two call sites, so a club created
        // directly and a club created by approving a proposal produce the same
        // first entry in the club's activity log.
        // The official email rides on this entry rather than getting a
        // CLUB_OFFICIAL_EMAIL_SET of its own. It is a governance fact -- §6
        // expects the log to answer who pointed a club's recovery channel where
        // it points -- but at creation it was nobody's separate act, and a
        // second entry a millisecond after the first would read as one.
        // metadata() drops a null, so a club created without an address simply
        // has no such key.
        clubAuditService.record(saved.getId(), createdBy, ClubAuditAction.CLUB_CREATED,
                AuditEntityType.CLUB, saved.getId(),
                ClubAuditService.metadata(
                        "ownerEmail", owner == null ? null : owner.getEmail(),
                        "officialEmail", saved.getOfficialEmail()));

        searchIndexService.indexClub(saved);
        return clubMapper.apply(saved);
    }

    @Transactional
    public ClubDTO update(String id, ClubUpdateRequest request) {
        Club club = findClub(id);
        if (request.name() != null && !request.name().isBlank()) {
            club.setName(request.name());
        }
        if (request.description() != null) {
            club.setDescription(request.description());
        }
        if (request.socialLinks() != null) {
            // Normalised, not stored as sent. These three links reach an href on
            // the public club page, and until this call existed nothing checked
            // their scheme on either side -- so a stored `javascript:` link was
            // a script on the club's page (BUG-048). An empty object clears the
            // column, which is how the editor removes the last link.
            club.setSocialLinks(ClubSocialLinks.normalise(request.socialLinks()));
        }
        if (request.category() != null) {
            club.setCategorySlug(taxonomyService.requireKnownClubCategory(request.category()));
        }
        if (request.interests() != null) {
            // Replace rather than merge: the form sends the whole set, so an
            // absent slug means removed. Cleared and refilled rather than
            // reassigned -- swapping the PersistentSet out makes Hibernate
            // delete and reinsert every row.
            Set<String> next = taxonomyService.requireKnownInterests(
                    request.interests(), MAX_CLUB_INTERESTS, "interest");
            club.getInterestSlugs().clear();
            club.getInterestSlugs().addAll(next);
        }
        // Re-indexed after the tags change, not before: the embedded text
        // includes them, so indexing first would describe the club as it was.
        searchIndexService.indexClub(club);
        return clubMapper.apply(club);
    }

    @Transactional
    public void updateLogo(String id, String logoKey) {
        Club club = findClub(id);
        club.setLogo(logoKey);
        clubRepository.save(club);
    }

    @Transactional
    public void addImages(String id, List<String> keys) {
        Club club = findClub(id);
        club.getImages().addAll(keys);
        clubRepository.save(club);
    }

    private Club findClub(String id) {
        return clubRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Club with id [%s] not found".formatted(id)));
    }
}
