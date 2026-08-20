package com.campusvibe.user.profile;

import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.taxonomy.TaxonomyService;
import com.campusvibe.user.User;
import com.campusvibe.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Reads and replaces the signed-in user's profile.
 *
 * <p>Every method takes the email off the {@code Authentication} rather than an
 * id off the path, which is what makes it impossible for one user to read or
 * write another's row — the same arrangement as {@code MyEventService} and
 * {@code MyClubService}.
 *
 * <p><strong>Absence is a supported state, not an error.</strong> Every account
 * that exists today predates this table, so a read with no row answers with an
 * empty profile rather than a 404, and a write creates the row on the way past.
 * Creating one at sign-up instead would still leave every existing account
 * without one, and would give a profile two ways to come into being.
 */
@Service
public class UserProfileService {

	/** Matches MAX_SUBJECTS in app/components/profile/edit/SubjectPicker.tsx. */
	private static final int MAX_SUBJECTS = 12;

	/**
	 * No cap on a person's own interests, unlike a club's eight.
	 *
	 * <p>A club tagged with everything matches every student and degrades
	 * recommendations for all of them. A student interested in everything only
	 * gets a busier feed, which is their business.
	 */
	private static final int MAX_INTERESTS = 76;

	private final UserProfileRepository profileRepository;
	private final UserRepository userRepository;
	private final TaxonomyService taxonomyService;
	private final UserProfileMapper mapper;

	public UserProfileService(UserProfileRepository profileRepository,
	                          UserRepository userRepository,
	                          TaxonomyService taxonomyService,
	                          UserProfileMapper mapper) {
		this.profileRepository = profileRepository;
		this.userRepository = userRepository;
		this.taxonomyService = taxonomyService;
		this.mapper = mapper;
	}

	@Transactional(readOnly = true)
	public UserProfileDTO getMyProfile(String email) {
		return profileRepository.findById(requireUser(email).getId())
				.map(mapper)
				.orElseGet(mapper::empty);
	}

	/**
	 * Replaces the whole profile. See {@link UserProfileUpdateRequest} for why
	 * this is a replace and not a patch.
	 */
	@Transactional
	public UserProfileDTO replaceMyProfile(String email, UserProfileUpdateRequest request) {
		Long userId = requireUser(email).getId();
		UserProfile profile = profileRepository.findById(userId)
				.orElseGet(() -> new UserProfile(userId));

		profile.setBio(blankToNull(request.bio()));
		profile.setFaculty(blankToNull(request.faculty()));
		profile.setDegree(blankToNull(request.degree()));

		ProfileSocialLinksRequest links = request.socialLinks();
		profile.setInstagramUrl(links == null
				? null : ProfileLinks.normalise(links.instagram(), "Instagram"));
		profile.setFacebookUrl(links == null
				? null : ProfileLinks.normalise(links.facebook(), "Facebook"));
		profile.setLinkedinUrl(links == null
				? null : ProfileLinks.normalise(links.linkedin(), "LinkedIn"));

		profile.setShowInterests(request.showInterests());
		profile.setShowSocialLinks(request.showSocialLinks());

		profile.replaceSubjects(cleanSubjects(request.subjects()));
		profile.replaceInterestSlugs(
				taxonomyService.requireKnownInterests(
						request.interests(), MAX_INTERESTS, "interest"));

		// Explicit save because the profile may be new; for an existing one this
		// is the same dirty-checked flush it would have got anyway.
		return mapper.apply(profileRepository.save(profile));
	}

	/**
	 * Deduplicated case-insensitively, in the order given, and capped.
	 *
	 * <p>The picker already dedupes and caps, so this is not defending against
	 * the editor — it is defending against everything that is not the editor.
	 */
	private Set<String> cleanSubjects(List<String> submitted) {
		if (submitted == null) {
			return Set.of();
		}
		Set<String> seen = new LinkedHashSet<>();
		Set<String> lowered = new LinkedHashSet<>();
		for (String raw : submitted) {
			if (raw == null) {
				continue;
			}
			String subject = raw.trim();
			if (subject.isEmpty()) {
				continue;
			}
			if (lowered.add(subject.toLowerCase(java.util.Locale.ROOT))) {
				seen.add(subject);
			}
		}
		if (seen.size() > MAX_SUBJECTS) {
			throw new RequestValidationException(
					"A profile can list at most %d subjects".formatted(MAX_SUBJECTS));
		}
		return seen;
	}

	private static String blankToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	private User requireUser(String email) {
		return userRepository.findByEmail(email)
				.orElseThrow(() -> new ResourceNotFoundException(
						"User with email [%s] not found".formatted(email)));
	}
}
