package com.campusvibe.instagram;

import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * The SDK derives the structured-output JSON schema from {@link StoryExtraction}
 * and validates it locally when the request is built. A record shape the API
 * cannot take fails here, in CI, rather than on the first live import.
 */
class StoryExtractionSchemaTest {

    @Test
    void theExtractionRecordsMakeAValidStructuredOutputRequest() {
        assertThatCode(() -> {
            StructuredMessageCreateParams<StoryExtraction> params = MessageCreateParams.builder()
                    .model("claude-haiku-5-5")
                    .maxTokens(8000L)
                    .outputConfig(StoryExtraction.class)
                    .addUserMessage("schema check")
                    .build();
            assertThat(params).isNotNull();
        }).doesNotThrowAnyException();
    }
}
