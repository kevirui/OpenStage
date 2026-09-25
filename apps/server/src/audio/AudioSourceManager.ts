import { AudioSource } from '@openstage/shared';

export class AudioSourceManager {
  validateSource(source: AudioSource): boolean {
    if (source.type === 'file' && !source.path) {
      return false;
    }
    if (source.type === 'stream' && !source.url) {
      return false;
    }
    return true;
  }
}
