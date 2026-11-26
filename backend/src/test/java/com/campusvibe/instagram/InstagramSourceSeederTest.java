package com.campusvibe.instagram;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * The seeder's own behaviour, not the bundled list's order: that order is ranked
 * by hand and deliberately not asserted.
 */
class InstagramSourceSeederTest {

    @Test
    @SuppressWarnings("unchecked")
    void enablesOnlyTheFirstMaxAccountsAndStoresEachHandleOnce() throws Exception {
        InstagramProperties props = mock(InstagramProperties.class);
        when(props.seedSources()).thenReturn(true);
        when(props.maxAccounts()).thenReturn(2);
        InstagramSourceRepository sources = mock(InstagramSourceRepository.class);
        when(sources.count()).thenReturn(0L);

        new InstagramSourceSeeder(props, sources).run(null);

        ArgumentCaptor<List<InstagramSource>> saved = ArgumentCaptor.forClass(List.class);
        verify(sources).saveAll(saved.capture());
        List<InstagramSource> rows = saved.getValue();

        assertThat(rows).hasSizeGreaterThan(2);
        assertThat(rows).filteredOn(s -> Boolean.TRUE.equals(s.getEnabled())).hasSize(2);
        assertThat(rows).extracting(InstagramSource::getHandle).doesNotHaveDuplicates();
    }

    @Test
    void doesNothingWhenAccountsAreAlreadyStored() throws Exception {
        InstagramProperties props = mock(InstagramProperties.class);
        when(props.seedSources()).thenReturn(true);
        InstagramSourceRepository sources = mock(InstagramSourceRepository.class);
        when(sources.count()).thenReturn(5L);

        new InstagramSourceSeeder(props, sources).run(null);

        verify(sources, never()).saveAll(any());
    }
}
