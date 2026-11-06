export type DeletionArtifact = { ledger: Record<string, unknown>; hash: string; key_id?: string; signature?: string };
export function signDeletionLedger(artifact: DeletionArtifact, key: string | undefined, keyId?: string): DeletionArtifact;
export function verifyDeletionLedger(artifact: DeletionArtifact, keys: Record<string, string>): DeletionArtifact;
export function resolveExecutedReceipts(artifacts: DeletionArtifact[]): DeletionArtifact[];
