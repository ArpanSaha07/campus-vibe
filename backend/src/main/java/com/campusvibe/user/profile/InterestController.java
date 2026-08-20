package com.campusvibe.user.profile;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The interest vocabulary.
 *
 * <p>Public, and needs its own permitAll entry in
 * {@code SecurityFilterChainConfig} — it is not under {@code /api/v1/clubs} or
 * {@code /api/v1/events}, so without one it would fall through to
 * {@code .anyRequest().authenticated()}.
 *
 * <p>Public because it is a vocabulary, not anybody's data: it names no user and
 * is identical for everyone. A future public profile page has to render the
 * labels behind someone's interests without a token to do it with.
 */
@RestController
@RequestMapping("/api/v1/interests")
public class InterestController {

	private final InterestCatalogueService interestCatalogueService;

	public InterestController(InterestCatalogueService interestCatalogueService) {
		this.interestCatalogueService = interestCatalogueService;
	}

	@GetMapping
	public List<InterestDTO> listInterests() {
		return interestCatalogueService.listInterests();
	}
}
