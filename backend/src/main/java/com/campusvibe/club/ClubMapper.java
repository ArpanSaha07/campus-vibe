package com.campusvibe.club;

import org.springframework.stereotype.Component;

import java.util.function.Function;

@Component
public class ClubMapper implements Function<Club, ClubDTO> {
    @Override
    public ClubDTO apply(Club club) {
        return new ClubDTO(
                club.getId(),
                club.getName(),
                club.getDescription(),
                club.getFollowers(),
                club.getLogo(),
                club.getFeatured(),
                club.getImages(),
                club.getCreatedAt()
        );
    }
}
