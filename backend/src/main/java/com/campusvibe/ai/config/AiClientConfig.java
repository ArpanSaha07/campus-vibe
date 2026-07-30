package com.campusvibe.ai.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;

/**
 * Builds the shared HTTP client used for every OpenAI call.
 *
 * <p>This is the single place the API key is read. Feature services depend on
 * the client, never on the key, so rotation, timeouts and transport settings
 * are configured once rather than per feature.
 */
@Configuration
@EnableConfigurationProperties(OpenAiProperties.class)
public class AiClientConfig {

    private static final Logger log = LoggerFactory.getLogger(AiClientConfig.class);

    @Bean
    public RestClient openAiRestClient(OpenAiProperties properties) {
        if (properties.isConfigured()) {
            log.info("OpenAI configured (model={}, connectTimeout={}, readTimeout={}); semantic search enabled",
                    properties.embeddingModel(), properties.connectTimeout(), properties.readTimeout());
        } else {
            log.info("OPENAI_API_KEY is not set; search will run in keyword-only mode and no OpenAI calls will be made");
        }

        // Explicit timeouts: an unbounded default lets a hung provider call
        // occupy a request thread indefinitely.
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder()
                        .connectTimeout(properties.connectTimeout())
                        .build());
        requestFactory.setReadTimeout(properties.readTimeout());

        return RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey())
                .build();
    }
}
