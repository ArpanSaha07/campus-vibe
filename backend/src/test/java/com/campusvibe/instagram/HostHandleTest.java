package com.campusvibe.instagram;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A reposted event goes to its host's club only when the host's handle is in
 * the story itself (Arpan, 2026-11-26). Cases from the 2026-11-26 local runs.
 */
class HostHandleTest {

    @Test
    void aHandleOnTheResharedCardIsTheHost() {
        // mcgillhacks shared The Factory's poster; the card shows the original username.
        assertThat(CandidateRules.verifiedHostHandle("@TheFactory_McGill", "The Factory", "mcgillhacks",
                List.of(), "thefactory_mcgill\nTHE FORGE\nSAVE THE DATE", null))
                .isEqualTo("thefactory_mcgill");
    }

    @Test
    void aMentionStickerIsEvidenceEnough() {
        assertThat(CandidateRules.verifiedHostHandle("bsps.mcgill", "BSPS Political Science", "witmcgill",
                List.of("bsps.mcgill"), "Black Perspectives", null))
                .isEqualTo("bsps.mcgill");
    }

    @Test
    void theCaptionCountsAndASentenceEndingDotIsNotPartOfTheHandle() {
        assertThat(CandidateRules.verifiedHostHandle("clemcgill", null, "cefmcgill",
                List.of(), "", "Organised by @clemcgill."))
                .isEqualTo("clemcgill");
    }

    @Test
    void aHandleTheStoryDoesNotShowIsRefused() {
        // Inferred from a name, or planted: either way it is not in the story.
        assertThat(CandidateRules.verifiedHostHandle("gdgmcgill", "GDG McGill", "mcgillhacks",
                List.of(), "Building AI Voice Agents", "Join us!"))
                .isNull();
    }

    @Test
    void aHandleInsideALongerOneIsNotAMatch() {
        assertThat(CandidateRules.verifiedHostHandle("mccup", null, "mcgillhacks",
                List.of(), "@mccup_mcgill presents", null))
                .isNull();
    }

    @Test
    void thePostingAccountIsNeverItsOwnHost() {
        assertThat(CandidateRules.verifiedHostHandle("witmcgill", null, "witmcgill",
                List.of("witmcgill"), "witmcgill", null))
                .isNull();
    }

    @Test
    void rowsFromBeforeTheFieldFallBackToTheHandleInHostedBy() {
        // Claude wrote "McCup (@mccup_mcgill)" before hostHandle existed.
        assertThat(CandidateRules.verifiedHostHandle(null, "McCup (@mccup_mcgill)", "mcgillhacks",
                List.of(), "mccup_mcgill\n12à3 McCup", null))
                .isEqualTo("mccup_mcgill");
        assertThat(CandidateRules.verifiedHostHandle(null, "Universities Allied for Essential Medicines",
                "witmcgill", List.of(), "UAEM", null))
                .isNull();
    }

    @Test
    void theHostsClubIsNamedWithoutItsHandle() {
        assertThat(InstagramPublishService.hostNameFrom("The Factory (@thefactory_mcgill)")).isEqualTo("The Factory");
        assertThat(InstagramPublishService.hostNameFrom("@clemcgill")).isNull();
        assertThat(InstagramPublishService.hostNameFrom(null)).isNull();
    }
}
