package com.campusvibe.clubadmin;

import jakarta.validation.constraints.NotNull;

/**
 * The sitting owner offering their club to one of its admins.
 *
 * <p>Takes a user id, not an address. The successor has to be an active
 * {@code CLUB_ADMIN} of this club already, so they are being picked from a list
 * the owner is looking at rather than typed — and an id that is not on that list
 * is refused by the service, so the narrower type is not the check.
 *
 * <p>{@code outgoingBecomes} is required rather than defaulted. A defaulted
 * field here would mean the most consequential half of the decision — whether
 * the outgoing owner stays on the team — could be made by forgetting to send
 * it. The UI defaults the radio; the API does not default the field.
 */
public record OwnershipTransferRequest(
        @NotNull Long toUserId,
        @NotNull ClubOwnershipTransfer.OutgoingOwner outgoingBecomes
) {}
