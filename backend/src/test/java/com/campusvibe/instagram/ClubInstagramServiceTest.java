package com.campusvibe.instagram;

import com.campusvibe.ai.AiServiceUnavailableException;
import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.club.ClubService;
import com.campusvibe.club.ClubUpdateRequest;
import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.TooManyAttemptsException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ClubInstagramServiceTest {

    private ClubRepository clubs;
    private ClubService clubService;
    private InstagramSourceRepository sources;
    private InstagramImportService importService;
    private ClubInstagramService service;
    private InstagramImportSettingsService settings;
    private Club club;

    @BeforeEach
    void setUp() {
        clubs = mock(ClubRepository.class);
        clubService = mock(ClubService.class);
        sources = mock(InstagramSourceRepository.class);
        importService = mock(InstagramImportService.class);
        settings = mock(InstagramImportSettingsService.class);
        when(settings.accountCount()).thenReturn(50);
        service = new ClubInstagramService(clubs, clubService, sources, importService, new ObjectMapper(), settings);

        club = new Club();
        club.setId("chess");
        club.setSocialLinks("{\"email\":\"\",\"website\":\"https://chess.ca\",\"facebook\":\"\","
                + "\"instagram\":\"\",\"linkedin\":\"\",\"linktree\":\"\"}");
        when(clubs.findById("chess")).thenReturn(Optional.of(club));
        when(sources.findFirstByClubId("chess")).thenReturn(Optional.empty());
        when(sources.save(any())).thenAnswer(i -> {
            InstagramSource s = i.getArgument(0);
            if (s.getId() == null) s.setId(99L);
            return s;
        });
        when(importService.isConfigured()).thenReturn(true);
    }

    @Test
    void handleFromAcceptsAtHandlesAndLinksAndLowercases() {
        assertThat(ClubInstagramService.handleFrom("@McGill.Chess")).isEqualTo("mcgill.chess");
        assertThat(ClubInstagramService.handleFrom("https://www.instagram.com/mcgillchess/")).isEqualTo("mcgillchess");
        assertThat(ClubInstagramService.handleFrom("  ")).isNull();
        assertThatThrownBy(() -> ClubInstagramService.handleFrom("javascript:alert(1)"))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    void savingANewHandleCreatesAnOptedInSourceAndKeepsTheOtherLinks() {
        when(sources.findByHandle("mcgillchess")).thenReturn(Optional.empty());
        when(sources.maxPriority()).thenReturn(461);

        ClubInstagramDTO dto = service.update("chess", new ClubInstagramUpdateRequest("@McGillChess", true));

        ArgumentCaptor<InstagramSource> saved = ArgumentCaptor.forClass(InstagramSource.class);
        verify(sources).save(saved.capture());
        assertThat(saved.getValue().getHandle()).isEqualTo("mcgillchess");
        assertThat(saved.getValue().getPriority()).isEqualTo(462);
        assertThat(saved.getValue().getEnabled()).isTrue();
        assertThat(saved.getValue().getClubOptedIn()).isTrue();
        assertThat(saved.getValue().getClub()).isSameAs(club);

        ArgumentCaptor<ClubUpdateRequest> update = ArgumentCaptor.forClass(ClubUpdateRequest.class);
        verify(clubService).update(eq("chess"), update.capture());
        assertThat(update.getValue().socialLinks())
                .contains("\"instagram\":\"mcgillchess\"")
                .contains("https://chess.ca");
        assertThat(dto.handle()).isEqualTo("mcgillchess");
        assertThat(dto.autoImport()).isTrue();
        assertThat(dto.running()).isFalse();
    }

    @Test
    void savingTheHandleOrTheToggleNeverStartsAnImport() {
        when(sources.findByHandle("mcgillchess")).thenReturn(Optional.empty());

        service.update("chess", new ClubInstagramUpdateRequest("mcgillchess", true));
        service.update("chess", new ClubInstagramUpdateRequest("mcgillchess", false));

        verify(importService, never()).startSourceRun(anyLong(), any());
        verify(importService, never()).startBackgroundRun();
        verify(importService, never()).runScheduled();
    }

    @Test
    void connectingWithoutChoosingKeepsTheAccountInsideTheAdminsN() {
        InstagramSource seeded = source("mcgillchess");
        seeded.setPriority(10);
        seeded.setEnabled(false); // switched off by the old cap, linked to no club
        when(sources.findByHandle("mcgillchess")).thenReturn(Optional.of(seeded));
        when(sources.countRankedAhead(10)).thenReturn(9L);

        ClubInstagramDTO dto = service.update("chess", new ClubInstagramUpdateRequest("mcgillchess", null));

        assertThat(seeded.getEnabled()).isTrue();
        assertThat(seeded.getClubOptedIn()).isFalse();
        assertThat(dto.autoImport()).isTrue(); // row 10 of N = 50
    }

    @Test
    void anAccountOutsideNIsCheckedOnlyOnceTheClubOptsIn() {
        InstagramSource seeded = source("mcgillchess");
        seeded.setPriority(300);
        when(sources.findByHandle("mcgillchess")).thenReturn(Optional.of(seeded));
        when(sources.countRankedAhead(300)).thenReturn(299L);

        assertThat(service.update("chess", new ClubInstagramUpdateRequest("mcgillchess", null)).autoImport())
                .isFalse();
        assertThat(service.update("chess", new ClubInstagramUpdateRequest("mcgillchess", true)).autoImport())
                .isTrue();
    }

    @Test
    void turningAutoImportOffDropsTheAccountEvenInsideN() {
        InstagramSource seeded = source("mcgillchess");
        when(sources.findByHandle("mcgillchess")).thenReturn(Optional.of(seeded));
        when(sources.countRankedAhead(1)).thenReturn(0L);

        ClubInstagramDTO dto = service.update("chess", new ClubInstagramUpdateRequest("mcgillchess", false));

        assertThat(seeded.getEnabled()).isFalse();
        assertThat(dto.autoImport()).isFalse();
    }

    @Test
    void aHandleLinkedToAnotherClubIsRefused() {
        Club other = new Club();
        other.setId("other");
        InstagramSource taken = source("mcgillchess");
        taken.setClub(other);
        when(sources.findByHandle("mcgillchess")).thenReturn(Optional.of(taken));

        assertThatThrownBy(() -> service.update("chess", new ClubInstagramUpdateRequest("mcgillchess", true)))
                .isInstanceOf(DuplicateResourceException.class);
        verify(clubService, never()).update(any(), any());
    }

    @Test
    void changingTheHandleReleasesTheOldOptedInSource() {
        InstagramSource old = source("oldchess");
        old.setClub(club);
        old.setClubOptedIn(true);
        when(sources.findFirstByClubId("chess")).thenReturn(Optional.of(old));
        when(sources.findByHandle("newchess")).thenReturn(Optional.empty());

        service.update("chess", new ClubInstagramUpdateRequest("newchess", false));

        // The club's choice goes with it: the account returns to its place in
        // the ranked list, checked only if it falls inside the admin's N.
        assertThat(old.getClub()).isNull();
        assertThat(old.getEnabled()).isTrue();
        assertThat(old.getClubOptedIn()).isFalse();
    }

    @Test
    void importNowIsRefusedInsideTheCooldown() {
        connect("mcgillchess").setLastFetchAt(Instant.now().minus(Duration.ofMinutes(10)));

        assertThatThrownBy(() -> service.importNow("chess")).isInstanceOf(TooManyAttemptsException.class);
        verify(importService, never()).startSourceRun(anyLong(), any());
    }

    @Test
    void importNowIsRefusedWhileThisClubsRunIsGoing() {
        connect("mcgillchess");
        when(importService.isSourceRunning(7L)).thenReturn(true);

        assertThatThrownBy(() -> service.importNow("chess")).isInstanceOf(DuplicateResourceException.class);
        verify(importService, never()).startSourceRun(anyLong(), any());
    }

    @Test
    void importNowLosingTheAtomicClaimIsTheCooldownAnswer() {
        connect("mcgillchess");
        when(importService.startSourceRun(eq(7L), any())).thenReturn(null);

        assertThatThrownBy(() -> service.importNow("chess")).isInstanceOf(TooManyAttemptsException.class);
    }

    @Test
    void importNowIsRefusedWhenTheServerCannotImport() {
        connect("mcgillchess");
        when(importService.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.importNow("chess")).isInstanceOf(AiServiceUnavailableException.class);
    }

    @Test
    void importNowStartsARunForTheConnectedSource() {
        InstagramSource s = connect("mcgillchess");
        s.setLastFetchAt(Instant.now().minus(Duration.ofHours(2)));
        when(importService.startSourceRun(7L, ClubInstagramService.COOLDOWN)).thenAnswer(i -> {
            when(importService.isSourceRunning(7L)).thenReturn(true);
            return new InstagramImportRun();
        });
        when(sources.findById(7L)).thenReturn(Optional.of(s));

        ClubInstagramDTO dto = service.importNow("chess");

        verify(importService).startSourceRun(7L, ClubInstagramService.COOLDOWN);
        assertThat(dto.running()).isTrue();
    }

    @Test
    void importNowNeedsASavedHandle() {
        assertThatThrownBy(() -> service.importNow("chess")).isInstanceOf(RequestValidationException.class);
    }

    private InstagramSource connect(String handle) {
        club.setSocialLinks("{\"instagram\":\"https://instagram.com/" + handle + "\"}");
        InstagramSource s = source(handle);
        s.setClub(club);
        when(sources.findByHandle(handle)).thenReturn(Optional.of(s));
        return s;
    }

    private static InstagramSource source(String handle) {
        InstagramSource s = new InstagramSource();
        s.setId(7L);
        s.setHandle(handle);
        s.setPriority(1);
        return s;
    }
}
