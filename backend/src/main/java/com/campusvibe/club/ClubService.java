package com.campusvibe.club;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ClubService {
    private final ClubRepository clubRepository;

    public ClubService(ClubRepository clubRepository) {
        this.clubRepository = clubRepository;
    }

    public List<Club> list() { return clubRepository.findAll(); }
    public Club get(String id) { return clubRepository.findById(id).orElseThrow(); }
    public Club create(Club club) { return clubRepository.save(club); }
}
