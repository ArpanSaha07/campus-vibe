package com.campusvibe.user;

import com.campusvibe.club.Club;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "approved_club_admins")
@Getter
@Setter
@NoArgsConstructor
public class ApprovedClubAdmin {

    @Id
    @Column(nullable = false, unique = true)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "club_id", nullable = false)
    private Club club;

    @Column(nullable = false)
    private Boolean approved = false;

    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt = Instant.now();

    @Column(name = "approved_at")
    private Instant approvedAt;
}
