# LLM API Key Management & AI Architecture Guide

> ⚠ **Unverified against the code.** This is recommended architecture, not a description of the shipped `com.campusvibe.ai` package.
> It does not follow [`implementation-docs`](../../skills/implementation-docs/SKILL.md).

**Code as of:** never — not reconciled with the code.

## Purpose

This document describes the recommended architecture and security practices for managing LLM API keys (OpenAI, Anthropic, Gemini, etc.) in CampusVibe.

The goal is to:

- Never expose API keys to users
- Follow modern software industry best practices
- Build an AI architecture that scales as new AI features are added
- Make switching LLM providers straightforward in the future

---

# Guiding Principles

## 1. API Keys are Backend Secrets

**LLM API keys must never be exposed to the frontend.**

The browser is an untrusted environment. Any API key included in frontend code, JavaScript bundles, mobile apps, or browser requests can eventually be extracted.

### ❌ Never do this

- Store API keys in Next.js client code
- Store API keys in React components
- Commit API keys to GitHub
- Include API keys in cookies
- Include API keys in LocalStorage
- Send API keys to the browser
- Make requests directly from the frontend to OpenAI

Example (DO NOT DO):

```typescript
// ❌ NEVER DO THIS

const client = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY
});
```

Even if hidden, this key is publicly accessible.

---

## 2. All AI Requests Go Through the Backend

The frontend should only communicate with the backend.

Example flow:

```
User

↓

Next.js Frontend

↓

POST /api/ai/chat

↓

Spring Boot Backend

↓

OpenAI API

↓

Spring Boot

↓

Frontend
```

The browser never knows the API key.

---

# Local Development

During local development, API keys will be stored in a local `.env` file.

Example:

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

This file:

- should exist only locally
- should NEVER be committed to Git
- should be included in `.gitignore`

Example:

```
.env
.env.local
```

Spring Boot should read the environment variable using configuration.

Example:

```yaml
spring:
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
```

No API key should ever appear inside source code.

---

# Production Deployment

## Initial Deployment

CampusVibe will initially deploy using:

- Frontend → Vercel
- Backend → AWS Elastic Beanstalk

When deployed:

- the local `.env` file will no longer be used
- Elastic Beanstalk Environment Variables will provide the API key

Example:

```
Elastic Beanstalk

Environment Variables

OPENAI_API_KEY = sk-xxxxxxxx
```

Spring Boot continues reading:

```yaml
spring:
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
```

No application code changes are required.

---

# Future Improvement

As CampusVibe grows, migrate secrets from Elastic Beanstalk Environment Variables to AWS Secrets Manager.

Recommended future architecture:

```
Spring Boot

↓

IAM Role

↓

AWS Secrets Manager

↓

OpenAI API Key
```

Benefits:

- automatic rotation
- audit logs
- version history
- better access control
- improved security

This is not required initially but should be considered as the application grows.

---

# Backend Architecture

Avoid calling OpenAI directly from controllers.

## ❌ Bad

```
Controller

↓

OpenAI
```

Problems:

- duplicated logic
- duplicated prompts
- duplicated error handling
- difficult provider migration

---

## Recommended

```
Controller

↓

AI Service

↓

LLM Client

↓

OpenAI
```

Example:

```
Controller

↓

AIService

↓

PromptBuilder

↓

OpenAIClient

↓

OpenAI
```

Every AI feature should go through the same service layer.

---

# Suggested Project Structure

```
backend/

src/main/java/

config/
    OpenAIConfig.java

controller/
    AIController.java

service/
    AIService.java

service/llm/
    OpenAIClient.java
    PromptBuilder.java
    TokenEstimator.java
    AIRequestLogger.java

model/
    ai/

dto/
    ai/

exception/
```

---

# AIService Responsibilities

AIService should be responsible for:

- selecting prompts
- validating input
- calling the LLM client
- formatting responses
- retry logic
- timeout handling
- logging
- future caching

Controllers should contain minimal logic.

---

# OpenAI Client Responsibilities

OpenAIClient should encapsulate communication with the OpenAI API.

Responsibilities:

- authenticate requests
- send prompts
- deserialize responses
- retry transient failures
- handle rate limits
- centralize OpenAI-specific logic

No controller should know OpenAI implementation details.

---

# Prompt Management

Avoid embedding prompts throughout the codebase.

Bad:

```java
String prompt = "Summarize this event...";
```

