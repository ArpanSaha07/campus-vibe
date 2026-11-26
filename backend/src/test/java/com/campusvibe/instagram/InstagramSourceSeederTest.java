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
    void enablesEveryAccountAndStoresEachHandleOnce() throws Exception {
        // How many a run checks is the admin's account count, not a flag on the row.
        InstagramProperties props = mock(InstagramProperties.class);
        when(props.seedSources()).thenReturn(true);
        InstagramSourceRepository sources = mock(InstagramSourceRepository.class);
        when(sources.count()).thenReturn(0L);

        new InstagramSourceSeeder(props, sources).run(null);

        ArgumentCaptor<List<InstagramSource>> saved = ArgumentCaptor.forClass(List.class);
        verify(sources).saveAll(saved.capture());
        List<InstagramSource> rows = saved.getValue();

        assertThat(rows).hasSizeGreaterThan(2);
        assertThat(rows).allMatch(s -> Boolean.TRUE.equals(s.getEnabled()));
        assertThat(rows).extracting(InstagramSource::getHandle).doesNotHaveDuplicates();
    }

    @Test
    void onAStoredListOnlyRestoresRowsTheOldCapSwitchedOff() throws Exception {
        InstagramProperties props = mock(InstagramProperties.class);
        when(props.seedSources()).thenReturn(true);
        InstagramSourceRepository sources = mock(InstagramSourceRepository.class);
        when(sources.count()).thenReturn(5L);

        new InstagramSourceSeeder(props, sources).run(null);

        verify(sources, never()).saveAll(any());
        verify(sources).enableUnclaimedDisabled();
    }
}
