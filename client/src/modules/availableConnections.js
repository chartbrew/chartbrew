import { getSourcePickerItems, isSourceAiPowered } from "../sources";

export default getSourcePickerItems().map((source) => ({
  type: source.id,
  name: source.name,
  ai: isSourceAiPowered(source),
}));
