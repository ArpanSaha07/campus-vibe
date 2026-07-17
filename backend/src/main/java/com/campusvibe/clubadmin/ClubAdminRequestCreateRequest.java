package com.campusvibe.clubadmin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ClubAdminRequestCreateRequest(
        @NotBlank String clubId,
        @Size(max = 2000) String message
) {}
