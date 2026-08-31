import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Button,
  Chip,
  Input,
  Label,
  ListBox,
  ProgressCircle,
  Select,
  Switch,
  TextField,
  Tooltip,
} from "@heroui/react";
import toast from "react-hot-toast";
import {
  LuExternalLink,
  LuGithub,
  LuGlobe,
  LuHeartHandshake,
  LuInfo,
  LuNewspaper,
  LuRotateCcw,
} from "react-icons/lu";

import {
  getPlatformSettings,
  resetPlatformSettings,
  updatePlatformSettings,
} from "../../api/platformSettings";
import cbLogoDark from "../../assets/cb_logo_dark.svg";
import cbLogoLight from "../../assets/cb_logo_light.svg";
import { useTheme } from "../../modules/ThemeContext";
import EnableAiPromptModal from "./EnableAiPromptModal";

const LINK_ICONS = {
  website: LuGlobe,
  github: LuGithub,
  blog: LuNewspaper,
  sponsors: LuHeartHandshake,
};

function buildDraft(groups = []) {
  return groups.reduce((draft, group) => {
    group.settings.forEach((setting) => {
      draft[setting.key] = setting.value;
    });
    return draft;
  }, {});
}

function normalizeValue(setting, value) {
  if (setting.type === "integer") return Number.parseInt(value, 10);
  if (setting.type === "number") return Number(value);
  return value;
}

