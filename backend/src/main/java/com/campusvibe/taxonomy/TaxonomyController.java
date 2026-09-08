package com.campusvibe.taxonomy;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The three vocabularies, read-only and public.
 *
 * <p>Public because none of them is anybody's data: they name no user, they are
 * identical for every caller, and a public club or event page has to render the
 * labels behind a slug with no token to do it with.
 *
 * <p>All three need their own {@code permitAll} entries in
 * {@code SecurityFilterChainConfig} — they sit under neither
 * {@code /api/v1/clubs} nor {@code /api/v1/events}, so without them they fall
 * through to {@code .anyRequest().authenticated()}.
 *
 * <p>No class-level path prefix: these are three sibling vocabularies rather
 * than one resource with sub-paths, and nesting them under a shared
 * {@code /taxonomy} would name an implementation detail nobody outside this
 * package cares about.
 */
@RestController
public class TaxonomyController {

	private final TaxonomyService taxonomyService;

	public TaxonomyController(TaxonomyService taxonomyService) {
		this.taxonomyService = taxonomyService;
	}

	@GetMapping("/api/v1/interests")
	public List<InterestDTO> interests() {
		return taxonomyService.listInterests();
	}

	@GetMapping("/api/v1/club-categories")
	public List<ClubCategoryDTO> clubCategories() {
		return taxonomyService.listClubCategories();
	}

	@GetMapping("/api/v1/event-formats")
	public List<EventFormatDTO> eventFormats() {
		return taxonomyService.listEventFormats();
	}
}
