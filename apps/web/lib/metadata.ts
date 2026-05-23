export interface JarMetadata {
  version: 1;
  title: string;
  description: string;
  coverUrl: string | null;
  disableContributors: boolean;
}

export function buildJarMetadata(
  input: Omit<JarMetadata, "version">,
): JarMetadata {
  return { version: 1, ...input };
}

export function canonicalize(meta: JarMetadata): string {
  const ordered: JarMetadata = {
    version: meta.version,
    title: meta.title,
    description: meta.description,
    coverUrl: meta.coverUrl,
    disableContributors: meta.disableContributors,
  };
  return JSON.stringify(ordered);
}

export async function hashMetadata(meta: JarMetadata): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(canonicalize(meta));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}