Instead:

```
PromptBuilder

↓

EventSummaryPrompt

↓

RecommendationPrompt

↓

ModerationPrompt

↓

ChatPrompt
```

Benefits:

- reusable prompts
- easier maintenance
- easier testing
- consistent prompt style

---

# Future AI Features

CampusVibe is expected to expand AI functionality over time.

Potential features include:

- event summarization
- event description generation
- event recommendations
- personalized event discovery
- semantic event search
- semantic club search
- AI club assistant
- moderation
- schedule suggestions
- notification generation

All of these should use the same AI service layer.

---

# Future Multi-Provider Architecture

Design the system so additional LLM providers can be integrated without major refactoring.

Future architecture:

```
AIService

↓

LLMClient Interface

├── OpenAIClient

├── AnthropicClient

├── GeminiClient

└── LocalModelClient
```

Example interface:

```java
public interface LLMClient {

    AIResponse generate(AIRequest request);

}
```

The AIService depends only on the interface, not a specific provider.

Advantages:

- switch providers
- fallback providers
- A/B testing
- cost optimization
- easier experimentation

---

# Security Best Practices

## Never expose secrets

Never:

- log API keys
- return API keys in responses
- print API keys in stack traces

---

## Authenticate AI endpoints

Every AI endpoint should require authentication unless intentionally public.

Example:

```
POST /api/ai/chat

↓

JWT Authentication

↓

AIService
```

Unauthenticated users should not consume paid API usage.

---

## Authorization

Not every user should necessarily access every AI feature.

Future examples:

- premium AI features
- club-admin AI tools
- administrator moderation tools

Authorization should happen before AI requests are sent.

---

## Rate Limiting

AI endpoints are expensive.

Implement rate limiting.

Example:

- requests per minute
- requests per user
- requests per IP
- daily quotas (future)

Benefits:

- prevent abuse
- prevent accidental costs
- improve reliability

---

## Request Validation

Always validate:

- maximum prompt size
- supported file types
- input length
- required fields

Reject invalid requests before calling the LLM.

---

## Logging

Log:

- request ID
- endpoint
- response time
- token usage
- provider
- model

Avoid logging:

- API keys
- sensitive personal data
- raw prompts containing confidential information (unless explicitly needed and appropriately protected)

---

## Error Handling

Gracefully handle:

- timeouts
- rate limits
- provider outages
- invalid responses

Return user-friendly errors.

Do not expose provider internals.

---

# Configuration

Configuration should come from environment variables.

Example:

```yaml
spring:
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
```

Future variables may include:

```
OPENAI_API_KEY

OPENAI_MODEL

OPENAI_TIMEOUT

OPENAI_MAX_TOKENS

OPENAI_TEMPERATURE
```

These should remain configurable without code changes.

---

# Cost Management

AI APIs incur usage-based costs.

Future improvements may include:

- caching identical requests
- token budgeting
- request batching where appropriate
- model selection based on task complexity
- usage dashboards
- monitoring token consumption

---

# Recommended Architecture

```
Browser

↓

Next.js Frontend

↓

HTTPS

↓

Spring Boot REST API

↓

Authentication

↓

AI Controller

↓

AI Service

↓

Prompt Builder

↓

LLM Client

↓

OpenAI API
```

The frontend never communicates directly with OpenAI.

---

# Deployment Strategy

## Local Development

```
.env

↓

Spring Boot

↓

OpenAI
```

## Production

```
Elastic Beanstalk Environment Variables

↓

Spring Boot

↓

OpenAI
```

## Future

```
AWS Secrets Manager

↓

IAM Role

↓

Spring Boot

↓

LLM Provider
```

---

# Summary

CampusVibe will follow these principles:

- Store the OpenAI API key only on the backend.
- Use a local `.env` file during development.
- Exclude `.env` from version control.
- Store production secrets in AWS Elastic Beanstalk Environment Variables.
- Consider migrating to AWS Secrets Manager as the application scales.
- Route all AI requests through the Spring Boot backend.
- Build a centralized AI service layer to avoid duplicated logic.
- Encapsulate provider-specific functionality behind an `LLMClient` abstraction.
- Design the architecture to support multiple AI providers in the future.
- Protect AI endpoints with authentication, authorization, validation, and rate limiting.
- Log operational metrics while never exposing API keys or sensitive user data.
- Keep all AI configuration externalized through environment variables for flexibility across development and production environments.