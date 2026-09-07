---
description: Club, seed and taxonomy code — the assigned-id merge trap and the taxonomy contract
paths:
  - "backend/src/main/java/com/campusvibe/{club,seed,taxonomy}/**"
  - "backend/src/test/java/com/campusvibe/{club,taxonomy}/**"
---

# Clubs, seeding and taxonomy

- **`Club.id` is an assigned `String` slug** — `Club.java:20-21`, no
  `@GeneratedValue`, and `Club` does not implement `Persistable`. Spring Data's
  `isNew()` therefore answers false for a brand-new club, so `save` and
  `saveAndFlush` take the `em.merge()` branch and return a **different** managed
  instance. The object you passed in stays detached. (BUG-037, ADR-002)
- **Set every field before the write, then use only the returned instance.**
  `ClubService.java:51-73`. Tagging `club` after `saveAndFlush` writes to the
  detached copy and persists nothing — that is exactly what BUG-037 was.
- **`saveAndFlush`, never `save`.** `indexClub` writes the embedding through
  `JdbcTemplate`, which is not a JPA query: it triggers no flush and checks no
  update count, so it silently matches zero rows. (BUG-034)
- **`Event.id` is `IDENTITY`** (`Event.java:21-23`), so `EventService` takes the
  `persist()` branch. It reads almost identically and behaves oppositely — it is
  not evidence that this pattern is safe. (BUG-034)
- **`create(Club, String category, List<String> interests)`.** A null category
  and an empty interest list are legitimate; that is how pre-V23 clubs seed.
  `DevDataSeeder.java:68` is a caller and was missed once already. (BUG-036)
- **`MAX_CLUB_INTERESTS = 8` is load-bearing** (`ClubService.java:24`). An
  uncapped tag list matches every student and degrades everyone's results.
- **In `update`, clear and refill `interestSlugs` — never reassign it**
  (`ClubService.java:77-104`). Swapping the `PersistentSet` out makes Hibernate
  delete and reinsert every row. Re-index *after* the tags change, not before.
- **Three vocabularies, and events get no category at all** — ADR-001.
- **The `Persistable` fix is proposed in ADR-002 and not yet decided.** It
  changes the write path for every club, so it is never a rider on another fix.
