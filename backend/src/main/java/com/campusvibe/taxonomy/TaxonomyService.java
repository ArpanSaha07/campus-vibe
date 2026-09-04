package com.campusvibe.taxonomy;

import com.campusvibe.exception.RequestValidationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The three vocabularies, and the one place that decides whether a slug is real.
 *
 * <p>Every write path that accepts a slug — a club's category, a club's tags, an
 * event's topics and formats — comes through here rather than relying on the
 * foreign key to refuse. The key is still what makes the guarantee true; this
 * only decides what the caller is told, and a 400 naming the slug is a better
 * answer than a constraint violation surfacing as a 500.
 *
 * <p>Read-only over all three tables. Their rows come from V20, V24 and V29, so
 * revising a vocabulary is a migration and every environment holds the same one.
 */
@Service
public class TaxonomyService {

	private final InterestCatalogueRepository interestRepository;
	private final ClubCategoryRepository clubCategoryRepository;
	private final EventFormatRepository eventFormatRepository;

	public TaxonomyService(InterestCatalogueRepository interestRepository,
	                       ClubCategoryRepository clubCategoryRepository,
	                       EventFormatRepository eventFormatRepository) {
		this.interestRepository = interestRepository;
		this.clubCategoryRepository = clubCategoryRepository;
		this.eventFormatRepository = eventFormatRepository;
	}

	// ---------------------------------------------------------------- reads

	/**
	 * The interest vocabulary, both levels, in picker order.
	 *
	 * <p>The twelve groups come through with a null {@code parentSlug}. They are
	 * included rather than filtered out because an event may be tagged with a
	 * group — a screening is about {@code film}, a jam night simply about
	 * {@code music} — and because a client needs them to render headings.
	 * Callers that only want pickable interests filter on {@code parentSlug}.
	 */
	@Transactional(readOnly = true)
	public List<InterestDTO> listInterests() {
		return interestRepository.findAllByOrderBySortOrderAsc().stream()
				.map(entry -> new InterestDTO(
						entry.getSlug(), entry.getLabel(), entry.getParentSlug()))
				.toList();
	}

	@Transactional(readOnly = true)
	public List<ClubCategoryDTO> listClubCategories() {
		return clubCategoryRepository.findAllByOrderBySortOrderAsc().stream()
				.map(category -> new ClubCategoryDTO(category.getSlug(), category.getLabel()))
				.toList();
	}

	@Transactional(readOnly = true)
	public List<EventFormatDTO> listEventFormats() {
		return eventFormatRepository.findAllByOrderBySortOrderAsc().stream()
				.map(format -> new EventFormatDTO(
						format.getSlug(), format.getLabel(), format.getGroupLabel()))
				.toList();
	}

	/**
	 * Slug to label for every interest and group, for anything that has to turn
	 * stored slugs back into words — the search indexer, most of all, which
	 * embeds {@code AI &amp; machine learning} far better than it embeds
	 * {@code ai-machine-learning}.
	 */
	@Transactional(readOnly = true)
	public Map<String, String> interestLabels() {
		return interestRepository.findAll().stream()
				.collect(Collectors.toMap(
						InterestCatalogueEntry::getSlug, InterestCatalogueEntry::getLabel));
	}

	/** Slug to label for every event format, for the same reason as above. */
	@Transactional(readOnly = true)
	public Map<String, String> eventFormatLabels() {
		return eventFormatRepository.findAll().stream()
				.collect(Collectors.toMap(EventFormat::getSlug, EventFormat::getLabel));
	}

	// ----------------------------------------------------------- validation

	/** @throws RequestValidationException if the category is not in V24's list */
	@Transactional(readOnly = true)
	public String requireKnownClubCategory(String slug) {
		if (slug == null || slug.isBlank()) {
			// Absent is legitimate: every club predates V23 and none of them has
			// been categorised yet.
			return null;
		}
		if (!clubCategoryRepository.existsById(slug)) {
			throw new RequestValidationException("Unknown club category: %s".formatted(slug));
		}
		return slug;
	}

	@Transactional(readOnly = true)
	public Set<String> requireKnownInterests(List<String> submitted, int cap, String field) {
		return checked(submitted, cap, field,
				slugs -> interestRepository.findAllById(slugs).stream()
						.map(InterestCatalogueEntry::getSlug).toList());
	}

	@Transactional(readOnly = true)
	public Set<String> requireKnownEventFormats(List<String> submitted, int cap, String field) {
		return checked(submitted, cap, field,
				slugs -> eventFormatRepository.findAllById(slugs).stream()
						.map(EventFormat::getSlug).toList());
	}

	/**
	 * Deduplicates, caps, and refuses anything the vocabulary does not hold.
	 *
	 * <p>The cap is not defending against the pickers, which cap themselves — it
	 * is defending against everything that is not a picker. A club tagged with
	 * thirty interests matches every student, which helps that club not at all
	 * and quietly ruins recommendations for everyone else.
	 */
	private Set<String> checked(List<String> submitted,
	                            int cap,
	                            String field,
	                            Function<Set<String>, List<String>> lookup) {
		if (submitted == null || submitted.isEmpty()) {
			return Set.of();
		}
		Set<String> slugs = new LinkedHashSet<>(submitted);
		slugs.remove(null);
		slugs.remove("");
		if (slugs.isEmpty()) {
			return Set.of();
		}
		if (slugs.size() > cap) {
			throw new RequestValidationException(
					"%s takes at most %d values".formatted(field, cap));
		}

		Set<String> known = Set.copyOf(lookup.apply(slugs));
		List<String> unknown = slugs.stream().filter(slug -> !known.contains(slug)).sorted().toList();
		if (!unknown.isEmpty()) {
			throw new RequestValidationException(
					"Unknown %s: %s".formatted(field, String.join(", ", unknown)));
		}
		return slugs;
	}
}
