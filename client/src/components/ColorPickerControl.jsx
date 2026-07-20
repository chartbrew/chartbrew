import React from "react";
import PropTypes from "prop-types";
import {
  Button,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Label,
} from "@heroui/react";
import { cn } from "../modules/utils";
import { normalizeColorForPicker, serializeColorForPicker } from "../modules/colorPicker";

function ColorPickerControl(props) {
  const {
    ariaLabel,
    className,
    clearLabel = "Remove color",
    fallbackColor = "#000000",
    onChange,
    onClear,
    popoverClassName,
    presetColors = [],
    renderTrigger,
    showClearButton = false,
    swatchClassName,
    value,
    valueFormat = "smart",
  } = props;

  const pickerColor = normalizeColorForPicker(value, fallbackColor);
  const cssColor = value || serializeColorForPicker(pickerColor, "smart", fallbackColor);

  const handleChange = (nextColor) => {
    onChange(serializeColorForPicker(nextColor, valueFormat, fallbackColor), nextColor);
  };

  const triggerContent = renderTrigger
    ? renderTrigger({ color: cssColor })
    : (
      <div className={cn(
        "flex min-w-[140px] items-center gap-3 rounded-xl border border-divider bg-content1 px-3 py-2 shadow-sm transition-colors hover:bg-content2",
        swatchClassName,
      )}
      >
        <ColorSwatch color={pickerColor} size="sm" />
        <span className="text-sm font-medium text-foreground">{ariaLabel}</span>
      </div>
    );

  return (
    <ColorPicker value={pickerColor} onChange={handleChange}>
      <ColorPicker.Trigger aria-label={ariaLabel} className={cn("inline-flex cursor-pointer", className)}>
        {triggerContent}
      </ColorPicker.Trigger>
      <ColorPicker.Popover className={cn("w-[280px] gap-3 rounded-2xl p-3", popoverClassName)}>
        {presetColors.length > 0 && (
          <ColorSwatchPicker aria-label={`${ariaLabel} presets`} className="flex flex-wrap justify-center gap-1 px-1" size="xs">
            {presetColors.map((preset) => (
              <ColorSwatchPicker.Item key={preset} color={preset}>
                <ColorSwatchPicker.Swatch />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
        )}

        <ColorArea
          aria-label={`${ariaLabel} color area`}
          className="max-w-full"
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
        >
          <ColorArea.Thumb />
        </ColorArea>

        <ColorSlider aria-label={`${ariaLabel} hue`} channel="hue" className="gap-1 px-1" colorSpace="hsb">
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <Label>Hue</Label>
            <ColorSlider.Output />
          </div>
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>

        <ColorSlider aria-label={`${ariaLabel} lightness`} channel="lightness" className="gap-1 px-1" colorSpace="hsl">
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <Label>Lightness</Label>
            <ColorSlider.Output />
          </div>
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>

        {valueFormat !== "hex" && (
          <ColorSlider aria-label={`${ariaLabel} alpha`} channel="alpha" className="gap-1 px-1" colorSpace="rgb">
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <Label>Alpha</Label>
              <ColorSlider.Output />
            </div>
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>
        )}

        <ColorField aria-label={`${ariaLabel} hex input`}>
          <ColorField.Group variant="secondary">
            <ColorField.Prefix>
              <ColorSwatch color={pickerColor} size="xs" />
            </ColorField.Prefix>
            <ColorField.Input />
          </ColorField.Group>
        </ColorField>

        {showClearButton && typeof onClear === "function" && (
          <Button className="justify-start" size="sm" variant="ghost" onPress={onClear}>
            {clearLabel}
          </Button>
        )}
      </ColorPicker.Popover>
    </ColorPicker>
  );
}

ColorPickerControl.propTypes = {
  ariaLabel: PropTypes.string.isRequired,
  className: PropTypes.string,
  clearLabel: PropTypes.string,
  fallbackColor: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onClear: PropTypes.func,
  popoverClassName: PropTypes.string,
  presetColors: PropTypes.arrayOf(PropTypes.string),
  renderTrigger: PropTypes.func,
  showClearButton: PropTypes.bool,
  swatchClassName: PropTypes.string,
  value: PropTypes.string,
  valueFormat: PropTypes.oneOf(["hex", "rgba", "smart"]),
};

export default ColorPickerControl;
