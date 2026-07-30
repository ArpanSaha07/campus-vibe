---
name: llm-integration
description: Implement, modify, or review CampusVibe features that use OpenAI or another LLM provider. Use this skill when adding AI endpoints, LLM clients, prompt templates, AI configuration, API-key handling, rate limiting, or provider integrations.
---

# CampusVibe LLM Integration

Use this skill whenever implementing or reviewing an AI-powered feature in the CampusVibe Spring Boot backend.

## Primary Objective

Implement LLM functionality without exposing provider API keys, duplicating provider logic, or coupling controllers directly to OpenAI.

## Project Architecture

CampusVibe uses:

- Next.js frontend
- Spring Boot backend
- PostgreSQL
- OpenAI as the initial LLM provider
- Local `.env` configuration during development
- AWS Elastic Beanstalk environment properties in production

All LLM requests must follow this flow:

```text
Next.js frontend
    → Spring Boot controller
    → AI feature service
    → LLM client abstraction
    → OpenAI API
````

The frontend must never call OpenAI directly.

## Mandatory Security Rules

When implementing an LLM feature:

1. Never expose `OPENAI_API_KEY` to the frontend.
2. Never use a variable prefixed with `NEXT_PUBLIC_` for an LLM API key.
3. Never hardcode an API key in Java, TypeScript, YAML, tests, Dockerfiles, or scripts.
4. Never commit `.env` files.
5. Never log API keys or authorization headers.
6. Never return provider credentials in an API response.
7. Never accept an LLM provider API key from a normal frontend request.
8. Route paid LLM requests through authenticated backend endpoints.
9. Validate request size before calling the provider.
10. Add appropriate rate limiting to externally accessible AI endpoints.

If existing code violates these rules, stop and correct the violation before extending the feature.

## Local Secret Configuration

For local development, expect the key to be supplied through:

```env
OPENAI_API_KEY=replace-with-local-key
```

The `.env` file must be ignored by Git.

Ensure `.gitignore` includes:

```gitignore
.env
.env.*
!.env.example
```

Do not place a real secret in `.env.example`.

Use a placeholder:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
```

## Spring Boot Configuration

Read the key through an environment placeholder.

Example:

```yaml
spring:
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
```

For custom configuration, use configuration properties rather than reading environment variables directly throughout the application.

Example:

```yaml
campusvibe:
  ai:
    provider: openai
    openai:
      api-key: ${OPENAI_API_KEY}
      model: ${OPENAI_MODEL:gpt-4.1-mini}
      timeout: ${OPENAI_TIMEOUT:30s}
```

Prefer a typed configuration class:

```java
@ConfigurationProperties(prefix = "campusvibe.ai.openai")
public record OpenAiProperties(
        String apiKey,
        String model,
        Duration timeout
) {
}
```

Do not expose the configuration object through controllers or serialization.

## Production Configuration

For production deployment, assume `OPENAI_API_KEY` will be configured as an AWS Elastic Beanstalk environment property.

Application code must continue to read:

```text
OPENAI_API_KEY
```

Do not introduce production-specific hardcoded values.

The same application artifact should work in:

* local development
* tests
* staging
* production

Only external configuration should differ.

A later migration to AWS Secrets Manager may be implemented without changing AI feature code.

## Required Backend Design

Do not call OpenAI directly from controllers.

### Incorrect

```text
AIController
    → OpenAI SDK
```

### Required

```text
AIController
    → Feature-specific service
    → LlmClient
    → OpenAiLlmClient
```

## LLM Client Abstraction

Provider-specific communication must be behind an interface.

Example:

```java
public interface LlmClient {

    LlmResponse generate(LlmRequest request);
}
```

Initial implementation:

```java
@Component
public class OpenAiLlmClient implements LlmClient {

    @Override
    public LlmResponse generate(LlmRequest request) {
        // OpenAI-specific integration
    }
}
```

Business services must depend on `LlmClient`, not directly on an OpenAI SDK class.

This enables future implementations such as:

```text
AnthropicLlmClient
GeminiLlmClient
LocalModelLlmClient
```

Do not add multiple providers unless the requested feature requires them.

## Feature Service Design

Create feature-specific services rather than one oversized `AIService`.

Preferred examples:

```text
EventDescriptionGenerationService
EventSummaryService
EventRecommendationService
ContentModerationService
ScheduleSuggestionService
```

These services may share:

```text
LlmClient
PromptTemplateService
TokenUsageService
AiRequestPolicyService
```

A feature-specific service should:

1. Validate business input.
2. Check authorization.
3. Build the provider-neutral request.
4. Call `LlmClient`.
5. Validate or parse the provider response.
6. Return a domain-specific result.

## Controller Rules

Controllers should:

* receive DTOs
* apply request validation
* obtain the authenticated user
* call one application service
* map the result to a response DTO

Controllers should not:

* construct long prompts
* call OpenAI directly
* contain retry logic
* select models
* parse provider-specific response structures
* access API keys

## Prompt Management

Do not scatter prompt strings throughout controllers and services.

Store prompts in a dedicated package or resource directory.

Suggested structure:

```text
src/main/java/com/campusvibe/ai/
├── client/
│   ├── LlmClient.java
│   └── OpenAiLlmClient.java
├── config/
│   └── OpenAiProperties.java
├── model/
│   ├── LlmRequest.java
│   └── LlmResponse.java
├── prompt/
│   ├── PromptTemplateService.java
│   └── PromptVariables.java
└── feature/
    ├── summary/
    ├── recommendation/
    └── moderation/
```

Prompts may be stored as resource files:

