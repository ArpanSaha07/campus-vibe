package com.campusvibe.user;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

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
}
