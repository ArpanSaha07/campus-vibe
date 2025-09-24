-- Events
CREATE TABLE IF NOT EXISTS events (
	id BIGSERIAL PRIMARY KEY,
-- Events
+CREATE TABLE IF NOT EXISTS events (
+    id BIGSERIAL PRIMARY KEY,
+    title TEXT NOT NULL,
+    description TEXT,
+    date_time TIMESTAMPTZ NOT NULL,
+    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+    location TEXT,
+    price TEXT,
+    organizer_id TEXT NOT NULL,
+    followers INT NOT NULL DEFAULT 0,
+    images TEXT[] NOT NULL DEFAULT '{}',
+    promoted BOOLEAN NOT NULL DEFAULT FALSE,
+    capacity INT,
+    registered INT NOT NULL DEFAULT 0,
+    CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id)
+        REFERENCES clubs(id)
+        ON UPDATE CASCADE
+        ON DELETE CASCADE
+);

-- Event categories (normalized)
+
+-- Event categories (normalized)
+CREATE TABLE IF NOT EXISTS event_categories (
+    event_id BIGINT NOT NULL,
+    category TEXT NOT NULL,
+    PRIMARY KEY (event_id, category),
+    CONSTRAINT fk_event_categories_event FOREIGN KEY (event_id)
+        REFERENCES events(id)
+        ON UPDATE CASCADE

-- Event images (one-to-many)
CREATE TABLE IF NOT EXISTS event_images (
	event_id BIGINT NOT NULL,
	url TEXT NOT NULL,
	PRIMARY KEY (event_id, url),
	CONSTRAINT fk_event_images_event FOREIGN KEY (event_id)
		REFERENCES events(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE
);
+        ON DELETE CASCADE
+);
