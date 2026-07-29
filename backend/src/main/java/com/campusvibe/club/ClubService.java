package com.campusvibe.club;

import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.search.SearchIndexService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClubService {
    private final ClubRepository clubRepository;
    private final ClubMapper clubMapper;
    private final SearchIndexService searchIndexService;

    public ClubService(ClubRepository clubRepository, ClubMapper clubMapper,
                       SearchIndexService searchIndexService) {
        this.clubRepository = clubRepository;
        this.clubMapper = clubMapper;
        this.searchIndexService = searchIndexService;
    }

    @Transactional(readOnly = true)
    public List<ClubDTO> list() {
        return clubRepository.findAll().stream().map(clubMapper).toList();
    }

    @Transactional(readOnly = true)
    public ClubDTO get(String id) {
        return clubMapper.apply(findClub(id));
    }

    @Transactional(readOnly = true)
    public ClubDTO getManagedClub(Long userId) {
        return clubRepository.findByClubAdminId(userId)
                .map(clubMapper)
                .orElseThrow(() -> new ResourceNotFoundException("No club is assigned to this user"));
    }

    @Transactional
    public ClubDTO create(Club club) {
        if (clubRepository.existsById(club.getId())) {
            throw new DuplicateResourceException("Club with id [%s] already exists".formatted(club.getId()));
        }
        Club saved = clubRepository.save(club);
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
        searchIndexService.indexClub(club);
        return clubMapper.apply(club);
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
