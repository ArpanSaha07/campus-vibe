package com.campusvibe.taxonomy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * The interest vocabulary. Read-only in practice: the rows come from V20 and
 * nothing in the application writes them.
 */
public interface InterestCatalogueRepository extends JpaRepository<InterestCatalogueEntry, String> {

	/**
	 * The whole catalogue in the order the picker should show it — category
	 * groups in order, entries in order within each. V20 spaces sort_order by
	 * ten so an entry can be slotted between two others without renumbering.
	 */
	List<InterestCatalogueEntry> findAllByOrderBySortOrderAsc();
}