```text
src/main/resources/prompts/
├── event-summary.txt
├── event-description.txt
└── moderation.txt
```

Keep prompt variables explicit and validate them before interpolation.

Never concatenate untrusted user input into system-level instructions without clear delimiters.

## Structured Responses

Prefer structured LLM output when the result will be processed by application code.

For example:

```json
{
  "summary": "Concise event summary",
  "categories": ["technology", "networking"],
  "confidence": 0.91
}
```

Map structured output into typed DTOs.

Validate:

* required fields
* maximum string lengths
* allowed enum values
* numeric ranges
* malformed JSON
* unexpected extra content

Do not trust LLM output merely because it resembles JSON.

## Error Handling

Handle provider errors centrally.

Account for:

* connection failures
* timeouts
* rate limits
* invalid credentials
* malformed responses
* provider outages
* content policy rejections
* token-limit errors

Translate provider-specific errors into application exceptions.

Do not return raw OpenAI error bodies to clients.

Example public error:

```json
{
  "code": "AI_SERVICE_UNAVAILABLE",
  "message": "The AI feature is temporarily unavailable."
}
```

Log the internal cause without logging secrets.

## Retries

Retry only transient failures, such as:

* selected HTTP 429 responses
* selected HTTP 5xx responses
* temporary network failures

Use:

* a small retry limit
* exponential backoff
* jitter where supported

Do not retry:

* invalid credentials
* invalid requests
* authorization failures
* content policy failures
* deterministic parsing errors without changing the request

Avoid nested retries across multiple layers.

## Timeouts

Every outbound LLM request must have a finite timeout.

Do not rely solely on library defaults.

Configure:

* connection timeout
* response timeout
* total request timeout where supported

Timeout values must be externally configurable.

## Authentication and Authorization

AI endpoints that consume paid provider resources should require authenticated users unless explicitly approved otherwise.

Apply role checks for restricted features.

Examples:

```text
Regular user:
- personalized recommendations
- schedule suggestions

Club admin:
- event description generation
- event summary generation

Platform admin:
- moderation assistance
```

Do not rely only on frontend UI restrictions.

## Rate Limiting and Quotas

Before releasing an AI endpoint publicly, implement an appropriate usage control.

Possible dimensions:

* per authenticated user
* per endpoint
* per IP for unauthenticated endpoints
* application-wide provider budget
* daily quota

Return HTTP `429 Too Many Requests` when the application limit is exceeded.

Rate limits must be enforced before the LLM provider request is sent.

## Privacy and Logging

Log operational metadata such as:

* internal request ID
* feature name
* provider
* model
* latency
* success or failure
* input and output token counts when available

Do not log by default:

* API keys
* authorization headers
* complete user prompts
* private user profile data
* generated content containing sensitive information

Use redaction where prompt logging is intentionally enabled.

## Cost Controls

For every new AI feature, consider:

* expected requests per user
* maximum input size
* maximum output size
* selected model
* caching opportunities
* whether an LLM is actually necessary
* whether embeddings or deterministic code are more appropriate

Use the smallest suitable model for the task.

Do not use an expensive reasoning model by default for simple classification, extraction, or formatting.

## Semantic Search Exception

Semantic search is not necessarily a generative LLM request.

For event and club search:

```text
User query
    → backend
    → embedding generation
    → vector database query
    → ranked results
```

Do not send the entire events database to the frontend for semantic filtering.

Perform embedding search and ranking on the backend or database layer.

Embedding credentials follow the same secret-handling rules as other provider keys.

## Testing Requirements

Add tests for:

* feature-service behavior
* input validation
* authorization
* rate-limit rejection
* provider timeout handling
* provider error translation
* malformed structured output
* successful response mapping

Mock `LlmClient` in unit tests.

Do not make real OpenAI API calls in normal unit or integration test suites.

Example:

```java
@Mock
private LlmClient llmClient;
```

Use a dedicated opt-in test profile for any real provider smoke test.

Never commit a test API key.

## Implementation Procedure

When asked to implement an AI feature:

1. Inspect the existing backend package structure and conventions.
2. Identify the user role permitted to use the feature.
3. Define the feature request and response DTOs.
4. Add input validation and size limits.
5. Create or reuse a feature-specific service.
6. Create or reuse the provider-neutral `LlmClient`.
7. Add or update the prompt template.
8. Configure timeouts and provider settings externally.
9. Add centralized provider error handling.
10. Add authentication, authorization, and rate limiting.
11. Add unit and integration tests using a mocked client.
12. Verify no secret is exposed or committed.
13. Document any new environment variables in `.env.example`.
14. Run the relevant backend tests and static checks.
15. Summarize changed files, security decisions, and remaining risks.

## Review Procedure

When reviewing existing AI code, check for:

* frontend exposure of API keys
* direct frontend-to-provider requests
* hardcoded secrets
* `.env` files tracked by Git
* direct SDK calls from controllers
* missing authentication
* missing authorization
* missing request-size limits
* missing rate limiting
* unlimited output tokens
* missing timeouts
* unsafe retries
* raw prompt logging
* provider-specific objects leaking into domain code
* unvalidated LLM output
* real provider calls in tests

Report critical security findings before stylistic improvements.

## Completion Criteria

An AI feature is complete only when:

* the API key remains backend-only
* configuration is externalized
* controllers do not call the provider directly
* provider code is encapsulated
* input is validated
* output is validated
* authentication and authorization are applied
* usage is limited appropriately
* errors are handled safely
* tests do not require a real API key
* `.env.example` documents required variables
* no secret appears in Git changes

```