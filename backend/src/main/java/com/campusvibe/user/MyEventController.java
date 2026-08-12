package com.campusvibe.user;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The signed-in user's own events. Every route is scoped to "me" — the acting
 * user comes from the JWT, never from a path variable, so one user can never
 * read or edit another's saved list.
 *
 * Authentication is enforced by SecurityFilterChainConfig: these paths are not
 * in the permitAll list, so they fall through to .anyRequest().authenticated().
 */
@RestController
@RequestMapping("/api/v1/users/me")
public class MyEventController {

	private final MyEventService myEventService;

	public MyEventController(MyEventService myEventService) {
		this.myEventService = myEventService;
	}

	@GetMapping("/events")
	public List<MyEventDTO> myEvents(Authentication authentication) {
		return myEventService.listMyEvents(authentication.getName());
	}

	@PostMapping("/saved-events")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void saveEvent(Authentication authentication, @RequestBody EventIdRequest request) {
		myEventService.saveEvent(authentication.getName(), request.eventId());
	}

	@DeleteMapping("/saved-events/{eventId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void unsaveEvent(Authentication authentication, @PathVariable Long eventId) {
		myEventService.unsaveEvent(authentication.getName(), eventId);
	}

	@PostMapping("/rsvps")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void rsvp(Authentication authentication, @RequestBody EventIdRequest request) {
		myEventService.rsvp(authentication.getName(), request.eventId());
	}

	@DeleteMapping("/rsvps/{eventId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void cancelRsvp(Authentication authentication, @PathVariable Long eventId) {
		myEventService.cancelRsvp(authentication.getName(), eventId);
	}
}
