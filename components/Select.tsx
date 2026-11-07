import * as RS from '@radix-ui/react-select';
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { usePortalContainer } from './portal';

export interface SelectOption {
  value: string;
  label: string;
  /** Secondary text shown at the end of the row (e.g. an English name). */
  hint?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
  /** Content before the value inside the trigger (e.g. an icon). */
  leading?: ReactNode;
  variant?: 'field' | 'pill';
}

/**
 * Inkmark select built on Radix Select (the primitive shadcn/ui uses): keyboard navigation,
 * typeahead, screen-reader semantics. Styled with Inkmark CSS, no Tailwind.
 */
export function Select({ value, onChange, options, id, disabled, leading, variant = 'field', ...rest }: Props) {
  const container = usePortalContainer();
  return (
    <RS.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RS.Trigger id={id} className={`ui-select ui-select--${variant}`} aria-label={rest['aria-label']}>
        {leading}
        <span className="ui-select__value">
          <RS.Value />
        </span>
        <RS.Icon className="ui-select__chevron">
          <Icon icon={ArrowDown01Icon} size={16} />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal container={container}>
        <RS.Content className="ui-menu" position="popper" sideOffset={6} collisionPadding={8}>
          <RS.Viewport className="ui-menu__viewport">
            {options.map((o) => (
              <RS.Item key={o.value} value={o.value} className="ui-menu__item">
                <RS.ItemText>{o.label}</RS.ItemText>
                {o.hint && <span className="ui-menu__hint">{o.hint}</span>}
                <RS.ItemIndicator className="ui-menu__check">
                  <Icon icon={Tick02Icon} size={16} />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
