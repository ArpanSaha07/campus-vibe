package com.campusvibe.user;

import com.campusvibe.club.ClubDTO;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The signed-in user's followed clubs. Scoped to "me" exactly as
 * MyEventController is: the acting user comes from the JWT, never from a path
 * variable, so one user can never read or change another's follows.
 *
 * Authentication is enforced by SecurityFilterChainConfig. Note that its
 * permitAll entry for GET /api/v1/clubs/** does not reach here — these paths
 * live under /api/v1/users/me and fall through to .anyRequest().authenticated().
 */
@RestController
@RequestMapping("/api/v1/users/me")
public class MyClubController {

	private final MyClubService myClubService;

	public MyClubController(MyClubService myClubService) {
		this.myClubService = myClubService;
	}

	@GetMapping("/clubs")
	public List<ClubDTO> myClubs(Authentication authentication) {
		return myClubService.listMyClubs(authentication.getName());
	}

	@PostMapping("/followed-clubs")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void follow(Authentication authentication, @RequestBody ClubIdRequest request) {
		myClubService.follow(authentication.getName(), request.clubId());
	}

	@DeleteMapping("/followed-clubs/{clubId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void unfollow(Authentication authentication, @PathVariable String clubId) {
		myClubService.unfollow(authentication.getName(), clubId);
	}
}
