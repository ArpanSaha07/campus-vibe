package com.campusvibe.user.profile;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * The interest vocabulary, for the picker.
 *
 * <p>Read-only by design. The rows come from V20 so that every environment holds
 * the same vocabulary; revising the list is a migration, not an admin screen.
 */
@Service
public class InterestCatalogueService {

	private final InterestCatalogueRepository repository;

	public InterestCatalogueService(InterestCatalogueRepository repository) {
		this.repository = repository;
	}

	@Transactional(readOnly = true)
	public List<InterestDTO> listInterests() {
		return repository.findAllByOrderBySortOrderAsc().stream()
				.map(entry -> new InterestDTO(
						entry.getSlug(), entry.getLabel(), entry.getCategory()))
				.toList();
	}
}
