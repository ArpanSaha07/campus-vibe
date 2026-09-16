/**
 * Reads a picked file into a data URL, for showing the user what they chose
 * before it is uploaded.
 *
 * The same four lines had been written out at three call sites — the club
 * editor, the event form and the club-creation hook — which is what this
 * module exists to stop. Every preview in the app comes from here.
 *
 * It resolves and never rejects, which is the behaviour the call sites were
 * written against: a preview is cosmetic, and a form that has already accepted
 * the file through `validateImageFile` should not blow up because the browser
 * could not render a thumbnail of it.
 */
export function readPreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
