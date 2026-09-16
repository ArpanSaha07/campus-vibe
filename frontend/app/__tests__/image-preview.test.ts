import { readPreview } from "@/app/lib/image-preview";

/**
 * The one copy of the preview reader, now that the club editor, the event form
 * and the club-creation hook all import it instead of writing it out again.
 * jsdom supplies a real `FileReader`, so this exercises the actual promise
 * rather than a mock of it.
 */
describe("readPreview", () => {
  it("resolves to the file's contents as a data URL", async () => {
    const file = new File(["hello"], "logo.png", { type: "image/png" });

    const preview = await readPreview(file);

    expect(preview).toBe(`data:image/png;base64,${btoa("hello")}`);
  });

  it("reads each file independently, so a batch keeps its order", async () => {
    const files = ["a", "b", "c"].map(
      (body) => new File([body], `${body}.png`, { type: "image/png" }),
    );

    const previews = await Promise.all(files.map(readPreview));

    expect(previews).toEqual(["a", "b", "c"].map((b) => `data:image/png;base64,${btoa(b)}`));
  });
});
