package com.campusvibe.instagram;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** The admin's import settings (V42): one row, id 1. */
@Entity
@Table(name = "instagram_import_settings")
@Getter
@Setter
@NoArgsConstructor
public class InstagramImportSettings {

    public static final short ID = 1;

    @Id
    private Short id = ID;

    /** The first N accounts of the ranked list that runs check. */
    @Column(name = "account_count", nullable = false)
    private Integer accountCount;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by")
    private Long updatedBy;
}
