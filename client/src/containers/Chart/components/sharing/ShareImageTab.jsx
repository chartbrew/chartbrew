import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Chip, Input, Label, Switch, TextField, ToggleButton, ToggleButtonGroup,
} from "@heroui/react";
import {
  LuImage, LuRefreshCcw, LuTriangleAlert,
} from "react-icons/lu";
import { toast } from "react-hot-toast";

import ColorPickerControl from "../../../../components/ColorPickerControl";
import { useTheme } from "../../../../modules/ThemeContext";
import {
  buildShareImageOptions,
  getShareImageFingerprint,
  getShareImageDefaults,
  getShareImageFileName,
  isShareImageBackgroundPreset,
  isShareImagePresetSupported,
  resolveShareImageDimensions,
  SHARE_IMAGE_COLOR_PRESETS,
  SHARE_IMAGE_DEFAULT_COLOR,
  SHARE_IMAGE_GRADIENT_PRESETS,
  SHARE_IMAGE_BACKGROUND_PRESETS,
} from "./shareImageDefaults";
import ShareImageCanvas from "./ShareImageCanvas";
import ShareImagePreview from "./ShareImagePreview";
import useShareImageCapture from "./useShareImageCapture";
import { getShareImageBackgroundSrc } from "./shareImageBackgrounds";

function ChoiceGroup({
  hint = null,
  isDisabled = false,
  label,
  onChange,
  options,
  value,
}) {
  return (
    <div className={`flex flex-col gap-2 ${isDisabled ? "opacity-45" : ""}`}>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {label}
        {hint}
      </div>
      <ToggleButtonGroup
        aria-label={label}
        disallowEmptySelection
        fullWidth
        isDisabled={isDisabled}
        selectedKeys={new Set([value])}
        selectionMode="single"
        size="sm"
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next) onChange(next);
        }}
      >
        {options.map((option, index) => (
          <ToggleButton
            key={option.value}
            id={option.value}
            isDisabled={option.isDisabled || undefined}
          >
            {index > 0 ? <ToggleButtonGroup.Separator /> : null}
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

ChoiceGroup.propTypes = {
  hint: PropTypes.node,
  isDisabled: PropTypes.bool,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    isDisabled: PropTypes.bool,
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  })).isRequired,
  value: PropTypes.string.isRequired,
};

