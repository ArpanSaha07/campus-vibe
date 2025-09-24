package com.campusvibe.auth;

import com.campusvibe.jwt.JWTUtil;
import com.campusvibe.user.User;
import com.campusvibe.user.UserDTO;
import com.campusvibe.user.UserDTOMapper;
import com.campusvibe.user.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserDTOMapper userDTOMapper;
    private final JWTUtil jwtUtil;

    public AuthenticationService(AuthenticationManager authenticationManager,
                                 UserRepository userRepository,
                                 PasswordEncoder passwordEncoder,
                                 UserDTOMapper userDTOMapper,
                                 JWTUtil jwtUtil) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userDTOMapper = userDTOMapper;
        this.jwtUtil = jwtUtil;
    }

    public AuthenticationResponse login(AuthenticationRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.email(),
                        request.password()
                )
        );
        User principal = (User) authentication.getPrincipal();
        UserDTO dto = userDTOMapper.apply(principal);
        String token = jwtUtil.issueToken(dto.email(), dto.role().name());
        return new AuthenticationResponse(token, dto);
    }

    public AuthenticationResponse register(RegisterRequest request) {
        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        userRepository.save(user);
        UserDTO dto = userDTOMapper.apply(user);
        String token = jwtUtil.issueToken(dto.email(), dto.role().name());
        return new AuthenticationResponse(token, dto);
    }
}
