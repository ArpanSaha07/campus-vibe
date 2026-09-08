package com.campusvibe.taxonomy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** The event-format vocabulary. Read-only: the rows come from V29. */
public interface EventFormatRepository extends JpaRepository<EventFormat, String> {

	List<EventFormat> findAllByOrderBySortOrderAsc();
}
