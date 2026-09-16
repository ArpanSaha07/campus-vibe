"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Star, Trash2, Upload } from "lucide-react";
import {
  MAX_EVENT_PHOTOS,
  createEvent,
  deleteEventImage,
  setEventBanner,
  updateEvent,
  uploadEventImages,
  type EventFields,
} from "@/app/lib/event";
import { toEventInstance } from "@/app/lib/adapters";
import { parseApiError } from "@/app/lib/auth-errors";
import { revalidateEvents } from "@/app/lib/actions/revalidate";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "@/app/lib/validators/clubValidator";
import { readPreview } from "@/app/lib/image-preview";
import type { ApiEvent } from "@/app/types";
import InterestPicker from "@/app/components/profile/edit/InterestPicker";
import EventFormatPicker from "@/app/components/event/EventFormatPicker";
import FormField, { inputClasses, selectClasses } from "@/app/components/ui/FormField";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";

const MAX_TAGS = 8;

/**
 * An instant as a `datetime-local` value (`2026-09-01T18:00`), in the browser's
 * own zone — the inverse of `new Date(value)` on submit, so an untouched date
 * saves back unchanged.
 */
export function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/**
 * One photo in the picker: the image, a Banner badge on the first, and the two
 * actions. Shared by stored photos and new picks so both read the same way.
 */
