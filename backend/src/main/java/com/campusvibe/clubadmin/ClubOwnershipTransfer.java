package com.campusvibe.clubadmin;

import com.campusvibe.club.Club;
import com.campusvibe.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One club changing hands, from the moment it is offered to the moment it is
 * answered.
 *
 * <p><strong>This row grants nothing and takes nothing away.</strong> While it
 * is {@code PENDING} the sitting owner is still the owner in every sense
 * {@code ClubPermissionService} can see, and the successor is still whatever
 * they were. Only {@link #accept} moves authority, and it moves both halves in
 * one transaction — §26, because a club left with zero or two owners is not
 * something the club can fix for itself.
 *
 * <p>Deliberately not a {@code PENDING CLUB_OWNER} row in
 * {@code club_admin_assignments}: the successor is already an ACTIVE
 * {@code CLUB_ADMIN} there, and {@code one_live_assignment_per_club_user}
 * forbids a second live row for the same person in the same club. See
 * {@code V16__create_club_ownership_transfers.sql}.
 */
@Entity
@Table(name = "club_ownership_transfers")
@Getter
@Setter
@NoArgsConstructor
public class ClubOwnershipTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "club_id", nullable = false)
    private Club club;

    /** The sitting owner who offered it. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_user_id", nullable = false)
    private User fromUser;

    /** The admin being offered it. Mapped rather than a plain id because both
     *  the offer screen and the acceptance screen render their name. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_user_id", nullable = false)
    private User toUser;

    /**
     * What the outgoing owner becomes once this commits — {@code CLUB_ADMIN} to
     * stay on the team, or {@code REVOKED} to leave.
     *
     * <p>Reusing {@link ClubRole} would have been wrong: the second option is
     * not a role. This is deliberately a narrow enum of its own so that
     * "becomes an admin" and "leaves" are the only two things it can ever say.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "outgoing_becomes", nullable = false)
    private OutgoingOwner outgoingBecomes = OutgoingOwner.CLUB_ADMIN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransferStatus status = TransferStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    public boolean isPending() {
        return status == TransferStatus.PENDING;
    }

    /**
     * Ends the transfer with an outcome, stamping when.
     *
     * <p>One method for all three endings rather than three, because a database
     * CHECK ties `resolved_at IS NULL` to `status = 'PENDING'` — anything that
     * could set one without the other would fail at the constraint instead of
     * saying something a person can act on.
     */
    public void resolveAs(TransferStatus outcome) {
        this.status = outcome;
        this.resolvedAt = Instant.now();
    }

    /** What the outgoing owner asked to happen to their own membership. */
    public enum OutgoingOwner {
        CLUB_ADMIN,
        REVOKED
    }
}
