package com.campusvibe.club;

import org.springframework.stereotype.Component;

import java.util.List;
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
                club.getSocialLinks(),
                club.getFeatured(),
                // copy so the lazy collection is initialized while the session is open
                List.copyOf(club.getImages()),
                club.getCreatedAt(),
                club.getCategorySlug(),
                // Sorted, so two reads of one row cannot disagree about the
                // order -- Hibernate hands this back as a HashSet.
                club.getInterestSlugs().stream().sorted().toList()
        );
    }
}
