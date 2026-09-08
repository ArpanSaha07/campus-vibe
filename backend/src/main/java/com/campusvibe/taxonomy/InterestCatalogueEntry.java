package com.campusvibe.taxonomy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One entry in the fixed interest vocabulary, seeded by V20.
 *
 * <p>Reference data: the application reads it and never writes it. There is no
 * repository save anywhere, and there should not be — revising the list is a
 * migration, so that every environment holds the same vocabulary.
 *
 * <p>Keyed on the slug rather than the label so that renaming what people read
 * does not move anybody's selections. See V19.
 */
@Entity
@Table(name = "interest_catalogue")
@Getter
@Setter
@NoArgsConstructor
public class InterestCatalogueEntry {

	@Id
	@Column(name = "slug")
	private String slug;

	@Column(name = "label", nullable = false)
	private String label;

	/**
	 * The group this sits under, or null when this row <em>is</em> a group.
	 *
	 * <p>V26 replaced the free-text {@code category} column with this
	 * self-reference, because an event can be tagged with a group and
	 * nothing can foreign-key to a string. Exactly two levels are intended
	 * -- a group has no parent, an interest has one -- which Postgres
	 * cannot express as a CHECK without a subquery, so nothing but
	 * convention enforces it. A third level would break the parent rollup
	 * that recommendation scoring depends on.
	 */
	@Column(name = "parent_slug")
	private String parentSlug;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;
}
