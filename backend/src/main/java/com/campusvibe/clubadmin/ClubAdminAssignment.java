package com.campusvibe.clubadmin;

import com.campusvibe.club.Club;
import com.campusvibe.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One user's authority over one club.
 *
 * <p>This replaces {@code clubs.club_admin_id}, which said a club had at most
 * one administrator and that administering was a property of the account. Both
 * were wrong for student clubs: an exec team is several people, and the same
 * person may run one club while being an ordinary member of three others.
 *
 * <p><strong>This table is the authority.</strong> No club-management decision
 * reads a JWT claim, because a token issued before a removal would still carry
 * it (club_admin_governance.md §28). A revoked row here takes effect on the very
 * next request.
 *
 * <p>Two database invariants back this up, both partial unique indexes in
 * {@code V12__create_club_admin_assignments.sql}: one ACTIVE {@code CLUB_OWNER}
 * per club, and one live (PENDING or ACTIVE) row per club-and-user.
 */
@Entity
@Table(name = "club_admin_assignments")
@Getter
@Setter
@NoArgsConstructor
public class ClubAdminAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "club_id", nullable = false)
    private Club club;

    /**
     * The account this assignment belongs to.
     *
     * <p>Null on a PENDING invitation sent to an address with no CampusVibe
     * account yet — see {@link #invitedEmail}. It is filled in at the moment
     * the invitation is claimed, and a database CHECK
     * ({@code club_admin_assignment_active_has_user}) refuses any ACTIVE row
     * without it, so authority is never held by a mailbox.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    /**
     * The address the invitation was sent to, kept even after {@link #user} is
     * resolved.
     *
     * <p>Two reasons it is not dropped on acceptance: it says which address the
     * owner actually typed, which is the only way to explain a mis-sent
     * invitation later; and it is the key
     * {@code one_live_invite_per_club_email} enforces, so clearing it would
     * open a second invitation to the same person.
     *
     * <p>Null on rows that were never invitations — the V12 backfill and
     * {@code assignFirstOwner}.
     */
    @Column(name = "invited_email")
    private String invitedEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ClubRole role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssignmentStatus status = AssignmentStatus.PENDING;

    // Plain ids rather than @ManyToOne User: these are accountability fields,
    // read when rendering history and never navigated from. Mapping them would
    // put two more lazy associations on an entity loaded during authorisation.
    @Column(name = "invited_by_user_id")
    private Long invitedByUserId;

    @Column(name = "revoked_by_user_id")
    private Long revokedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    /** The only question authorisation asks of a row. */
    public boolean isActive() {
        return status == AssignmentStatus.ACTIVE;
    }

    public boolean isActiveOwner() {
        return isActive() && role == ClubRole.CLUB_OWNER;
    }

    /** Moves an invitation to ACTIVE, stamping the moment authority began. */
    public void activate() {
        this.status = AssignmentStatus.ACTIVE;
        this.activatedAt = Instant.now();
    }

    /**
     * Claims a pending invitation for the account that accepted it.
     *
     * <p>Setting the user and activating are one act, never two: an ACTIVE row
     * with no user violates a database CHECK, so anything that could leave them
     * out of step would fail at the constraint rather than in a message anyone
     * can act on.
     */
    public void claimBy(User claimant) {
        this.user = claimant;
        activate();
    }

    /**
     * Ends the assignment. The row stays — see {@link AssignmentStatus#REVOKED}
     * — so that "who could manage this club last spring" remains answerable.
     */
    public void revoke(Long revokedBy) {
        this.status = AssignmentStatus.REVOKED;
        this.revokedAt = Instant.now();
        this.revokedByUserId = revokedBy;
    }
}
