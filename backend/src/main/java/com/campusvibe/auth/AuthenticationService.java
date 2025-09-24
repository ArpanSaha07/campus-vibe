package com.campusvibe.auth;

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
    private final PasswordEncoder passwordEncoder;
    private final UserDTOMapper userDTOMapper;
    private final JWTUtil jwtUtil;
    private final ApprovedClubAdminRepository approvedClubAdminRepository;
    private final GoogleTokenVerifier googleTokenVerifier;

    public AuthenticationService(AuthenticationManager authenticationManager,
                                 UserRepository userRepository,
                                 PasswordEncoder passwordEncoder,
                                 UserDTOMapper userDTOMapper,
                                 JWTUtil jwtUtil,
                                 ApprovedClubAdminRepository approvedClubAdminRepository,
                                 GoogleTokenVerifier googleTokenVerifier) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userDTOMapper = userDTOMapper;
        this.jwtUtil = jwtUtil;
        this.approvedClubAdminRepository = approvedClubAdminRepository;
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
        // Enforce approval: if email present and not approved, block
        approvedClubAdminRepository.findById(principal.getEmail()).ifPresent(aca -> {
            if (!Boolean.TRUE.equals(aca.getApproved())) {
                throw new RuntimeException("Pending admin approval for club admin");
            } else {
                principal.setRole(Role.CLUB_ADMIN);
                principal.setManagedClub(aca.getClub());
                userRepository.save(principal);
            }
        });
        UserDTO dto = userDTOMapper.apply(principal);
        String token = jwtUtil.issueToken(dto.email(), dto.role().name());
        return new AuthenticationResponse(token, dto);
    }

    @Transactional
    public AuthenticationResponse register(RegisterRequest request) {
        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        approvedClubAdminRepository.findById(user.getEmail()).ifPresent(aca -> {
            if (!Boolean.TRUE.equals(aca.getApproved())) {
                throw new RuntimeException("Pending admin approval for club admin");
            } else {
                user.setRole(Role.CLUB_ADMIN);
                user.setManagedClub(aca.getClub());
            }
        });
        userRepository.save(user);
        UserDTO dto = userDTOMapper.apply(user);
        String token = jwtUtil.issueToken(dto.email(), dto.role().name());
        return new AuthenticationResponse(token, dto);
    }

    public AuthenticationResponse googleSignIn(GoogleSignInRequest request) {
        Object payloadObj = googleTokenVerifier.verify(request.idToken());
        if (payloadObj == null) {
            throw new RuntimeException("Invalid Google token");
        }
        com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload payload = (com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload) payloadObj;
        String email = payload.getEmail();
        String name = (String) payload.get("name");
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email);
            u.setName(name != null ? name : email);
            u.setPassword(passwordEncoder.encode("google-login"));
            return u;
        });
        approvedClubAdminRepository.findById(email).ifPresent(aca -> {
            if (!Boolean.TRUE.equals(aca.getApproved())) {
                throw new RuntimeException("Pending admin approval for club admin");
            } else {
                user.setRole(Role.CLUB_ADMIN);
                user.setManagedClub(aca.getClub());
            }
        });
        userRepository.save(user);
        UserDTO dto = userDTOMapper.apply(user);
        String token = jwtUtil.issueToken(dto.email(), dto.role().name());
        return new AuthenticationResponse(token, dto);
    }
}
