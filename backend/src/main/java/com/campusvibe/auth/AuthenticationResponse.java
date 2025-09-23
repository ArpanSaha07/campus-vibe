package com.campusvibe.auth;

import com.campusvibe.customer.CustomerDTO;

public record AuthenticationResponse (
        String token,
        CustomerDTO customerDTO){
}
