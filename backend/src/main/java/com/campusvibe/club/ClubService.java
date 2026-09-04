package com.campusvibe.club;

import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.search.SearchIndexService;
import com.campusvibe.taxonomy.TaxonomyService;
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

    public ClubService(ClubRepository clubRepository, ClubMapper clubMapper,
                       SearchIndexService searchIndexService,
                       TaxonomyService taxonomyService) {
        this.clubRepository = clubRepository;
        this.clubMapper = clubMapper;
        this.searchIndexService = searchIndexService;
        this.taxonomyService = taxonomyService;
    }

    @Transactional(readOnly = true)
    public List<ClubDTO> list() {
        return clubRepository.findAll().stream().map(clubMapper).toList();
    }

    @Transactional(readOnly = true)
    public ClubDTO get(String id) {
        return clubMapper.apply(findClub(id));
    }

    @Transactional
    public ClubDTO create(Club club, String category, List<String> interests) {
        if (clubRepository.existsById(club.getId())) {
            throw new DuplicateResourceException("Club with id [%s] already exists".formatted(club.getId()));
        }
        // saveAndFlush, not save. Club.id is assigned rather than generated, so
        // Hibernate has no reason to issue the INSERT before the transaction
        // commits. indexClub writes the embedding through a raw JDBC UPDATE,
        // which is not a JPA query and so does not trigger a flush either — it
        // would match zero rows and report nothing, leaving every club created
        // here invisible to semantic search. Events avoid this by accident:
        // their IDENTITY id forces the INSERT immediately.
        Club saved = clubRepository.saveAndFlush(club);
        // Validated before the insert, so a bad slug refuses the whole creation
        // rather than leaving a club that exists but is misclassified.
        club.setCategorySlug(taxonomyService.requireKnownClubCategory(category));
        club.getInterestSlugs().addAll(
                taxonomyService.requireKnownInterests(interests, MAX_CLUB_INTERESTS, "interest"));
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
            club.setSocialLinks(request.socialLinks());
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
