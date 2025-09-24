package com.campusvibe.user;

import org.springframework.stereotype.Component;

import java.util.function.Function;

@Component
public class UserDTOMapper implements Function<User, UserDTO> {
    @Override
    public UserDTO apply(User user) {
        return new UserDTO(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getDateJoined(),
                user.getManagedClub() != null ? user.getManagedClub().getId() : null
        );
    }
}

