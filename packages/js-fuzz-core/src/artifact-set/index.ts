import { createHash } from 'crypto';

export interface IArtifactSet<T> {
  /**
   * Stores the artifact in the set.
   */
  add(artifact: IArtifact<T>): Promise<void>;

  /**
   * Gets all inputs from the set.
   */
  all(): Promise<Readonly<{ [id: string]: IArtifact<T> }>>;
}

/**
 * Artifact stored in the IArtifactSet.
 */
export interface IArtifact<T> {
  /**
   * Artifact data.
   */
  data: Buffer;

  /**
   * Metadata specific to the artifact.
   */
  metadata: T;

  /**
   * Whether the file is user-generated.
   */
  userGenerated: boolean;
}

/**
 * Returns the ID of the given artifact or buffer.
 */
export const getArtifactId = (data: IArtifact<unknown> | Buffer) => {
  const hash = createHash('sha1');
  if (data instanceof Buffer) {
    hash.update(data);
  } else {
    hash.update(data.data);
  }

  return hash.digest('hex');
};
