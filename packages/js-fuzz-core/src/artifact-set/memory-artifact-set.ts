import { IArtifactSet, IArtifact, getArtifactId } from '.';

export class MemoryArtifactSet<T> implements IArtifactSet<T> {
  private readonly data: { [id: string]: IArtifact<T> } = {};

  public add(artifact: IArtifact<T>) {
    this.data[getArtifactId(artifact)] = artifact;
    return Promise.resolve();
  }

  public all() {
    return Promise.resolve(this.data);
  }
}
