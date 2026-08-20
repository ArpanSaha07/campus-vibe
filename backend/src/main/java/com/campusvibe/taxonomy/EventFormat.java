package com.campusvibe.taxonomy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One of the twenty-two shapes an event can take, seeded by V29.
 *
 * <p>Events-only, and that is the whole reason this vocabulary exists apart
 * from the interest catalogue: {@code Workshop} and {@code Panel} describe a
 * gathering and mean nothing as a student interest. What an event is
 * <em>about</em> comes from the interest catalogue instead, shared with
 * students and clubs, which is what makes matching a person to an event a
 * direct join rather than a mapping.
 *
 * <p>{@code groupLabel} is plain text, unlike the interest catalogue's parent
 * self-reference, because nothing is ever tagged with a format group — an event
 * is a Workshop, never a Learning — so there is no key for a foreign key to
 * protect.
 */
@Entity
@Table(name = "event_formats")
@Getter
@Setter
@NoArgsConstructor
public class EventFormat {

	@Id
	@Column(name = "slug")
	private String slug;

	@Column(name = "label", nullable = false)
	private String label;

	@Column(name = "group_label", nullable = false)
	private String groupLabel;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;
}
