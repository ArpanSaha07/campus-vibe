# Search — design note

> ⚠ **A design note, not an implementation doc.** Moved here from
> `.claude/search-implementation.md` on 2026-08-06. This is the *reasoning that
> led to* hybrid search — written in second person, before the code existed — and
> it has never been reconciled with what shipped. It does not follow
> [`implementation-docs`](../../skills/implementation-docs/SKILL.md).
>
> It is kept because it is genuinely useful: it is the only record of why
> embeddings-in-Postgres was chosen over the alternatives, and
> [BUG-006](../../bugs/bugs.md#bug-006) was found by comparing `EventService`
> against lines 150-177 of this file. Treat it as a rejected-alternatives
> archive, not as a description of current behaviour.
>
> The shipped implementation lives in
> `backend/src/main/java/com/campusvibe/search/` — `SearchRepository.java`
> carries the actual hybrid ranking formula. Note that
> [BUG-001](../../bugs/bugs.md#bug-001) means meaning-only matches currently
> return nothing, so the behaviour described below is **not** what the system
> does today. Rewriting this as a real implementation doc is tracked in
> [`todo.md`](../../TODO/todo.md).
>
> **`V8__search_embeddings.sql:1` still cites the old path
> `.claude/search-implementation.md` and always will.** Flyway checksums the
> whole file, so editing one comment in an applied migration causes
> `Migration checksum mismatch` on every existing database. The stale path is the
> cheaper of the two costs. See
> [`database-lifecycle/SKILL.md`](../../skills/database-lifecycle/SKILL.md).

---

For your CampusVibe app, you should **not fetch all events into the frontend and filter there**. Industry practice is to **query/search on the backend and return only matching results**.

The actual semantic search should happen server-side.

For your architecture (Next.js frontend + backend API + PostgreSQL), the flow would look like:

```text
User types:
"AI networking"

↓
Frontend sends request

GET /api/events/search?q=AI networking

↓
Backend receives query

↓
Search service computes similarity

↓
Database returns ranked results

↓
Frontend displays ranked events
```

For semantic search there are several approaches, ordered from simpler → more production-grade.


### Embeddings + PostgreSQL vector search


Instead of searching exact words, convert text into vector embeddings.

Example event:

```text
Title:
McGill AI Networking Night

Description:
Meet AI researchers and students.

Categories:
AI, Networking
```

Create a combined searchable string:

```text
"McGill AI Networking Night
Meet AI researchers and students
AI Networking"
```

Generate embedding:

```typescript
embedding = generateEmbedding(searchableText)
```

Store:

```typescript
Event {
   id
   title
   description
   organizer
   categories
   embedding
}
```

Then when user searches:

```text
"machine learning meetup"
```

Backend:

```typescript
queryEmbedding =
generateEmbedding("machine learning meetup")
```

Database:

```sql
SELECT *
FROM events
ORDER BY embedding <-> queryEmbedding
LIMIT 20;
```

The `<->` operator computes vector distance.

Results might become:

1. McGill AI Networking Night
2. AI Society Mixer
3. ML Research Seminar

even though the words do not exactly match.

---

For PostgreSQL, industry practice is usually:

```text
Frontend (Next.js)

↓

Backend API (NestJS)

↓

PostgreSQL + pgvector extension

↓

Embedding model
```

`pgvector` is commonly used because it keeps vectors directly in PostgreSQL.

You can use embeddings from:

* OpenAI embeddings API



---

Implementation steps:

**1. Add an embedding column**

```sql
ALTER TABLE events
ADD COLUMN embedding vector(1536);
```

---

**2. Generate embeddings when event is created**

Backend:

```typescript
const searchableText = `
${title}
${description}
${organizer}
${categories.join(" ")}
`;

const embedding =
await embeddingService.generate(searchableText);

save({
   ...eventData,
   embedding
});
```

Do this only when:

* event created
* title updated
* description updated
* category updated

---

**3. Search endpoint**

```typescript
GET /events/search?q=ai networking
```

Controller:

```typescript
@Get("/search")
async search(@Query("q") query: string) {
   return eventService.search(query);
}
```

---

**4. Similarity query**

```sql
SELECT *
FROM events
ORDER BY embedding <=> query_embedding
LIMIT 20;
```

---

**5. Frontend**

Use debounced search:

```typescript
const debouncedSearch = debounce(
   async (query) => {
      const results =
         await api.get(`/events/search?q=${query}`);

      setEvents(results.data);
   },
   300
);
```

This avoids hitting your API on every keystroke.

---

One more improvement used in production: **hybrid search**.

Pure semantic search sometimes returns strange results. Large systems combine:

```text
Final score =
0.7 × semantic similarity
+
0.3 × keyword match
```

So:

Search:

```text
AI hackathon
```

Semantic part understands meaning.

Keyword part boosts exact matches for:

* "AI"
* "hackathon"