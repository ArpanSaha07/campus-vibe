package com.campusvibe.user;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubDTO;
import com.campusvibe.club.ClubMapper;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * The clubs the signed-in user follows — the data behind the My clubs page and
 * the state of every Follow button.
 *
 * Follows are runtime data, written through this service and never seeded
 * through Flyway (see .claude/skills/database-lifecycle). The join table itself
 * has existed since V4; this is the first code to write to it.
 */
@Service
public class MyClubService {

	private final UserRepository userRepository;
	private final ClubRepository clubRepository;
	private final ClubMapper clubMapper;

	public MyClubService(UserRepository userRepository,
	                     ClubRepository clubRepository,
	                     ClubMapper clubMapper) {
		this.userRepository = userRepository;
		this.clubRepository = clubRepository;
		this.clubMapper = clubMapper;
	}

	/**
	 * Every club the user follows, alphabetically.
	 *
	 * Sorted server-side so the My clubs grid does not reshuffle between loads,
	 * and case-insensitively so a lowercase name does not sort after Z.
	 */
	@Transactional(readOnly = true)
	public List<ClubDTO> listMyClubs(String email) {
		Set<String> followed = requireUser(email).getFollowedClubIds();
		if (followed.isEmpty()) {
			return List.of();
		}

		// findAllById quietly skips ids with no row. The FK carries ON DELETE
		// CASCADE so a deleted club takes its follow rows with it, but this also
		// covers the window where the two disagree rather than 500ing.
		return clubRepository.findAllById(followed).stream()
				.map(clubMapper)
				.sorted(Comparator.comparing(ClubDTO::name, String.CASE_INSENSITIVE_ORDER))
				.toList();
	}

	/**
	 * Follow a club, and count it.
	 *
	 * Set.add reports whether anything changed, and the follower count moves only
	 * when it did — so a double-tapped button neither 500s on the primary key nor
	 * inflates the total. Club.followers stays a stored column rather than a
	 * COUNT(*) over this table because V6 seeds the mock clubs with plausible
	 * numbers; deriving it would reset all eight to zero.
	 */
	@Transactional
	public void follow(String email, String clubId) {
		Club club = requireClub(clubId);
		if (requireUser(email).getFollowedClubIds().add(clubId)) {
			club.setFollowers(club.getFollowers() + 1);
		}
	}

	/**
	 * Unfollow a club.
	 *
	 * Deliberately does not require the club to exist — removing a follow is a
	 * cleanup, and failing it because the club is already gone would leave the
	 * user unable to tidy up. Mirrors MyEventService.unsaveEvent.
	 *
	 * The count floors at zero: the seeded totals are not real follows, so a
	 * user who unfollows a club with a seeded count of 0 must not push it
	 * negative.
	 */
	@Transactional
	public void unfollow(String email, String clubId) {
		if (requireUser(email).getFollowedClubIds().remove(clubId)) {
			clubRepository.findById(clubId)
					.ifPresent(club -> club.setFollowers(Math.max(0, club.getFollowers() - 1)));
		}
	}

	private User requireUser(String email) {
		return userRepository.findByEmail(email)
				.orElseThrow(() -> new ResourceNotFoundException(
						"User with email [%s] not found".formatted(email)));
	}

	private Club requireClub(String clubId) {
		return clubRepository.findById(clubId)
				.orElseThrow(() -> new ResourceNotFoundException(
						"Club with id [%s] not found".formatted(clubId)));
	}
}
