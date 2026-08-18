package com.campusvibe.clubadmin;

import com.campusvibe.user.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Club administration: who manages a club, which clubs the caller manages, and
 * the invitations waiting on them.
 *
 * <p>Three roots, which is why there is no class-level {@code @RequestMapping}.
 * {@code /clubs/{clubId}/admins} is a property of a club and is gated on the
 * caller's authority over that club. {@code /users/me/managed-clubs} and
 * {@code /users/me/club-invitations} are properties of the caller and never take
 * a user id from the URL, so one user cannot enumerate another's memberships or
 * answer another's invitation by changing a number.
 *
 * <p>Note that {@code GET /api/v1/clubs/*} is otherwise public — the
 * {@code /admins} sub-path is pulled back to {@code authenticated()} explicitly
 * in {@code SecurityFilterChainConfig}. The write methods here need no such line
 * because that rule matches GET only, so they fall through to
 * {@code anyRequest().authenticated()}.
 */
@RestController
public class ClubAdminController {

    private final ClubAdminService clubAdminService;

    public ClubAdminController(ClubAdminService clubAdminService) {
        this.clubAdminService = clubAdminService;
    }

    // --- the club's team ----------------------------------------------------

    /**
     * The club's management team. Visible to anyone on it — admins as well as
     * the owner, per §3.2, since knowing who your co-administrators are is not
     * a privileged act — and to platform admins.
     *
     * <p>{@code #clubId} is checked against the caller's assignments rather than
     * trusted: sending someone else's club id proves nothing (§25).
     */
    @GetMapping("/api/v1/clubs/{clubId}/admins")
    @PreAuthorize("@clubPermissionService.canManageClub(authentication, #clubId)")
    public List<ClubAdminDTO> listAdmins(@PathVariable String clubId) {
        return clubAdminService.listAdmins(clubId);
    }

    /**
     * Invites someone to help administer the club.
     *
     * <p>{@code isClubOwner}, not {@code canManageClub}. This is the line that
     * stops one compromised club-admin account from turning into two (§37): an
     * admin can edit an event, but cannot bring in an accomplice.
     */
    @PostMapping("/api/v1/clubs/{clubId}/admins/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@clubPermissionService.isClubOwner(authentication, #clubId)")
    public ClubAdminDTO invite(@PathVariable String clubId,
                               @Valid @RequestBody ClubAdminInviteRequest request,
                               Authentication authentication) {
        User actor = (User) authentication.getPrincipal();
        return clubAdminService.invite(clubId, request.email(), actor);
    }

    /**
     * Removes an administrator, or cancels an invitation they have not accepted.
     *
     * <p>Addressed by assignment id rather than by user id, which is a
     * deliberate departure from the shape §33 sketches
     * ({@code DELETE /clubs/{clubId}/admins/{userId}}). An invitation sent to an
     * address with no account yet has no user id to name, and it still has to be
     * cancellable — the assignment id is the only identifier every row on the
     * Administrators list actually has.
     */
    @DeleteMapping("/api/v1/clubs/{clubId}/admins/{assignmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@clubPermissionService.isClubOwner(authentication, #clubId)")
    public void revoke(@PathVariable String clubId,
                       @PathVariable Long assignmentId,
                       Authentication authentication) {
        User actor = (User) authentication.getPrincipal();
        clubAdminService.revoke(clubId, assignmentId, actor);
    }

    // --- the caller's own memberships and invitations ------------------------

    /**
     * Every club the signed-in user may manage, with the role they hold in
     * each. Returns an empty list for an ordinary member rather than 403 — "you
     * manage nothing" is a normal answer, and the dashboard renders an empty
     * state from it.
     */
    @GetMapping("/api/v1/users/me/managed-clubs")
    public List<ManagedClubDTO> myManagedClubs(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return clubAdminService.listManagedClubs(user.getId());
    }

    /**
     * Invitations waiting on the signed-in user, matched by account and by
     * address — an invitation sent before they signed up knows only the latter.
     */
    @GetMapping("/api/v1/users/me/club-invitations")
    public List<ClubInvitationDTO> myInvitations(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return clubAdminService.listInvitations(user);
    }

    /**
     * Accepts an invitation, which is the only way authority is ever granted to
     * an administrator (§6 — nobody becomes one silently).
     *
     * <p>There is no {@code @PreAuthorize} here on purpose. The check is "is
     * this invitation addressed to you, and have you confirmed that address",
     * which cannot be answered without the row; {@code ClubAdminService} does it
     * and says why.
     *
     * @return the club as it now appears on the caller's dashboard
     */
    @PostMapping("/api/v1/users/me/club-invitations/{invitationId}/accept")
    public ManagedClubDTO acceptInvitation(@PathVariable Long invitationId,
                                           Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return clubAdminService.acceptInvitation(invitationId, user);
    }

    @PostMapping("/api/v1/users/me/club-invitations/{invitationId}/decline")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void declineInvitation(@PathVariable Long invitationId,
                                  Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        clubAdminService.declineInvitation(invitationId, user);
    }
}
