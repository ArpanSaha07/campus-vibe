import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "@/app/lib/validators/clubValidator";

/**
 * The browser half of the upload rule. The server is the control -- it reads
 * the file's own leading bytes and refuses anything but PNG, JPEG and WebP
 * (`MediaKeys.java`, BUG-039) -- so this only exists to say so before a
 * multi-megabyte upload is sent and refused.
 */
function fileOf(type: string, size = 1024): File {
  const file = new File(["x"], "logo", { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateImageFile", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s", (type) => {
    expect(validateImageFile(fileOf(type))).toEqual({ valid: true });
  });

  it.each(["image/svg+xml", "image/gif", "image/heic", "image/bmp", "text/plain", ""])(
    "refuses %s with the server's own wording",
    (type) => {
      expect(validateImageFile(fileOf(type))).toEqual({
        valid: false,
        error: "Images must be PNG, JPEG or WebP",
      });
    }
  );

  it("refuses a file over 5MB, the backend's own cap", () => {
    const result = validateImageFile(fileOf("image/png", 5 * 1024 * 1024 + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/5MB/);
  });

  it("accepts a file of exactly 5MB", () => {
    expect(validateImageFile(fileOf("image/png", 5 * 1024 * 1024))).toEqual({ valid: true });
  });

  it("names exactly the three types the server accepts", () => {
    expect(ACCEPTED_IMAGE_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });
});
