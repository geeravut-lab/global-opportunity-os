export function authorized(
  header: string | null,
  secret: string | undefined,
): boolean;
export function failureReason(error: unknown): string;
export function maintain(env?: NodeJS.ProcessEnv): Promise<{
  inApp: number;
  email: number;
  cancelled: number;
  failed: number;
  clean: number;
  rejected: number;
  emailConfigured: boolean;
}>;
