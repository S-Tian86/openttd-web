import { useEffect, useState } from 'preact/hooks';
import type { UiSession, UiSnapshot } from './session';

export function useSnapshot(session: UiSession): UiSnapshot {
  const [snapshot, setSnapshot] = useState(session.getSnapshot());
  useEffect(() => session.subscribe(() => setSnapshot(session.getSnapshot())), [session]);
  return snapshot;
}