function PlatformSettings() {
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingTarget, setResettingTarget] = useState(null);
  const [enablingAi, setEnablingAi] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = async () => {
    try {
      const platformData = await getPlatformSettings();
      setData(platformData);
      setDraft(buildDraft(platformData.groups));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const aiEnabled = data?.groups
    ?.flatMap((group) => group.settings)
    .find((setting) => setting.key === "workspaceOrchestrator.enabled")?.value;
  const enableAiIntent = searchParams.get("enableAi") === "platform";

  useEffect(() => {
    if (!enableAiIntent || aiEnabled !== true) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("enableAi");
    setSearchParams(nextParams, { replace: true });
  }, [aiEnabled, enableAiIntent, searchParams, setSearchParams]);

  const closeEnableAiPrompt = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("enableAi");
    setSearchParams(nextParams, { replace: true });
  };

  const confirmEnableAi = async () => {
    setEnablingAi(true);
    try {
      const platformData = await updatePlatformSettings({
        "workspaceOrchestrator.enabled": true,
      });
      setData(platformData);
      setDraft(buildDraft(platformData.groups));
      toast.success("Chartbrew AI enabled");
      closeEnableAiPrompt();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setEnablingAi(false);
    }
  };

  const changedSettings = useMemo(() => {
    if (!data) return {};
    return data.groups.reduce((changes, group) => {
      group.settings.forEach((setting) => {
        const value = normalizeValue(setting, draft[setting.key]);
        if (value !== setting.value) changes[setting.key] = value;
      });
      return changes;
    }, {});
  }, [data, draft]);

  const save = async () => {
    setSaving(true);
    try {
      const platformData = await updatePlatformSettings(changedSettings);
      setData(platformData);
      setDraft(buildDraft(platformData.groups));
      toast.success("Platform settings saved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async (keys, target, successMessage) => {
    setResettingTarget(target);
    const pendingChanges = { ...changedSettings };
    keys.forEach((key) => delete pendingChanges[key]);
    const storedOverrideKeys = new Set(data.groups.flatMap((group) => (
      group.settings
        .filter((setting) => setting.overridden)
        .map((setting) => setting.key)
    )));
    try {
      const hasStoredOverrides = keys.some((key) => storedOverrideKeys.has(key));
      const platformData = hasStoredOverrides
        ? await resetPlatformSettings(keys)
        : data;
      setData(platformData);
      setDraft({
        ...buildDraft(platformData.groups),
        ...pendingChanges,
      });
      toast.success(successMessage);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setResettingTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <ProgressCircle aria-label="Loading platform settings" size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-divider bg-surface p-4">
        Platform settings could not be loaded. Refresh the page and try again.
      </div>
    );
  }

  const getSectionState = (group) => {
    const keys = group.settings.map((setting) => setting.key);
    return {
      canReset: group.settings.some((setting) => (
        setting.overridden || Object.hasOwn(changedSettings, setting.key)
      )),
      keys,
      target: `section:${group.id}`,
    };
  };

  const renderSectionReset = (group) => {
    const section = getSectionState(group);
    return (
      <Button
        isDisabled={
          !section.canReset
          || saving
          || (resettingTarget !== null && resettingTarget !== section.target)
        }
        isPending={resettingTarget === section.target}
        onPress={() => resetSettings(
          section.keys,
          section.target,
          `${group.label} restored to defaults`
        )}
        size="sm"
        variant="tertiary"
      >
        <LuRotateCcw size={15} />
        Reset to defaults
      </Button>
    );
  };

  const renderSettings = (group) => (
    <div className="divide-y divide-divider">
      {group.settings.map((setting) => (
        <div
          className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] md:items-center"
          key={setting.key}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium">{setting.label}</div>
              {setting.help && (
                <Tooltip>
                  <Tooltip.Trigger>
                    <button
                      aria-label={`Learn more about ${setting.label}`}
                      className="inline-flex size-6 items-center justify-center rounded-full text-default-400 transition-colors hover:bg-default-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      type="button"
                    >
                      <LuInfo aria-hidden="true" size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="w-max max-w-sm whitespace-normal hyphens-none text-sm leading-5 [overflow-wrap:break-word] [word-break:normal]">
                    {setting.help}
                  </Tooltip.Content>
                </Tooltip>
              )}
              {setting.overridden && <Chip size="sm" variant="secondary">Custom</Chip>}
            </div>
            <div className="mt-1 text-sm text-default-500">{setting.description}</div>
          </div>

          <div className="flex items-center justify-end gap-2">
            {setting.type === "boolean" && (
              <Switch
                aria-label={setting.label}
                isDisabled={saving || resettingTarget !== null}
                isSelected={draft[setting.key] === true}
                onChange={(selected) => setDraft((current) => ({
                  ...current,
                  [setting.key]: selected,
                }))}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            )}

            {(setting.type === "integer" || setting.type === "number") && (
              <div className="flex w-full max-w-[240px] items-center gap-2">
                <TextField className="min-w-0 flex-1" name={setting.key}>
                  <Label className="sr-only">{setting.label}</Label>
                  <Input
                    isDisabled={saving || resettingTarget !== null}
                    max={setting.maximum}
                    min={setting.minimum}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      [setting.key]: event.target.value,
                    }))}
                    step={setting.step || 1}
                    type="number"
                    value={`${draft[setting.key] ?? ""}`}
                    variant="secondary"
                  />
                </TextField>
                {setting.unit && (
                  <span className="shrink-0 text-sm text-default-500">{setting.unit}</span>
                )}
              </div>
            )}

            {setting.type === "enum" && (
              <Select
                aria-label={setting.label}
                className="w-full max-w-[240px]"
                isDisabled={saving || resettingTarget !== null}
                onChange={(value) => setDraft((current) => ({
                  ...current,
                  [setting.key]: value,
                }))}
                selectionMode="single"
                value={draft[setting.key]}
                variant="secondary"
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {setting.options.map((option) => (
                      <ListBox.Item id={option.value} key={option.value} textValue={option.label}>
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}

            {setting.overridden && (
              <Button
                aria-label={`Restore ${setting.label}`}
                isDisabled={
                  saving
                  || (resettingTarget !== null && resettingTarget !== setting.key)
                }
                isIconOnly
                isPending={resettingTarget === setting.key}
                onPress={() => resetSettings(
                  [setting.key],
                  setting.key,
                  "Deployment default restored"
                )}
                size="sm"
                variant="tertiary"
              >
                <LuRotateCcw size={16} />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <EnableAiPromptModal
        isOpen={enableAiIntent && aiEnabled === false}
        isPending={enablingAi}
        onCancel={closeEnableAiPrompt}
        onConfirm={confirmEnableAi}
        scope="platform"
      />
      <section className="overflow-hidden rounded-3xl border border-divider bg-surface">
        <div className="grid md:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <div className="flex min-h-64 flex-col justify-between gap-10 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <img
                alt="Chartbrew"
                className="h-auto w-44 sm:w-52"
                src={isDark ? cbLogoDark : cbLogoLight}
              />
              <Chip size="sm" variant="secondary">{data.version}</Chip>
            </div>

            <p className="max-w-xl text-base leading-7 text-default-600 sm:text-lg">
              Chartbrew is created and maintained by{" "}
              <a
                className="font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
                href="https://x.com/razvanilin"
                rel="noopener noreferrer"
                target="_blank"
              >
                Razvan Ilin
              </a>
              .
            </p>
          </div>

          <nav
            aria-label="Chartbrew links"
            className="flex flex-col gap-2 border-t border-divider bg-default-50/60 p-4 md:border-l md:border-t-0"
          >
            {data.links.map((link) => {
              const LinkIcon = LINK_ICONS[link.id] || LuExternalLink;
              return (
                <a
                  className="group flex min-h-12 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-colors hover:border-divider hover:bg-surface"
                  href={link.url}
                  key={link.id}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-default-200 text-default-600 transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                    <LinkIcon aria-hidden="true" size={17} />
                  </span>
                  <span className="flex-1 text-foreground">{link.label}</span>
                  <LuExternalLink
                    aria-hidden="true"
                    className="text-default-400 transition-colors group-hover:text-default-600"
                    size={15}
                  />
                </a>
              );
            })}
          </nav>
        </div>
      </section>

      {data.groups.map((group) => {
        return (
          <section className="rounded-3xl border border-divider bg-surface p-4" key={group.id}>
            <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold font-tw">{group.label}</h2>
              {renderSectionReset(group)}
            </div>
            {renderSettings(group)}
          </section>
        );
      })}

      <div className="sticky bottom-4 flex justify-end rounded-2xl border border-divider bg-surface/95 p-3 shadow-lg backdrop-blur">
        <Button
          isDisabled={Object.keys(changedSettings).length < 1 || resettingTarget !== null}
          isPending={saving}
          onPress={save}
          variant="primary"
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

export default PlatformSettings;
