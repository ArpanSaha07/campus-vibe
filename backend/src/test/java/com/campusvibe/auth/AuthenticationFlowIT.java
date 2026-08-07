package com.campusvibe.auth;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthenticationFlowIT extends AbstractIntegrationTest {

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    @Test
    void registerReturnsTokenAndUserWithRoleUser() throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "Alice",
                                "email", "alice@campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", not(emptyString())))
                .andExpect(jsonPath("$.user.email", is("alice@campus.com")))
                .andExpect(jsonPath("$.user.roles", contains("ROLE_USER")))
                .andReturn().getResponse().getContentAsString();

        // The JWT itself carries identity + roles only
        String token = objectMapper.readTree(response).get("token").asText();
        Long userId = objectMapper.readTree(response).get("user").get("id").asLong();
        assertEquals(String.valueOf(userId), jwtUtil.getSubject(token));
        assertEquals("alice@campus.com", jwtUtil.getEmail(token));
        assertEquals(List.of("ROLE_USER"), jwtUtil.getRoles(token));
    }

    @Test
    void registerRejectsDuplicateEmailWith409() throws Exception {
        createUser("Bob", "bob@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "Bob Again",
                                "email", "bob@campus.com",
                                "password", "password123"))))
                .andExpect(status().isConflict());
    }

    @Test
    void registerValidatesEmailAndPassword() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "X", "email", "not-an-email", "password", "password123"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "X", "email", "x@y.com", "password", "short"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginReturnsTokenWithAllRoles() throws Exception {
        createUser("Carol", "carol@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);

        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "carol@campus.com", "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.roles", containsInAnyOrder("ROLE_USER", "ROLE_ADMIN")))
                .andReturn().getResponse().getContentAsString();

        String token = objectMapper.readTree(response).get("token").asText();
        assertEquals(List.of("ROLE_ADMIN", "ROLE_USER"), jwtUtil.getRoles(token));
    }

    @Test
    void loginRejectsWrongPasswordWith401() throws Exception {
        createUser("Dave", "dave@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "dave@campus.com", "password", "wrong-password"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginRejectsUnknownEmailWith401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ghost@campus.com", "password", "password123"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meReturnsCurrentUser() throws Exception {
        User user = createUser("Eve", "eve@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(get("/api/v1/users/me").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(user.getId().intValue())))
                .andExpect(jsonPath("$.email", is("eve@campus.com")))
                .andExpect(jsonPath("$.roles", contains("ROLE_USER")));
    }

    @Test
    void meWithoutTokenIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isForbidden());
    }

    @Test
    void garbageTokenIsRejectedNotServerError() throws Exception {
        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer this.is.not-a-valid-jwt"))
                .andExpect(status().isForbidden());
    }

    @Test
    void tamperedTokenIsRejected() throws Exception {
        User user = createUser("Frank", "frank@campus.com", "password123", RoleName.ROLE_USER);
        String token = tokenFor(user);
        String tampered = token.substring(0, token.length() - 4) + "AAAA";

        mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + tampered))
                .andExpect(status().isForbidden());
    }

    @Test
    void tokenForDeletedUserIsRejected() throws Exception {
        User user = createUser("Gone", "gone@campus.com", "password123", RoleName.ROLE_USER);
        String token = tokenFor(user);
        userRepository.delete(user);

        mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }
}
