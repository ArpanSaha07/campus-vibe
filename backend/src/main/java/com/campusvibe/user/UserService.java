package com.campusvibe.user;

import com.campusvibe.exception.ResourceNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

	private final UserRepository userRepository;
	private final UserDTOMapper userDTOMapper;

	public UserService(UserRepository userRepository, UserDTOMapper userDTOMapper) {
		this.userRepository = userRepository;
		this.userDTOMapper = userDTOMapper;
	}

	public UserDTO getMe(Authentication authentication) {
		String email = authentication.getName();
		User user = userRepository.findByEmail(email).orElseThrow();
		return userDTOMapper.apply(user);
	}

	/**
	 * Renames the signed-in account.
	 *
	 * <p>Lives here rather than on the profile endpoint because the name is on
	 * {@code users}, not {@code user_profiles} -- it is part of who the account
	 * is, it is already on {@code UserDTO}, and the auth context on the frontend
	 * is what holds it. One editor screen writes to both, which is why it makes
	 * two calls.
	 *
	 * <p>PATCH rather than PUT, and the difference is honest: this changes one
	 * named field and leaves everything else about the account alone, where the
	 * profile write replaces the whole thing.
	 */
	@Transactional
	public UserDTO updateMe(Authentication authentication, UserUpdateRequest request) {
		String email = authentication.getName();
		User user = userRepository.findByEmail(email)
				.orElseThrow(() -> new ResourceNotFoundException(
						"User with email [%s] not found".formatted(email)));

		user.setName(request.name().trim());
		return userDTOMapper.apply(userRepository.save(user));
	}
}
