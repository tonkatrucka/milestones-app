import { randomFileId } from './random-id';

export function opaqueMediaPath(childId: string, prefix: string, ext = 'jpg'): string {
  // First segment must be the child UUID so storage RLS can authorize the write
  // even if upload metadata is dropped by the React Native client.
  return `${childId}/${prefix}/${randomFileId()}.${ext}`;
}
