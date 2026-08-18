package com.campusvibe.clubadmin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * An owner inviting someone to help administer their club.
 *
 * <p>Only an address. There is no {@code role} field on purpose: the sole role
 * an owner may hand out is {@code CLUB_ADMIN}, and ownership changes hands
 * through transfer rather than through an invitation (§8). Accepting a role
 * from the request body would make "invite them as CLUB_OWNER" one forged
 * payload away.
 *
 * <p>{@code @Email} is a shape check, not proof. What actually protects the
 * club is that claiming an invitation requires a signed-in account with that
 * address confirmed — see {@code ClubAdminService.claimantOf}.
 */
public record ClubAdminInviteRequest(
        @NotBlank @Email @Size(max = 255) String email
) {}
