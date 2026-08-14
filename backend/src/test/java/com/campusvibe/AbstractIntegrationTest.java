package com.campusvibe;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.clubadmin.ClubAdminRequestRepository;
import com.campusvibe.event.EventRepository;
import com.campusvibe.jwt.JWTUtil;
import com.campusvibe.user.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected JWTUtil jwtUtil;
    @Autowired protected RoleRepository roleRepository;
    @Autowired protected UserRepository userRepository;
    @Autowired protected ClubRepository clubRepository;
    @Autowired protected EventRepository eventRepository;
    @Autowired protected ClubAdminRequestRepository clubAdminRequestRepository;
    @Autowired protected PasswordEncoder passwordEncoder;

    @BeforeEach
    void resetDatabaseAndSeedRoles() {
        clubAdminRequestRepository.deleteAll();
        eventRepository.deleteAll();
        clubRepository.deleteAll();
        userRepository.deleteAll();
        for (RoleName roleName : RoleName.values()) {
            roleRepository.findByName(roleName.name())
                    .orElseGet(() -> roleRepository.save(new Role(roleName.name())));
        }
    }

    protected User createUser(String name, String email, String rawPassword, RoleName... roleNames) {
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        for (RoleName roleName : roleNames) {
            user.addRole(roleRepository.findByName(roleName.name()).orElseThrow());
        }
        return userRepository.save(user);
    }

    protected Club createClub(String id, String name) {
        Club club = new Club();
        club.setId(id);
        club.setName(name);
        return clubRepository.save(club);
    }

    protected String tokenFor(User user) {
        return jwtUtil.issueToken(user.getId(), user.getEmail(), user.getRoleNames());
    }

    protected String bearer(User user) {
        return "Bearer " + tokenFor(user);
    }

    protected static Set<String> roleNamesOf(User user) {
        return Set.copyOf(user.getRoleNames());
    }
}
