export default function CreateEventPage() {
  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Event Title */}
        <section className="rounded-2xl border-2 border-indigo-500 bg-white p-6 shadow-sm transition-all">
          <div className="flex items-start justify-between gap-4">
            <div className="w-full">
              <input
                type="text"
                placeholder="Event Title"
                className="w-full border-none bg-transparent text-3xl font-bold text-slate-900 outline-none placeholder:text-slate-900"
              />

              <textarea
                placeholder="A short and sweet sentence about your event."
                rows={2}
                className="mt-4 w-full resize-none border-none bg-transparent text-base text-slate-600 outline-none placeholder:text-slate-500"
              />
            </div>

            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-2xl font-semibold text-indigo-600 transition hover:bg-indigo-100">
              +
            </button>
          </div>
        </section>

        {/* Date + Location */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
              {/* Date & Time */}
              <div className="border-b border-slate-200 pb-6 md:border-b-0 md:border-r md:pb-0 md:pr-8">
                <h2 className="text-3xl font-bold text-slate-900">
                  Date and time
                </h2>

                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Start Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h2 className="text-3xl font-bold text-slate-900">
                  Location
                </h2>

                <div className="mt-6 space-y-4">
                  <input
                    type="text"
                    placeholder="Enter a location"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500"
                  />

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    {/* Replace YOUR_API_KEY with your Google Maps Embed API key */}
                    <iframe
                      title="Google Maps"
                      src="https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=Montreal"
                      width="100%"
                      height="320"
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      className="border-0"
                    />
                  </div>

                  <p className="text-sm text-slate-500">
                    Search for a venue or paste an address to help attendees
                    find your event.
                  </p>
                </div>
              </div>
            </div>

            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-2xl font-semibold text-indigo-600 transition hover:bg-indigo-100">
              +
            </button>
          </div>
        </section>

        {/* Event Photos */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="w-full">
              <h2 className="text-3xl font-bold text-slate-900">
                Event Photos
              </h2>

              <p className="mt-3 text-slate-600">
                Upload photos or banners to make your event stand out.
              </p>

              <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-indigo-400">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="mx-auto block text-sm text-slate-600"
                />

                <p className="mt-4 text-sm text-slate-500">
                  PNG, JPG, WEBP up to 10MB
                </p>
              </div>
            </div>

            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-2xl font-semibold text-indigo-600 transition hover:bg-indigo-100">
              +
            </button>
          </div>
        </section>

        {/* Overview */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="w-full">
              <h2 className="text-3xl font-bold text-slate-900">
                Overview
              </h2>

              <p className="mt-3 text-slate-600">
                Provide more details about your event, venue, schedule,
                accessibility, speakers, or anything attendees should know.
              </p>

              <textarea
                rows={8}
                placeholder="Write your event overview here..."
                className="mt-6 w-full rounded-2xl border border-slate-300 p-4 outline-none transition focus:border-indigo-500"
              />
            </div>

            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-2xl font-semibold text-indigo-600 transition hover:bg-indigo-100">
              +
            </button>
          </div>
        </section>

        {/* Good To Know */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="w-full">
              <h2 className="text-3xl font-bold text-slate-900">
                Good to know
              </h2>

              {/* Tags */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-slate-800">
                  Highlights
                </h3>

                <div className="mt-4 flex flex-wrap gap-3">
                  {[
                    'Add Age Info',
                    'Add Door Time',
                    'Add Parking Info',
                    'Add Dress Code',
                    'Add Accessibility Info',
                  ].map((item) => (
                    <button
                      key={item}
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-500 hover:text-indigo-600"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div className="mt-10">
                <h3 className="text-lg font-semibold text-slate-800">
                  Frequently asked questions
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Add FAQs to help attendees understand your event better.
                </p>

                <div className="mt-6 space-y-4">
                  <input
                    type="text"
                    placeholder="Question"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500"
                  />

                  <textarea
                    rows={3}
                    placeholder="Answer"
                    className="w-full rounded-xl border border-slate-300 p-4 outline-none transition focus:border-indigo-500"
                  />
                </div>

                <button className="mt-5 text-sm font-medium text-indigo-600 transition hover:text-indigo-700">
                  + Add another question
                </button>
              </div>
            </div>

            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-2xl font-semibold text-indigo-600 transition hover:bg-indigo-100">
              +
            </button>
          </div>
        </section>

        {/* Save Button */}
        <div className="sticky bottom-0 z-20 flex justify-end bg-gradient-to-t from-[#f6f7fb] via-[#f6f7fb] to-transparent py-4">
          <button className="w-full rounded-2xl bg-orange-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-orange-700 md:w-auto">
            Save and continue
          </button>
        </div>
      </div>
    </div>
  )
}
