const ASCII_UNSAFE_REGEX = /[^\w.-]/gu;

const RFC_5987_RESERVED_REGEX = /['()*]/gu;

// `filename*` carries the real name; the quoted fallback is for clients that ignore it.
export function contentDisposition(
  type: "inline" | "attachment",
  fileName: string
) {
  const fallback = fileName.replaceAll(ASCII_UNSAFE_REGEX, "_");

  const encoded = encodeURIComponent(fileName).replaceAll(
    RFC_5987_RESERVED_REGEX,
    (char) => `%${char.codePointAt(0)?.toString(16).toUpperCase()}`
  );

  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
