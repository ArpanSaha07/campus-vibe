package com.campusvibe.instagram;

import com.campusvibe.ai.AiServiceUnavailableException;
import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.RequestValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

class AdminInstagramServiceTest {

    private InstagramImportService importService;
    private InstagramSourceRepository sources;
    private AdminInstagramService service;

    @BeforeEach
    void setUp() {
        importService = mock(InstagramImportService.class);
        sources = mock(InstagramSourceRepository.class);
        InstagramImportSettingsService settings = mock(InstagramImportSettingsService.class);
        when(settings.accountCount()).thenReturn(50);
        when(settings.totalAccounts()).thenReturn(463L);
        when(importService.isConfigured()).thenReturn(true);
        when(importService.recentRuns(anyInt())).thenReturn(List.of());
        when(sources.findAllById(any())).thenReturn(List.of());
        service = new AdminInstagramService(importService, settings, sources);
    }

    @Test
    void importNowStartsARunOverTheList() {
        when(importService.startAdminRun()).thenReturn(new InstagramImportRun());

        AdminInstagramDTO dto = service.importNow();

        verify(importService).startAdminRun();
        assertThat(dto.accountCount()).isEqualTo(50);
        assertThat(dto.totalAccounts()).isEqualTo(463L);
    }

    @Test
    void importNowIsRefusedWhileARunHoldsTheLease() {
        when(importService.startAdminRun()).thenReturn(null);

        assertThatThrownBy(() -> service.importNow()).isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void importNowIsRefusedWhenTheServerCannotImport() {
        when(importService.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.importNow()).isInstanceOf(AiServiceUnavailableException.class);
        verify(importService, never()).startAdminRun();
    }

    @Test
    void aClubRunIsListedWithItsHandle() {
        InstagramImportRun run = new InstagramImportRun();
        run.setTrigger(InstagramImportRun.Trigger.MANUAL);
        run.setSourceId(463L);
        InstagramSource source = new InstagramSource();
        source.setId(463L);
        source.setHandle("girlswhocodemcgill");
        when(importService.recentRuns(anyInt())).thenReturn(List.of(run));
        when(sources.findAllById(any())).thenReturn(List.of(source));

        assertThat(service.get().recentRuns()).singleElement()
                .extracting(InstagramImportRunDTO::handle).isEqualTo("girlswhocodemcgill");
    }

    @Test
    void theAccountCountMustFitTheList() {
        InstagramImportSettingsRepository repo = mock(InstagramImportSettingsRepository.class);
        when(repo.findById(InstagramImportSettings.ID)).thenReturn(Optional.empty());
        when(sources.count()).thenReturn(463L);
        InstagramImportSettingsService real =
                new InstagramImportSettingsService(repo, sources, mock(InstagramProperties.class));

        assertThatThrownBy(() -> real.setAccountCount(0, 1L)).isInstanceOf(RequestValidationException.class);
        assertThatThrownBy(() -> real.setAccountCount(464, 1L)).isInstanceOf(RequestValidationException.class);
        assertThat(real.setAccountCount(100, 1L)).isEqualTo(100);
        verify(repo).save(argThat(s -> s.getAccountCount() == 100 && s.getUpdatedBy() == 1L));
    }
}
