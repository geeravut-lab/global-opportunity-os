import type { Client } from "pg";
export function purgeOne(transaction: <T>(work: (c: Client) => Promise<T>) => Promise<T>, config: { enabled: boolean; url: string; key?: string; local?: boolean }): Promise<{ configured: boolean; processed: boolean; blocked?: boolean; authentication?: string }>;
