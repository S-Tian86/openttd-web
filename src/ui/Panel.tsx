import type { ComponentChildren } from 'preact';

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
        <button type="button" aria-label={closeLabel} onClick={onClose}>
          ✕
        </button>
      </header>
      <div class="panel-body">{children}</div>
    </section>
  );
}
