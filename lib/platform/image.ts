import sharp from "sharp";
export async function validateBrandImage(
  bytes: Uint8Array,
  kind: "logo" | "favicon",
) {
  const limit = kind === "favicon" ? 524288 : 1048576;
  if (bytes.length < 45 || bytes.length > limit) throw Error("INVALID_IMAGE");
  const buffer = Buffer.from(bytes);
  if (!buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
    throw Error("INVALID_IMAGE");
  try {
    const decoder = sharp(buffer, {
      limitInputPixels: 16777216,
      failOn: "warning",
    });
    const meta = await decoder.metadata();
    if (
      meta.format !== "png" ||
      !meta.width ||
      !meta.height ||
      meta.width > 4096 ||
      meta.height > 4096 ||
      (meta.pages ?? 1) > 1
    )
      throw Error();
    if (
      kind === "favicon" &&
      (meta.width !== meta.height || meta.width < 192 || meta.width > 1024)
    )
      throw Error();
    const output = await decoder
      .rotate()
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });
    if (output.data.length > limit) throw Error();
    return {
      png: output.data.toString("base64"),
      width: output.info.width,
      height: output.info.height,
    };
  } catch {
    throw Error("INVALID_IMAGE");
  }
}
