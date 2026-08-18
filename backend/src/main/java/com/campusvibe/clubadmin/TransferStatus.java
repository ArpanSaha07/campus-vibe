package com.campusvibe.clubadmin;

/**
 * Where an ownership transfer got to.
 *
 * <p>Only {@code PENDING} is live; the other three are outcomes and exist so
 * that a club's history of handovers survives. That matters more here than for
 * an assignment: once a transfer commits, the assignment rows no longer say who
 * handed over to whom — the outgoing owner's row has become an admin row or a
 * revoked one, and neither remembers why.
 *
 * <p>{@code DECLINED} is the successor's answer, {@code CANCELLED} is the
 * outgoing owner's or a side effect of the successor being removed from the
 * club. Kept apart because "they said no" and "it was withdrawn" are different
 * facts about the same club.
 */
public enum TransferStatus {
    PENDING,
    ACCEPTED,
    DECLINED,
    CANCELLED
}
