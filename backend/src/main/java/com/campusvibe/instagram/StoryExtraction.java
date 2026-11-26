package com.campusvibe.instagram;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;

/**
 * What Claude returns for one story, as a structured output. The JSON schema
 * sent to the API is derived from these records, so the descriptions below are
 * part of the prompt.
 *
 * <p>Scalars are strings and use "" for unknown: a model asked for a nullable
 * number tends to invent one. Dates and times are local Montreal wall-clock
 * values; the backend turns them into instants, so the model never does time
 * zone arithmetic.
 */
public record StoryExtraction(
        @JsonPropertyDescription("All text visible in the image(s), transcribed exactly, top to bottom, image by image. Empty if none.")
        String ocrText,

        @JsonPropertyDescription("UPCOMING_EVENT: announces something students can attend at a specific date (in person or online) that has not happened yet. "
                + "EVENT_REMINDER: a reminder or countdown for an event (today, tomorrow, last chance). "
                + "PAST_EVENT: a recap, photos or thanks for an event that already happened. "
                + "NOT_EVENT: anything else (ads, memes, reposted posts without an event, giveaways without a date). "
                + "UNCERTAIN: might be an event but too unclear to tell.")
        Classification classification,

        @JsonPropertyDescription("Every distinct event announced. Empty unless classification is UPCOMING_EVENT, EVENT_REMINDER or UNCERTAIN.")
        List<ExtractedEvent> events
) {

    public enum Classification { UPCOMING_EVENT, EVENT_REMINDER, PAST_EVENT, NOT_EVENT, UNCERTAIN }

    public record ExtractedEvent(
            @JsonPropertyDescription("The event's name, ready to print on a card: as the organizers wrote it, properly capitalised (not ALL CAPS), no emoji, no dates, no 'join us'. If the poster has no name, write a short factual one, e.g. 'Natural Dye Workshop'.")
            String title,

            @JsonPropertyDescription("One sentence a student would read on the event card to decide whether to go. Factual, from the post only.")
            String summary,

            @JsonPropertyDescription("Everything useful a student would want before going, in 2-6 plain sentences, taken only from the image text and caption: what happens, who it is for, perks (food, prizes, free drinks), price tiers, dress code, collaborators, how to register or get tickets, deadlines. Keep the organizers' facts, drop hashtags and emoji. Never invent. Empty if there is nothing beyond the title.")
            String description,

            @JsonPropertyDescription("Short facts worth a bullet point, each under 80 characters: free food or drinks, prizes, price tiers, what to bring, dress code, language, accessibility, sign-up deadline, limited spots. Only what the post says. Empty list if none.")
            List<String> highlights,

            @JsonPropertyDescription("Who it is for, as stated or clearly implied, e.g. 'All McGill students', 'Engineering students', 'Beginners welcome', '18+'. Empty if not said.")
            String audience,

            @JsonPropertyDescription("Clubs or accounts co-hosting or collaborating, as @handles or names. Empty list if none.")
            List<String> collaborators,

            @JsonPropertyDescription("Start date as YYYY-MM-DD in Montreal local time. Use the story posting date to resolve weekdays, 'tomorrow' and missing years (choose the next occurrence on or after the posting date). Empty if no date is given.")
            String startDate,

            @JsonPropertyDescription("Start time as HH:mm, 24-hour, Montreal local time. Empty if no time is shown. Never guess.")
            String startTime,

            @JsonPropertyDescription("End date as YYYY-MM-DD, only if the story shows one or the event clearly ends on another day. Otherwise empty.")
            String endDate,

            @JsonPropertyDescription("End time as HH:mm, 24-hour, only if shown (e.g. '5:30 - 7 PM' gives 19:00). Otherwise empty.")
            String endTime,

            @JsonPropertyDescription("Venue and/or address exactly as shown, e.g. 'Gerts, Shatner Building' or 'Takumi Sushi, 405A Sherbrooke E'. Empty if not shown.")
            String location,

            @JsonPropertyDescription("Price as shown, e.g. '$15', '$10 members / $15 non-members'. 'Free' ONLY if the story says free. Empty if not mentioned.")
            String price,

            @JsonPropertyDescription("Maximum attendees as a whole number, only if explicitly stated. Otherwise empty.")
            String capacity,

            @JsonPropertyDescription("A registration or ticket URL if one is written in the image or given as a link sticker. Otherwise empty.")
            String registrationUrl,

            @JsonPropertyDescription("Who hosts the event if it is someone other than the posting account (e.g. a reposted event by another club), as their name. Empty if the posting account hosts it.")
            String hostedBy,

            @JsonPropertyDescription("The Instagram handle of the account hosting the event, without @, only when it is not the posting account and the handle is written somewhere you can see: the username on a reshared post's card, an @mention or tag sticker, the poster text, or the caption. Copy it exactly. Empty if the posting account hosts it or no handle is shown. Never guess a handle from a name.")
            String hostHandle,

            @JsonPropertyDescription("True if this story reposts or shares another account's event rather than announcing the posting account's own.")
            boolean repost,

            @JsonPropertyDescription("Topic slugs from the provided list only. Empty list if none fit. Never invent a slug.")
            List<String> topics,

            @JsonPropertyDescription("Event format slugs from the provided list only. Empty list if none fit. Never invent a slug.")
            List<String> formats,

            @JsonPropertyDescription("0 to 1: how sure you are that this is a real upcoming event AND that title, date and time are read correctly.")
            double confidence,

            @JsonPropertyDescription("Names of fields you are unsure about, from: title, startDate, startTime, endTime, location, price.")
            List<String> uncertainFields,

            @JsonPropertyDescription("Short notes a reviewer should know, e.g. 'year inferred', 'date partly hidden by sticker', 'cancelled'.")
            List<String> warnings
    ) {}
}
