package com.campusvibe.club;

import com.campusvibe.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClubService {
    private final ClubRepository clubRepository;
    private final ClubMapper clubMapper;

    public ClubService(ClubRepository clubRepository, ClubMapper clubMapper) {
        this.clubRepository = clubRepository;
        this.clubMapper = clubMapper;
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
    public ClubDTO create(Club club) {
        return clubMapper.apply(clubRepository.save(club));
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
