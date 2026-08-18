package com.campusvibe.clubadmin;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClubOwnershipTransferRepository extends JpaRepository<ClubOwnershipTransfer, Long> {

    /**
     * The club's transfer in flight, if it has one. Singular by construction —
     * {@code one_pending_transfer_per_club} allows no more than one PENDING row
     * per club, so this cannot silently return the wrong one of several.
     *
     * <p>Both users are fetched because every caller renders their names: the
     * owner's screen says who it was offered to, the successor's says who
     * offered it.
     */
    @EntityGraph(attributePaths = {"fromUser", "toUser"})
    Optional<ClubOwnershipTransfer> findByClubIdAndStatus(String clubId, TransferStatus status);

    /**
     * Transfers waiting on this person to answer. A list rather than an
     * Optional: one person can be admin of several clubs and be offered more
     * than one at a time, which is uncommon but entirely legal.
     */
    @EntityGraph(attributePaths = {"club", "fromUser", "toUser"})
    List<ClubOwnershipTransfer> findByToUserIdAndStatusOrderByCreatedAtAsc(
            Long toUserId, TransferStatus status);

    /**
     * A club's pending transfer naming this person on either side.
     *
     * <p>Used when someone is removed from a club: a transfer offered to them,
     * or by them, has nothing left to land on, and leaving it PENDING would
     * hold the club's one transfer slot against a handover that can never
     * complete.
     */
    @EntityGraph(attributePaths = {"club", "fromUser", "toUser"})
    List<ClubOwnershipTransfer> findByClubIdAndStatusAndToUserId(
            String clubId, TransferStatus status, Long toUserId);
}
