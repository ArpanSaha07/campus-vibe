package com.campusvibe.user;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pins how User hands out its collections.
 *
 * These are not tests of Java's collection framework — they are a guard on a
 * decision that has already been reverted once by an automated fix. Copilot
 * Autofix answered CodeQL's internal-representation warning by returning
 * `new HashSet<>(field)` (commit 1562eae), which silently detached the write
 * path from Hibernate and lost every saved event. If either the copy or the
 * plain Lombok getter comes back, the assertions below fail.
 */
class UserTest {

	@Test
	void savedEventIdsCannotBeMutatedThroughTheGetter() {
		User user = new User();

		// A defensive copy would accept this and drop it on the floor, which is
		// exactly the failure mode being guarded against.
		assertThrows(UnsupportedOperationException.class,
				() -> user.getSavedEventIds().add(1L));
	}

	@Test
	void goingEventIdsCannotBeMutatedThroughTheGetter() {
		User user = new User();

		assertThrows(UnsupportedOperationException.class,
				() -> user.getGoingEventIds().add(1L));
	}

	@Test
	void rolesCannotBeMutatedThroughTheGetter() {
		User user = new User();

		assertThrows(UnsupportedOperationException.class,
				() -> user.getRoles().add(new Role(RoleName.ROLE_USER.name())));
	}

	@Test
	void mutatorsAreTheWayIn() {
		User user = new User();

		user.addSavedEvent(7L);
		user.addGoingEvent(8L);
		user.addRole(new Role(RoleName.ROLE_ADMIN.name()));

		assertEquals(java.util.Set.of(7L), user.getSavedEventIds());
		assertEquals(java.util.Set.of(8L), user.getGoingEventIds());
		assertTrue(user.hasRole(RoleName.ROLE_ADMIN));

		user.removeSavedEvent(7L);
		user.removeGoingEvent(8L);

		assertTrue(user.getSavedEventIds().isEmpty());
		assertTrue(user.getGoingEventIds().isEmpty());
	}

	/**
	 * The property Hibernate actually depends on: the getter is a window onto the
	 * live collection, not a snapshot of it. A copy taken before the mutation
	 * would still read empty here.
	 */
	@Test
	void theGetterIsAViewOfLiveState() {
		User user = new User();
		var saved = user.getSavedEventIds();

		user.addSavedEvent(42L);

		assertTrue(saved.contains(42L));
	}
}
