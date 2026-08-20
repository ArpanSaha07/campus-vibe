"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEvent } from "@/app/lib/event";
import { parseApiError } from "@/app/lib/auth-errors";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import InterestPicker from "@/app/components/profile/edit/InterestPicker";
import EventFormatPicker from "@/app/components/event/EventFormatPicker";
import FormField, { inputClasses, selectClasses } from "@/app/components/ui/FormField";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";

const MAX_TAGS = 8;

/**
 * Creating an event.
 *
 * <strong>This replaces 237 lines that could not create anything.</strong> The
 * previous version was uncontrolled inputs with no state and no submit handler
 * — a form in appearance only — alongside a Google Maps embed carrying a
 * literal `YOUR_API_KEY`. None of it was reachable by a backend, so none of it
 * is kept.
 *
 * Authorisation here is club-scoped rather than role-based: the backend checks
 * `canManageClub(organizerId)`, so the club select offers only clubs this user
 * actually manages. That is also why there is no free-text organiser field —
 * one would only produce 403s.
 */
export default function CreateEventForm() {
  const router = useRouter();
  const { clubs, ready } = useManagedClubs();

  const [organizerId, setOrganizerId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // The one club case is the common one, so it is chosen rather than asked.
  const club = organizerId || (clubs.length === 1 ? clubs[0].clubId : "");
  const canSubmit = Boolean(club && title.trim() && dateTime) && !submitting;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    try {
      const created = await createEvent({
        organizerId: club,
        title: title.trim(),
        description,
        // `datetime-local` yields `2026-09-01T18:00` with no zone. Interpreted
        // as local time, which is what somebody typing it into a form means,
        // and sent as an instant so the backend never has to guess.
        dateTime: new Date(dateTime).toISOString(),
        location,
        price,
        capacity: capacity.trim() ? Number(capacity) : null,
        topics,
        formats,
      });
      router.push(`/events/${created.eventId}`);
    } catch (err) {
      setError(parseApiError(err, "That didn't save. Try again in a moment."));
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-10 font-mono text-sm text-ink-600">
        Loading your clubs…
      </p>
    );
  }

  // Said up front rather than as a refusal after the form is filled in: without
  // a club to put it on, an event has nowhere to go.
  if (clubs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="You don't run a club yet"
          body="Events belong to a club, so you'll need to be running one before you can put an event on. Ask an administrator to add you to yours."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8 fade-up">
      <h1 className="font-display text-4xl font-bold text-ink-900">Create an event</h1>
      <p className="mt-1 text-ink-600">
        Everything except the title, the club and the date can be filled in later.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <FormField label="Club" htmlFor="organizerId" hint="Only clubs you run are listed.">
          <select
            id="organizerId"
            value={club}
            onChange={(event) => setOrganizerId(event.target.value)}
            className={selectClasses}
          >
            <option value="">Select a club</option>
            {clubs.map((managed) => (
              <option key={managed.clubId} value={managed.clubId}>
                {managed.clubName}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Title" htmlFor="title">
          <input
            id="title"
            type="text"
            value={title}
            maxLength={140}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Intro to Robotics Workshop"
            className={inputClasses}
          />
        </FormField>

        <FormField label="Description" htmlFor="description">
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What happens, who it is for, what to bring."
            className={`${inputClasses} resize-y`}
          />
        </FormField>

        <FormField label="Date and time" htmlFor="dateTime">
          <input
            id="dateTime"
            type="datetime-local"
            value={dateTime}
            onChange={(event) => setDateTime(event.target.value)}
            className={inputClasses}
          />
        </FormField>

        <FormField label="Location" htmlFor="location">
          <input
            id="location"
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Trottier 1080"
            className={inputClasses}
          />
        </FormField>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField label="Price" htmlFor="price" hint="Leave empty if it is free.">
            <input
              id="price"
              type="text"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="$5"
              className={inputClasses}
            />
          </FormField>

          <FormField label="Capacity" htmlFor="capacity" hint="Leave empty for no limit.">
            <input
              id="capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              className={inputClasses}
            />
          </FormField>
        </div>

        {/* Two axes, and no category. Format says what kind of thing this is,
            topics say what it is about, and the topics are the same vocabulary
            students pick their interests from -- which is what will let this
            event reach them without any mapping. See decisions D2 and D3. */}
        <section className="border-t border-mist-200 pt-6">
          <h2 className="font-display text-xl font-bold text-ink-900">What kind of event?</h2>
          <p className="mt-1 text-sm text-ink-600">
            Pick up to {MAX_TAGS}. This is the shape of it, not the subject.
          </p>
          <div className="mt-4">
            <EventFormatPicker selected={formats} onChange={setFormats} max={MAX_TAGS} />
          </div>
        </section>

        <section className="border-t border-mist-200 pt-6">
          <InterestPicker
            selected={topics}
            onChange={setTopics}
            title="What is it about?"
            description={`Pick up to ${MAX_TAGS}. Students who share these interests will find it.`}
            max={MAX_TAGS}
          />
        </section>

        <div className="flex flex-wrap items-center gap-4 border-t border-mist-200 pt-6">
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? "Creating…" : "Create event"}
          </Button>
          {/* One live region, so a failure never sits under a stale success. */}
          <p aria-live="polite" className="text-sm">
            {error && <span className="font-semibold text-alert-600">{error}</span>}
            {!error && !canSubmit && !submitting && (
              <span className="text-ink-600">A club, a title and a date are needed.</span>
            )}
          </p>
        </div>

        {/* Banner images are deliberately not here. Unlike a club, the creator
            *can* upload to an event they just made -- canManageEvent resolves
            through the club they already manage -- so this is a gap worth
            filling rather than a thing that cannot work. Queued in todo.md. */}
      </form>
    </div>
  );
}
