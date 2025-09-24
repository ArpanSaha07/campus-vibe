package com.campusvibe.auth;

import com.campusvibe.user.UserDTO;

public record AuthenticationResponse (
        String token,
        UserDTO user){
}
