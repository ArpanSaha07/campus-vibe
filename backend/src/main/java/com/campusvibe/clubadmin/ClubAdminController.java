package com.campusvibe.clubadmin;

import com.campusvibe.user.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Club administration: who manages a club, and which clubs the caller manages.
 *
 * <p>Two paths under two different roots, which is why there is no class-level
 * {@code @RequestMapping}. {@code /clubs/{clubId}/admins} is a property of a
 * club; {@code /users/me/managed-clubs} is a property of the caller and never
 * takes a user id from the URL, so one user cannot enumerate another's
 * memberships.
 *
 * <p>Note that {@code GET /api/v1/clubs/*} is otherwise public — the
 * {@code /admins} sub-path is pulled back to {@code authenticated()} explicitly
 * in {@code SecurityFilterChainConfig}.
 */
@RestController
public class ClubAdminController {

    private final ClubAdminService clubAdminService;

    public ClubAdminController(ClubAdminService clubAdminService) {
        this.clubAdminService = clubAdminService;
    }

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
}
