package com.campusvibe.search;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class OpenAiEmbeddingService implements EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingService.class);

    private final String apiKey;
    private final String model;
    private final RestClient restClient;

    public OpenAiEmbeddingService(@Value("${openai.api-key:}") String apiKey,
                                  @Value("${openai.embedding-model:text-embedding-3-small}") String model,
                                  @Value("${openai.base-url:https://api.openai.com}") String baseUrl) {
        this.apiKey = apiKey;
        this.model = model;
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .build();
    }

    @Override
    public boolean isEnabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public Optional<float[]> embed(String text) {
        if (!isEnabled() || text == null || text.isBlank()) {
            return Optional.empty();
        }
        try {
            EmbeddingResponse response = restClient.post()
                    .uri("/v1/embeddings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model", model, "input", text))
                    .retrieve()
                    .body(EmbeddingResponse.class);
            if (response == null || response.data() == null || response.data().isEmpty()) {
                return Optional.empty();
            }
            List<Double> values = response.data().get(0).embedding();
            float[] embedding = new float[values.size()];
            for (int i = 0; i < values.size(); i++) {
                embedding[i] = values.get(i).floatValue();
            }
            return Optional.of(embedding);
        } catch (Exception e) {
            log.warn("Embedding request failed; falling back to keyword-only search: {}", e.getMessage());
            return Optional.empty();
        }
    }

    record EmbeddingResponse(List<Data> data) {
        record Data(List<Double> embedding) {}
    }
}
