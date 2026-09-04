package com.campusvibe.taxonomy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One of the thirteen kinds of organisation a club can be, seeded by V24.
 *
 * <p>A vocabulary of its own rather than a slice of the interest catalogue:
 * that list is written at the grain of {@code Chess} and {@code Web
 * development}, which are reasonable things for a person to like and strange
 * things to call an organisation. What a club is <em>about</em> is the separate
 * axis held by {@code club_interests}.
 *
 * <p>Reference data — the application reads it and never writes it. Revising
 * the list is a migration, so that every environment holds the same one.
 */
@Entity
@Table(name = "club_categories")
@Getter
@Setter
@NoArgsConstructor
public class ClubCategory {

	@Id
	@Column(name = "slug")
	private String slug;

	@Column(name = "label", nullable = false)
	private String label;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;
}
