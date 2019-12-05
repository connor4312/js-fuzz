import { IArtifactSet, IArtifact, getArtifactId } from '.';
import { injectable } from 'inversify';

@injectable()
export class MemoryArtifactSet<T> implements IArtifactSet<T> {
  private count = 0;
  private readonly data: { [id: string]: IArtifact<T> } = {};

  public add(artifact: IArtifact<T>) {
    const id = getArtifactId(artifact);
    if (this.data[id]) {
      return Promise.resolve(false);
    }

    this.data[id] = artifact;
    this.count++;
    return Promise.resolve(true);
  }

  public all() {
    return Promise.resolve(this.data);
  }

  public size() {
    return Promise.resolve(this.count);
  }
}
