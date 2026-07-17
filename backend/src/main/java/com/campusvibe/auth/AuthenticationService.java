package com.campusvibe.auth;

import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.jwt.JWTUtil;
import com.campusvibe.user.*;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserDTOMapper userDTOMapper;
    private final JWTUtil jwtUtil;
    private final GoogleTokenVerifier googleTokenVerifier;

    public AuthenticationService(AuthenticationManager authenticationManager,
                                 UserRepository userRepository,
                                 RoleRepository roleRepository,
                                 PasswordEncoder passwordEncoder,
                                 UserDTOMapper userDTOMapper,
                                 JWTUtil jwtUtil,
                                 GoogleTokenVerifier googleTokenVerifier) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.userDTOMapper = userDTOMapper;
        this.jwtUtil = jwtUtil;
        this.googleTokenVerifier = googleTokenVerifier;
    }

    public AuthenticationResponse login(AuthenticationRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.email(),
                        request.password()
                )
        );
        User principal = (User) authentication.getPrincipal();
        return respondWithToken(principal);
    }

    @Transactional
    public AuthenticationResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new DuplicateResourceException("An account with this email already exists");
        }
        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.getRoles().add(defaultRole());
        userRepository.save(user);
        return respondWithToken(user);
    }

    @Transactional
    public AuthenticationResponse googleSignIn(GoogleSignInRequest request) {
        Object payloadObj = googleTokenVerifier.verify(request.idToken());
        if (payloadObj == null) {
            throw new org.springframework.security.authentication.BadCredentialsException("Invalid Google token");
        }
        com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload payload =
                (com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload) payloadObj;
        String email = payload.getEmail();
        String name = (String) payload.get("name");
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email);
            u.setName(name != null ? name : email);
            u.setPassword(passwordEncoder.encode("google-login-" + System.nanoTime()));
            u.getRoles().add(defaultRole());
            return userRepository.save(u);
        });
        return respondWithToken(user);
    }

    private AuthenticationResponse respondWithToken(User user) {
        UserDTO dto = userDTOMapper.apply(user);
        String token = jwtUtil.issueToken(user.getId(), user.getEmail(), user.getRoleNames());
        return new AuthenticationResponse(token, dto);
    }

    private Role defaultRole() {
        return roleRepository.findByName(RoleName.ROLE_USER.name())
                .orElseThrow(() -> new IllegalStateException(
                        "ROLE_USER is missing from the roles table; check Flyway migration V7"));
    }
}
