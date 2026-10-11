import type { ComponentChildren } from 'preact';
import { IconButton } from './IconButton';

interface PanelProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function Panel({ title, closeLabel, onClose, children }: PanelProps) {
  return (
    <section class="panel" role="dialog" aria-label={title}>
      <header class="panel-header">
        <h2>{title}</h2>
        <IconButton label={closeLabel} onClick={onClose}>
          ✕
        </IconButton>
      </header>
      <div class="panel-body">{children}</div>
    </section>
  );
}
