export class InputError extends Error {}
export function object(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InputError("invalid_input");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !keys.includes(key)))
    throw new InputError("invalid_input");
  return data;
}
export function text(value: unknown, min = 1, max = 120): string {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new InputError("invalid_input");
  return value.trim();
}
export function email(value: unknown): string {
  const result = text(value, 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new InputError("invalid_input");
  return result;
}
export function password(value: unknown, min = 12): string {
  if (typeof value !== "string" || value.length < min || value.length > 128)
    throw new InputError("invalid_input");
  return value;
}
export function uuid(value: unknown): string {
  const result = text(value, 36, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      result,
    )
  )
    throw new InputError("invalid_input");
  return result;
}
export function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new InputError("invalid_input");
  return Number(value);
}
export function locale(value: unknown): "th" | "en" {
  if (value !== "th" && value !== "en") throw new InputError("invalid_input");
  return value;
}
export function confirmed(value: unknown): true {
  if (value !== true) throw new InputError("confirmation_required");
  return true;
}
