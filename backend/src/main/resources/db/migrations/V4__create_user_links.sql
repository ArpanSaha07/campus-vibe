-- User saved events
+CREATE TABLE IF NOT EXISTS user_saved_events (
+    user_id BIGINT NOT NULL,
+    event_id BIGINT NOT NULL,
+    PRIMARY KEY (user_id, event_id),
+    CONSTRAINT fk_user_saved_events_user FOREIGN KEY (user_id)
+        REFERENCES users(id)
+        ON UPDATE CASCADE
+        ON DELETE CASCADE,
+    CONSTRAINT fk_user_saved_events_event FOREIGN KEY (event_id)
+        REFERENCES events(id)
+        ON UPDATE CASCADE
+        ON DELETE CASCADE
+);
+
+-- User followed clubs
+CREATE TABLE IF NOT EXISTS user_followed_clubs (
+    user_id BIGINT NOT NULL,
+    club_id TEXT NOT NULL,
+    PRIMARY KEY (user_id, club_id),
+    CONSTRAINT fk_user_followed_clubs_user FOREIGN KEY (user_id)
+        REFERENCES users(id)
+        ON UPDATE CASCADE
+        ON DELETE CASCADE,
+    CONSTRAINT fk_user_followed_clubs_club FOREIGN KEY (club_id)
+        REFERENCES clubs(id)
+        ON UPDATE CASCADE
+        ON DELETE CASCADE
+);
+
+-- User preferred categories
+CREATE TABLE IF NOT EXISTS user_preferred_categories (
+    user_id BIGINT NOT NULL,
+    category TEXT NOT NULL,
+    PRIMARY KEY (user_id, category),
+    CONSTRAINT fk_user_preferred_categories_user FOREIGN KEY (user_id)
+        REFERENCES users(id)
+        ON UPDATE CASCADE
+        ON DELETE CASCADE
+);
