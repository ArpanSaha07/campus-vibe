package com.campusvibe.instagram;

import com.campusvibe.event.Event;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/** Where an imported event links, and what its description says. */
class InstagramPublishServiceTest {

    private static InstagramSource source() {
        InstagramSource s = new InstagramSource();
        s.setHandle("dsignlabmcgill");
        return s;
    }

    @Test
    void aPostLinksToItselfForever() {
        InstagramStory post = new InstagramStory();
        post.setKind(InstagramStory.Kind.POST);
        post.setPermalink("https://www.instagram.com/p/Dew6xwqAR_K/");
        Event e = new Event();

        InstagramPublishService.applySourceLinks(e, source(), post);

        assertThat(e.currentSourceUrl()).isEqualTo("https://www.instagram.com/p/Dew6xwqAR_K/");
    }

    @Test
    void aStoryLinksToItselfUntilItExpiresThenToTheProfile() {
        InstagramStory story = new InstagramStory();
        story.setKind(InstagramStory.Kind.STORY);
        story.setPermalink("https://www.instagram.com/stories/dsignlabmcgill/1/");
        Event live = new Event();
        Event expired = new Event();

        story.setExpiresAt(Instant.now().plusSeconds(3600));
        InstagramPublishService.applySourceLinks(live, source(), story);
        story.setExpiresAt(Instant.now().minusSeconds(60));
        InstagramPublishService.applySourceLinks(expired, source(), story);

        assertThat(live.currentSourceUrl()).isEqualTo("https://www.instagram.com/stories/dsignlabmcgill/1/");
        assertThat(expired.currentSourceUrl()).isEqualTo("https://www.instagram.com/dsignlabmcgill/");
    }

    @Test
    void aStoryResharingAPostFallsBackToThatPost() {
        InstagramStory story = new InstagramStory();
        story.setKind(InstagramStory.Kind.STORY);
        story.setPermalink("https://www.instagram.com/stories/dsignlabmcgill/1/");
        story.setFeedPostUrl("https://www.instagram.com/p/DfdvbFZt33X/");
        story.setExpiresAt(Instant.now().minusSeconds(60));
        Event e = new Event();

        InstagramPublishService.applySourceLinks(e, source(), story);

        assertThat(e.currentSourceUrl()).isEqualTo("https://www.instagram.com/p/DfdvbFZt33X/");
    }

    @Test
    void theDescriptionSaysWhenTheTimeIsUnknown() {
        InstagramEventCandidate c = new InstagramEventCandidate();
        c.setDescription("Make natural dyes with MOC.");
        c.setStartTimeKnown(false);
        InstagramStory post = new InstagramStory();
        post.setKind(InstagramStory.Kind.POST);

        String text = InstagramPublishService.composeDescription(c, source(), post);

        assertThat(text).startsWith("Make natural dyes with MOC.")
                .contains("• Time not announced yet")
                .endsWith("From @dsignlabmcgill's Instagram post.");
    }

    @Test
    void theDescriptionLeadsWithTheSummaryAndListsTheFacts() {
        InstagramEventCandidate c = new InstagramEventCandidate();
        c.setSummary("Dye your own tote with plants.");
        c.setDescription("Second natural dye workshop with the Outdoors Club.");
        c.setAudience("All McGill students");
        c.setHighlights(new java.util.ArrayList<>(java.util.List.of("Materials provided", "Free")));
        c.setCollaborators(new java.util.ArrayList<>(java.util.List.of("@mcgilloutdoorsclub")));
        c.setStartTimeKnown(true);
        InstagramStory post = new InstagramStory();
        post.setKind(InstagramStory.Kind.POST);

        String text = InstagramPublishService.composeDescription(c, source(), post);

        assertThat(text).isEqualTo("""
                Dye your own tote with plants.

                Second natural dye workshop with the Outdoors Club.

                • For: All McGill students
                • Materials provided
                • Free
                • With @mcgilloutdoorsclub

                From @dsignlabmcgill's Instagram post.""");
    }

    @Test
    void clubsAreMatchedByTheirInstagramLink() {
        assertThat(InstagramPublishService.instagramHandleOf(
                "{\"instagram\":\"https://instagram.com/DsignLabMcGill\",\"email\":\"\"}")).isEqualTo("dsignlabmcgill");
        assertThat(InstagramPublishService.instagramHandleOf("{\"instagram\":\"\"}")).isNull();
    }
}
