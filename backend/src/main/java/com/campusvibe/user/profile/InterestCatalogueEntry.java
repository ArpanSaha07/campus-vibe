package com.campusvibe.user.profile;

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

	@Column(name = "category", nullable = false)
	private String category;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;
}
