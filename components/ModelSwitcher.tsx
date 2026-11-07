import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { ArrowDown01Icon, Search01Icon, Settings02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useTranslation } from 'react-i18next';
import { isProviderConnected, modelCacheItem, type ModelCache } from '@/lib/models';
import { getProviderConfig, PROVIDERS, settingsItem, type ProviderId, type Settings } from '@/lib/settings';
import { Icon } from './Icon';
import { usePortalContainer } from './portal';

/** Connected providers, plus the active one even if it is not fully set up yet. */
export function connectedProviders(settings: Settings, cache: ModelCache): ProviderId[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).filter(
    (id) => id === settings.provider || isProviderConnected(settings, id, cache),
  );
}

const shortLabel = (id: ProviderId) => PROVIDERS[id].label.replace(/ \(.*\)$/, '');
const SEP = '::';

/**
 * Model picker across every connected provider (Radix Popover + cmdk, the shadcn Combobox pattern):
 * searchable, grouped by provider, keyboard friendly. Picking a model of another provider switches
 * the provider too.
 */
export function ModelSwitcher({
  settings,
  disabled,
  onManage,
  defaultOpen = false,
}: {
  settings: Settings;
  disabled?: boolean;
  /** Opens Settings (shown as the last row of the menu). */
  onManage?: () => void;
  /** Start opened (previews). */
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation('common');
  const container = usePortalContainer();
  const [open, setOpen] = useState(defaultOpen);
  const [cache, setCache] = useState<ModelCache>({});

  useEffect(() => {
    void modelCacheItem.getValue().then(setCache);
    return modelCacheItem.watch((v) => setCache(v ?? {}));
  }, []);

  const current = getProviderConfig(settings);
  const groups = connectedProviders(settings, cache).map((id) => {
    const cfg = getProviderConfig(settings, id);
    const models = cache[id] ?? [];
    const options = !cfg.model || models.some((m) => m.id === cfg.model) ? models : [{ id: cfg.model }, ...models];
    return { id, options: options.filter((m) => m.id) };
  });

  const pick = (value: string) => {
    const i = value.indexOf(SEP);
    const id = value.slice(0, i) as ProviderId;
    const model = value.slice(i + SEP.length);
    setOpen(false);
    void settingsItem.setValue({
      ...settings,
      provider: id,
      providers: { ...settings.providers, [id]: { ...getProviderConfig(settings, id), model } },
    });
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="model-switch" disabled={disabled} title={t('model.switcherTitle')}>
        <span className="model-switch__provider">{shortLabel(settings.provider)}</span>
        <span className="model-switch__model">{current.model || '—'}</span>
        <Icon icon={ArrowDown01Icon} size={14} className="model-switch__chevron" />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content className="ui-menu ui-menu--command" align="start" sideOffset={6} collisionPadding={8}>
          <Command loop defaultValue={`${settings.provider}${SEP}${current.model}`}>
            <div className="ui-command__search">
              <Icon icon={Search01Icon} size={16} />
              <Command.Input placeholder={t('model.searchPlaceholder')} autoFocus />
            </div>
            <Command.List className="ui-menu__viewport">
              <Command.Empty className="ui-menu__empty">{t('model.noResults')}</Command.Empty>
              {groups.map((g) => (
                <Command.Group key={g.id} heading={PROVIDERS[g.id].label} className="ui-menu__group">
                  {g.options.map((m) => {
                    const value = `${g.id}${SEP}${m.id}`;
                    const selected = g.id === settings.provider && m.id === current.model;
                    return (
                      <Command.Item
                        key={value}
                        value={value}
                        keywords={[PROVIDERS[g.id].label, m.id, m.label ?? '']}
                        onSelect={pick}
                        className="ui-menu__item"
                        data-checked={selected || undefined}
                      >
                        <span className="ui-menu__label">{m.label ?? m.id}</span>
                        {m.label && m.label !== m.id && <span className="ui-menu__hint">{m.id}</span>}
                        {selected && (
                          <span className="ui-menu__check">
                            <Icon icon={Tick02Icon} size={16} />
                          </span>
                        )}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
              {onManage && (
                <Command.Item
                  value="__manage__"
                  onSelect={() => {
                    setOpen(false);
                    onManage();
                  }}
                  className="ui-menu__item ui-menu__item--action"
                >
                  <Icon icon={Settings02Icon} size={16} />
                  <span className="ui-menu__label">{t('model.manage')}</span>
                </Command.Item>
              )}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