function PhotoTile({
  src,
  index,
  isBanner,
  busy,
  onMakeBanner,
  onRemove,
}: {
  src: string;
  index: number;
  isBanner: boolean;
  busy: boolean;
  onMakeBanner?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-mist-200 bg-white">
      <div className="relative h-28 w-full bg-mist-100">
        <Image src={src} alt={`Event photo ${index + 1}`} fill sizes="200px" className="object-cover" />
        {isBanner && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-lavender-600 px-2 py-0.5 text-xs font-semibold text-white">
            <Star className="h-3 w-3" aria-hidden="true" />
            Banner
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        {!isBanner && onMakeBanner ? (
          <button
            type="button"
            onClick={onMakeBanner}
            disabled={busy}
            className="rounded-full px-2 py-1 text-xs font-semibold text-lavender-600 transition-colors hover:bg-lavender-50 disabled:opacity-50"
          >
            Make banner
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove photo ${index + 1}`}
          className="rounded-full p-1.5 text-alert-600 transition-colors hover:bg-alert-600/10 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Creating an event, and editing one (CEM-10, CEM-16).
 *
 * <strong>One form for both</strong>, so the fields cannot drift apart. In edit
 * mode the club is shown rather than chosen — an event cannot move clubs
 * (D-10) — and every field is prefilled from the raw `ApiEvent`, never the
 * adapted `EventInstance`, whose display values ("Location TBA", "Free", 0)
 * would be saved back as real ones.
 *
 * <strong>Photos: up to ten per event, and the first is the banner.</strong>
 * Arpan, 2026-09-15: the club picks its banner and it shows on the event page
 * at once, stored as the photo's position rather than a column. So choosing a
 * banner is a reorder. On an event that already has photos, Make banner and
 * Remove act immediately against the server — they change stored objects, not
 * form fields. New picks are held until save; among them, Make banner just
 * reorders the queue, since upload order becomes stored order.
 *
 * Authorisation is club-scoped rather than role-based: the backend checks
 * `canManageClub(organizerId)` on create and `canManageEvent` on edit, so the
 * club select offers only clubs this user actually manages.
 */
export default function CreateEventForm({
  mode = "create",
  initial,
}: {
  mode?: "create" | "edit";
  /** Required in edit mode: the event as the API holds it. */
  initial?: ApiEvent;
}) {
  const editing = mode === "edit" && initial !== undefined;
  const router = useRouter();
  const { clubs, ready } = useManagedClubs();

  const [organizerId, setOrganizerId] = useState("");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dateTime, setDateTime] = useState(initial ? toDateTimeLocal(initial.dateTime) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [capacity, setCapacity] = useState(
    initial?.capacity != null ? String(initial.capacity) : "",
  );
  const [topics, setTopics] = useState<string[]>(initial?.topics ?? []);
  const [formats, setFormats] = useState<string[]>(initial?.formats ?? []);

  /** The event as last returned by the server — its stored photos live here. */
  const [stored, setStored] = useState<ApiEvent | undefined>(initial);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  /** Set when the event saved but its photos did not: the form must not create it twice. */
  const [savedWithoutPhotos, setSavedWithoutPhotos] = useState<string | null>(null);

  // The one club case is the common one, so it is chosen rather than asked.
  const club = editing
    ? initial.organizerId
    : organizerId || (clubs.length === 1 ? clubs[0].clubId : "");
  const canSubmit =
    Boolean(club && title.trim() && dateTime) &&
    !submitting &&
    !photoBusy &&
    savedWithoutPhotos === null;

  // Browser-fetchable URLs for the stored keys, through the adapter (BUG-042);
  // empty rather than the adapter's fallback when there are none.
  const storedPhotos =
    editing && stored && stored.images.length > 0 ? toEventInstance(stored).images : [];
  const room = MAX_EVENT_PHOTOS - storedPhotos.length - photos.length;

  async function pickPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    const accepted: File[] = [];
    let refusal = "";
    for (const file of picked.slice(0, Math.max(0, room))) {
      const check = validateImageFile(file);
      if (check.valid) accepted.push(file);
      else refusal = `${file.name}: ${check.error}`;
    }
    if (picked.length > room) {
      refusal = `An event can have up to ${MAX_EVENT_PHOTOS} photos.`;
    }
    setPhotoError(refusal);
    if (accepted.length === 0) return;
    const previews = await Promise.all(accepted.map(readPreview));
    setPhotos((prev) => [...prev, ...accepted]);
    setPhotoPreviews((prev) => [...prev, ...previews]);
  }

  function removePick(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  /** Moves a new pick to the front; it is uploaded first and so stored first. */
  function makePickBanner(index: number) {
    const front = <T,>(list: T[]) => [list[index], ...list.filter((_, i) => i !== index)];
    setPhotos(front);
    setPhotoPreviews(front);
  }

  /** Remove or re-banner a stored photo, now, and redraw from the server's answer. */
  async function changeStored(action: "banner" | "remove", index: number) {
    if (!stored) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const next =
        action === "banner"
          ? await setEventBanner(String(stored.id), index)
          : await deleteEventImage(String(stored.id), index);
      setStored(next);
    } catch (err) {
      setPhotoError(
        parseApiError(
          err,
          action === "banner" ? "The banner didn't change." : "That photo wasn't removed.",
        ),
      );
      return;
    } finally {
      setPhotoBusy(false);
    }
    try {
      await revalidateEvents();
    } catch {
      // The public pages catch up within five minutes.
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    const fields: EventFields = {
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
    };

    let eventId: string;
    try {
      const saved = editing
        ? await updateEvent(String(initial.id), fields)
        : await createEvent({ ...fields, organizerId: club });
      eventId = saved.eventId;
    } catch (err) {
      setError(parseApiError(err, "That didn't save. Try again in a moment."));
      setSubmitting(false);
      return;
    }

    let photosFailed = "";
    if (photos.length > 0) {
      try {
        await uploadEventImages(eventId, photos);
      } catch (err) {
        photosFailed = parseApiError(err, "The upload was refused.");
      }
    }

    // Past the writes, never inside their try (BUG-045), and caught on its own
    // (BUG-047): a failed revalidation is a stale list, not a failed save.
    try {
      await revalidateEvents();
    } catch {
      // The pages catch up within five minutes.
    }

    if (photosFailed) {
      setSubmitting(false);
      setSavedWithoutPhotos(eventId);
      setError(`The event saved, but the photos didn't upload. ${photosFailed}`);
      return;
    }
    router.push(`/events/${eventId}`);
  }

  if (!editing && !ready) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-10 font-mono text-sm text-ink-600">
        Loading your clubs…
      </p>
    );
  }

  // Said up front rather than as a refusal after the form is filled in: without
  // a club to put it on, an event has nowhere to go.
  if (!editing && clubs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="You don't run a club yet"
          body="Events belong to a club, so you'll need to be running one before you can put an event on. Ask an administrator to add you to yours."
        />
      </div>
    );
  }

  const totalPhotos = storedPhotos.length + photos.length;

  return (
    <div
      className={
        editing
          ? "w-full max-w-3xl fade-up"
          : "mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8 fade-up"
      }
    >
      <h1 className="font-display text-4xl font-bold text-ink-900">
        {editing ? "Edit event" : "Create an event"}
      </h1>
      <p className="mt-1 text-ink-600">
        {editing
          ? "Changes show on the event page as soon as you save."
          : "Everything except the title, the club and the date can be filled in later."}
      </p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-6">
        {editing ? (
          <FormField label="Club" htmlFor="organizerName" hint="An event stays with the club that created it.">
            <input
              id="organizerName"
              type="text"
              value={initial.organizerName}
              readOnly
              disabled
              className={inputClasses}
            />
          </FormField>
        ) : (
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
        )}

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
            className={`${inputClasses} resize-y rounded-xl`}
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

        <section className="border-t border-mist-200 pt-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-bold text-ink-900">Photos</h2>
            <span className="font-mono text-xs text-ink-600">
              {totalPhotos}/{MAX_EVENT_PHOTOS}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-600">
            Up to {MAX_EVENT_PHOTOS}. The banner is the big image at the top of the event page.
            {storedPhotos.length > 0 && " Changes to photos already here save straight away."}
          </p>

          {(storedPhotos.length > 0 || photos.length > 0) && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {storedPhotos.map((src, index) => (
                <PhotoTile
                  key={src}
                  src={src}
                  index={index}
                  isBanner={index === 0}
                  busy={photoBusy || submitting}
                  onMakeBanner={() => changeStored("banner", index)}
                  onRemove={() => changeStored("remove", index)}
                />
              ))}
              {photoPreviews.map((src, index) => (
                <div key={`new-${index}-${photos[index]?.name}`} className="relative">
                  <PhotoTile
                    src={src}
                    index={storedPhotos.length + index}
                    // A new pick is the banner only if nothing is stored yet.
                    isBanner={storedPhotos.length === 0 && index === 0}
                    busy={submitting}
                    onMakeBanner={
                      storedPhotos.length === 0 ? () => makePickBanner(index) : undefined
                    }
                    onRemove={() => removePick(index)}
                  />
                  <span className="absolute right-2 top-2 rounded-full bg-ink-900/70 px-2 py-0.5 text-xs font-semibold text-white">
                    New
                  </span>
                </div>
              ))}
            </div>
          )}

          {room > 0 && (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={submitting || photoBusy}
              className="mt-4 w-full rounded-2xl border-2 border-dashed border-mist-200 bg-mist-100 p-6 text-center transition-colors hover:border-lavender-300 hover:bg-lavender-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="mx-auto mb-2 h-6 w-6 text-lavender-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-ink-900">Add photos</p>
              <p className="ticket-label mt-1 text-ink-600">
                PNG, JPG OR WEBP · UP TO 5MB EACH · {room} LEFT
              </p>
            </button>
          )}
          <input
            ref={photoInputRef}
            id="photos"
            type="file"
            multiple
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            onChange={pickPhotos}
            disabled={submitting || photoBusy}
            className="sr-only"
            aria-label="Add photos"
          />
          {photoError && <p className="mt-2 text-sm text-alert-600">{photoError}</p>}
        </section>

        <div className="flex flex-wrap items-center gap-4 border-t border-mist-200 pt-6">
          {savedWithoutPhotos !== null ? (
            <Button href={`/events/${savedWithoutPhotos}`}>View event</Button>
          ) : (
            <Button type="submit" disabled={!canSubmit}>
              {submitting
                ? editing
                  ? "Saving…"
                  : "Creating…"
                : editing
                  ? "Save changes"
                  : "Create event"}
            </Button>
          )}
          {/* One live region, so a failure never sits under a stale success. */}
          <p aria-live="polite" className="text-sm">
            {error && <span className="font-semibold text-alert-600">{error}</span>}
            {!error && !canSubmit && !submitting && !photoBusy && (
              <span className="text-ink-600">A club, a title and a date are needed.</span>
            )}
          </p>
        </div>
      </form>
    </div>
  );
}
