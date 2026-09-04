package com.campusvibe.clubadmin;

import java.time.Instant;

/**
 * A pending handover, shown to both sides.
 *
 * <p>One record rather than two because both parties need the same four facts —
 * which club, from whom, to whom, and what happens to the outgoing owner — and
 * neither side learns anything from it they did not already know. The club's
 * management team can already see each other's names through
 * {@code ClubAdminDTO}, and the successor is being offered the club, so being
 * told who is offering it is rather the point.
 *
 * <p>{@code clubName} and {@code clubLogo} are carried for the successor's
 * screen, which lists offers across every club they help run and so cannot get
 * the club from its route.
 */
public record OwnershipTransferDTO(
        Long transferId,
        String clubId,
        String clubName,
        String clubLogo,
        Long fromUserId,
        String fromUserName,
        Long toUserId,
        String toUserName,
        ClubOwnershipTransfer.OutgoingOwner outgoingBecomes,
        TransferStatus status,
        Instant createdAt
) {}