function SettingSwitch({
  isDisabled = false,
  isSelected,
  label,
  onChange,
}) {
  return (
    <Switch
      aria-label={label}
      className="w-full"
      isDisabled={isDisabled}
      isSelected={isSelected}
      size="sm"
      onChange={onChange}
    >
      <Switch.Content className="flex w-full items-center justify-between gap-4">
        <span className="text-sm text-foreground">{label}</span>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

SettingSwitch.propTypes = {
  isDisabled: PropTypes.bool,
  isSelected: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function ContentField({
  children = null,
  isDisabled = false,
  isSelected,
  label,
  onChange,
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingSwitch
        isDisabled={isDisabled}
        isSelected={isSelected}
        label={label}
        onChange={onChange}
      />
      {isSelected && !isDisabled && children}
    </div>
  );
}

ContentField.propTypes = {
  children: PropTypes.node,
  isDisabled: PropTypes.bool,
  isSelected: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function BackgroundSwatches({
  gradientId,
  imageId,
  mode,
  value,
  onChangeColor,
  onChangeGradient,
  onChangeImage,
}) {
  const selected = `${value || SHARE_IMAGE_DEFAULT_COLOR}`.toUpperCase();
  const customSelected = mode === "custom" && !isShareImageBackgroundPreset(selected);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {SHARE_IMAGE_COLOR_PRESETS.map((color) => {
          const isSelected = mode === "custom" && selected === color;
          return (
            <button
              key={color}
              aria-label={`Background ${color}`}
              aria-pressed={isSelected}
              className={`size-7 shrink-0 rounded-full border transition-shadow ${isSelected
                ? "border-primary ring-2 ring-primary/30"
                : "border-divider"}`}
              style={{ backgroundColor: color }}
              type="button"
              onClick={() => onChangeColor(color)}
            />
          );
        })}
        <ColorPickerControl
          ariaLabel="Custom image background color"
          className="inline-flex size-7 items-center justify-center overflow-hidden rounded-full p-0"
          fallbackColor={SHARE_IMAGE_DEFAULT_COLOR}
          value={selected}
          valueFormat="hex"
          onChange={(color) => onChangeColor(color.toUpperCase())}
          renderTrigger={() => (
            <span
              aria-hidden
              className={`block size-7 rounded-full border transition-shadow ${customSelected
                ? "border-primary ring-2 ring-primary/30"
                : "border-divider"}`}
              style={{
                background: "conic-gradient(#F43F5E, #F59E0B, #22C55E, #0EA5E9, #6366F1, #D946EF, #F43F5E)",
              }}
            />
          )}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {SHARE_IMAGE_GRADIENT_PRESETS.map((gradient) => {
          const isSelected = mode === "gradient" && gradientId === gradient.id;
          return (
            <button
              key={gradient.id}
              aria-label={`${gradient.id} gradient background`}
              aria-pressed={isSelected}
              className={`size-7 shrink-0 rounded-full border transition-shadow ${isSelected
                ? "border-primary ring-2 ring-primary/30"
                : "border-divider"}`}
              style={{ backgroundImage: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
              type="button"
              onClick={() => onChangeGradient(gradient.id)}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {SHARE_IMAGE_BACKGROUND_PRESETS.map((preset) => {
          const isSelected = mode === "image" && imageId === preset.id;
          const src = getShareImageBackgroundSrc(preset.id);
          return (
            <button
              key={preset.id}
              aria-label={`${preset.id.replaceAll("_", " ")} background`}
              aria-pressed={isSelected}
              className={`size-7 shrink-0 overflow-hidden rounded-full border bg-cover bg-center transition-shadow ${isSelected
                ? "border-primary ring-2 ring-primary/30"
                : "border-divider"}`}
              style={{ backgroundImage: src ? `url(${src})` : undefined }}
              type="button"
              onClick={() => onChangeImage(preset.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

BackgroundSwatches.propTypes = {
  gradientId: PropTypes.string.isRequired,
  imageId: PropTypes.string.isRequired,
  mode: PropTypes.string.isRequired,
  onChangeColor: PropTypes.func.isRequired,
  onChangeGradient: PropTypes.func.isRequired,
  onChangeImage: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
};

function ShareImageTab({
  chart,
  getSourceSize,
  isActive,
  onActionChange = null,
  project,
  team = {},
}) {
  const { isDark } = useTheme();
  const canvasRef = useRef(null);
  const [settings, setSettings] = useState(() => getShareImageDefaults({ chart, project }));
  const [sourceSize] = useState(() => {
    const measured = getSourceSize();
    return {
      height: Number(measured?.height) > 0 ? Number(measured.height) : 300,
      width: Number(measured?.width) > 0 ? Number(measured.width) : 600,
    };
  });
  const [activeAction, setActiveAction] = useState(null);
  const supported = isShareImagePresetSupported(chart.type);
  const dimensions = useMemo(() => {
    return resolveShareImageDimensions(settings.sizePreset, sourceSize);
  }, [settings.sizePreset, sourceSize]);
  const imageOptions = useMemo(() => buildShareImageOptions({
    isDark,
    settings,
  }), [isDark, settings]);
  const fingerprint = useMemo(() => {
    return getShareImageFingerprint({ dimensions, imageOptions });
  }, [dimensions, imageOptions]);
  const {
    error,
    getCurrentBlob,
    isRendering,
    retry,
  } = useShareImageCapture({
    dimensions,
    enabled: supported && isActive,
    fingerprint,
    nodeRef: canvasRef,
  });

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleCopy = useCallback(async () => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined" || !window.isSecureContext) {
      toast.error("Image copy is not available in this browser. You can download the image instead.");
      return;
    }
    setActiveAction("copy");
    try {
      const blob = await getCurrentBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Image copied");
    } catch (copyError) {
      if (copyError.name !== "AbortError") {
        toast.error(copyError.message || "The image could not be copied. You can download it instead.");
      }
    } finally {
      setActiveAction(null);
    }
  }, [getCurrentBlob]);

  const handleDownload = useCallback(async () => {
    setActiveAction("download");
    try {
      const blob = await getCurrentBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getShareImageFileName(chart.name, dimensions);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("Image downloaded");
    } catch (downloadError) {
      if (downloadError.name !== "AbortError") {
        toast.error(downloadError.message || "The image could not be downloaded.");
      }
    } finally {
      setActiveAction(null);
    }
  }, [chart.name, dimensions, getCurrentBlob]);

  useEffect(() => {
    if (!onActionChange) return undefined;
    onActionChange(supported ? {
      activeAction,
      onCopy: handleCopy,
      onDownload: handleDownload,
      supported: true,
    } : { supported: false });
    return undefined;
  }, [activeAction, handleCopy, handleDownload, onActionChange, supported]);

  if (!supported) {
    return (
      <div className="flex min-h-96 flex-1 items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-secondary text-foreground-500">
            <LuImage size={22} aria-hidden />
          </div>
          <div className="mt-4 text-sm font-semibold text-foreground">Image sharing is not available for this chart</div>
          <div className="mt-1 text-sm text-foreground-500">
            This chart type cannot be exported as an image yet.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col lg:grid lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
      <section className="flex min-h-0 flex-col lg:overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <div className="text-sm font-semibold text-foreground">Preview</div>
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="soft">
              <Chip.Label>{dimensions.width} × {dimensions.height}</Chip.Label>
            </Chip>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <ShareImagePreview
            dimensions={dimensions}
          >
            <ShareImageCanvas
              ref={canvasRef}
              chart={chart}
              dimensions={dimensions}
              options={imageOptions}
              project={project}
              team={team}
            />
          </ShareImagePreview>
        </div>

        {error && (
          <div className="px-5 pb-4">
            <div className="flex flex-col items-stretch gap-2 rounded-xl bg-danger/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3" role="alert">
              <div className="flex min-w-0 items-start gap-2 text-sm text-danger sm:items-center">
                <LuTriangleAlert className="shrink-0" aria-hidden />
                <span>{error.message}</span>
              </div>
              <Button className="self-end sm:self-auto" size="sm" variant="ghost" onPress={() => retry().catch(() => {})}>
                <LuRefreshCcw />
                Try again
              </Button>
            </div>
          </div>
        )}
        <div className="sr-only" aria-live="polite">
          {error ? error.message : isRendering ? "Preparing image." : "Image is ready."}
        </div>
      </section>

      <aside className="min-h-0 border-t border-divider p-5 lg:overflow-y-auto lg:border-t-0">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <ChoiceGroup
              label="Size"
              value={settings.sizePreset}
              onChange={(value) => updateSetting("sizePreset", value)}
              options={[
                { label: "Landscape", value: "landscape" },
                { label: "Mobile", value: "mobile" },
                { label: "Original", value: "original" },
              ]}
            />
            <ChoiceGroup
              label="Theme"
              value={settings.theme}
              onChange={(value) => updateSetting("theme", value)}
              options={[
                { label: "Current", value: "current" },
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
              ]}
            />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold text-foreground">Choose background</div>
              <BackgroundSwatches
                gradientId={settings.backgroundGradient}
                imageId={settings.backgroundImage}
                mode={settings.backgroundMode}
                value={settings.backgroundColor}
                onChangeColor={(color) => {
                  setSettings((current) => ({
                    ...current,
                    backgroundColor: color,
                    backgroundMode: "custom",
                  }));
                }}
                onChangeGradient={(id) => {
                  setSettings((current) => ({
                    ...current,
                    backgroundGradient: id,
                    backgroundMode: "gradient",
                  }));
                }}
                onChangeImage={(id) => {
                  setSettings((current) => ({
                    ...current,
                    backgroundImage: id,
                    backgroundMode: "image",
                  }));
                }}
              />
            </div>
            <div className="flex flex-col gap-4">
              {project.logo && (
                <SettingSwitch
                  label="Logo"
                  isSelected={settings.logo}
                  onChange={(value) => updateSetting("logo", value)}
                />
              )}
              <SettingSwitch
                label="Team name"
                isSelected={settings.companyName}
                onChange={(value) => updateSetting("companyName", value)}
              />
              <SettingSwitch
                label="Project name"
                isSelected={settings.dashboardName}
                onChange={(value) => updateSetting("dashboardName", value)}
              />
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-foreground">Content</div>
            <div className="flex flex-col gap-4">
              <ContentField
                label="Title"
                isSelected={settings.titleShow}
                onChange={(value) => updateSetting("titleShow", value)}
              >
                <TextField name="share-image-title">
                  <Label className="sr-only">Image title</Label>
                  <Input
                    maxLength={160}
                    size="sm"
                    variant="secondary"
                    value={settings.titleText}
                    onChange={(event) => updateSetting("titleText", event.target.value)}
                  />
                </TextField>
              </ContentField>
              <ContentField
                label="Subtitle"
                isSelected={settings.subtitleShow}
                onChange={(value) => updateSetting("subtitleShow", value)}
              >
                <TextField name="share-image-subtitle">
                  <Label className="sr-only">Image subtitle</Label>
                  <Input
                    maxLength={240}
                    placeholder="Add context"
                    size="sm"
                    variant="secondary"
                    value={settings.subtitleText}
                    onChange={(event) => updateSetting("subtitleText", event.target.value)}
                  />
                </TextField>
              </ContentField>
            </div>
          </div>

          <ChoiceGroup
            label="Branding"
            value={settings.branding}
            onChange={(value) => updateSetting("branding", value)}
            options={[
              { label: "Chartbrew", value: "chartbrew" },
              { label: "White-label", value: "whiteLabel" },
            ]}
          />
        </div>
      </aside>
    </div>
  );
}

ShareImageTab.propTypes = {
  chart: PropTypes.object.isRequired,
  getSourceSize: PropTypes.func.isRequired,
  isActive: PropTypes.bool.isRequired,
  onActionChange: PropTypes.func,
  project: PropTypes.object.isRequired,
  team: PropTypes.object,
};

export default ShareImageTab;
