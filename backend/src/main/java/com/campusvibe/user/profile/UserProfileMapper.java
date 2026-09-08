package com.campusvibe.user.profile;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Function;

/**
 * Entity to wire shape, in the same {@code Function<Entity, DTO>} form as
 * {@code UserDTOMapper} and {@code ClubMapper}.
 *
 * <p>Both collections are sorted before they go out. Hibernate hands back a
 * {@code HashSet} whose iteration order is unspecified and can differ between
 * two reads of the same row; the editor compares its draft against what it
 * loaded to decide whether Save should light up, and while that comparison
 * treats arrays as sets, anything else reading this endpoint would see a list
 * that reorders itself for no reason.
 *
 * <p>Called inside the service transaction — both collections are LAZY and
 * {@code spring.jpa.open-in-view} is false, so touching them anywhere later
 * would fail.
 */
@Component
public class UserProfileMapper implements Function<UserProfile, UserProfileDTO> {

	@Override
	public UserProfileDTO apply(UserProfile profile) {
		return new UserProfileDTO(
				profile.getBio(),
				profile.getFaculty(),
				profile.getDegree(),
				profile.getSubjects().stream().sorted().toList(),
				new ProfileSocialLinksDTO(
						profile.getInstagramUrl(),
						profile.getFacebookUrl(),
						profile.getLinkedinUrl()),
				profile.getInterestSlugs().stream().sorted().toList(),
				profile.isShowInterests(),
				profile.isShowSocialLinks());
	}

	/**
	 * What a profile looks like before anyone has written one.
	 *
	 * <p>A complete object rather than a 404 or a null body: an account with no
	 * profile row is the ordinary state of every account that predates this
	 * table, not an error, and the editor needs every field present to bind its
	 * inputs to. Matches {@code emptyProfile()} in {@code app/lib/profile.ts},
	 * both visibility flags included.
	 */
	public UserProfileDTO empty() {
		return new UserProfileDTO(
				null,
				null,
				null,
				List.of(),
				new ProfileSocialLinksDTO(null, null, null),
				List.of(),
				true,
				true);
	}
}
