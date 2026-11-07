import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';

/** Hugeicons (free set), sized for the UI and stroked to match the type weight. */
export function Icon({ icon, size = 18, className }: { icon: IconSvgElement; size?: number; className?: string }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.7} className={className} aria-hidden="true" />;
}
