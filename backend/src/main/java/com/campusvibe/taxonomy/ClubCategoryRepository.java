package com.campusvibe.taxonomy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** The club-category vocabulary. Read-only: the rows come from V24. */
public interface ClubCategoryRepository extends JpaRepository<ClubCategory, String> {

	List<ClubCategory> findAllByOrderBySortOrderAsc();
}
