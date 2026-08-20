package com.campusvibe.user;

import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

	private final UserService userService;

	public UserController(UserService userService) {
		this.userService = userService;
	}

	@GetMapping("/me")
	public UserDTO me(Authentication authentication) {
		return userService.getMe(authentication);
	}

	// Returns the updated account so the caller can put it straight back into
	// its auth state -- otherwise the navbar keeps showing the old name until
	// something else happens to refetch.
	@PatchMapping("/me")
	public UserDTO updateMe(Authentication authentication,
	                        @Valid @RequestBody UserUpdateRequest request) {
		return userService.updateMe(authentication, request);
	}
}
