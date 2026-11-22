import type { FieldItem, FieldRendererRegistration } from "../types.js";
import { RenderRadioList } from "./plain-radio-button-list.js";

/**
 * Renders a list of radio buttons where each item shows its label and its
 * description (two formulate__field__label-text spans).
 */
export class RenderExtendedRadioList extends RenderRadioList {
  protected override getItemLabels(item: FieldItem): { label: string; label2?: string | null } {
    return { label: item.label, label2: item.description };
  }
}

export default { key: "extended-radio-list", renderer: RenderExtendedRadioList } satisfies FieldRendererRegistration;
