import type { TemplateResult } from '@umbraco-cms/backoffice/external/lit';
import type { FormulateCellPlace, FormulateFieldPlace } from './basic-layout.model.js';

// What the parts of the Basic layout designer share: the layout as they show it, and what they ask the
// designer (the editor element) to do. The designer holds the layout and stores each change.

/** Fields move between the cells and the unused fields of a designer: the sorters of all of them are connected. */
export const FORMULATE_LAYOUT_FIELDS_SORTER = 'Formulate.Sorter.LayoutFields';

/** Rows move within the rows of a designer. */
export const FORMULATE_LAYOUT_ROWS_SORTER = 'Formulate.Sorter.LayoutRows';

/** A field as the designer shows it. */
export interface FormulateLayoutFieldView {
	/** The field's key in the designer, which no other field of the layout has. */
	key: string;
	/** The field's ID, as it is stored. */
	id: string;
	name: string;
	alias: string;
	icon?: string;
	/** Whether the field is no longer on the form: it shows as not found, and can only be removed. */
	missing: boolean;
}

/** A cell as the designer shows it. */
export interface FormulateLayoutCellView {
	place: FormulateCellPlace;
	/** How many of the row's 12 columns it takes. */
	columns: number;
	fields: ReadonlyArray<FormulateLayoutFieldView>;
}

/** A row of cells as the designer shows it. */
export interface FormulateLayoutContentRowView {
	kind: 'row';
	key: string;
	/** Its place among all rows and step dividers, 0 for the first. */
	index: number;
	/** Its place among the rows with cells, 1 for the first, as its controls name it ("Delete row 2"). */
	position: number;
	cells: ReadonlyArray<FormulateLayoutCellView>;
}

/** A step divider as the designer shows it. */
export interface FormulateLayoutStepView {
	kind: 'step';
	key: string;
	/** Its place among all rows and step dividers, 0 for the first. */
	index: number;
	/** The number of the step it starts, from 2; null when the form starts no step there. */
	step: number | null;
}

export type FormulateLayoutRowView = FormulateLayoutContentRowView | FormulateLayoutStepView;

/** What the rows and cells of a designer ask of it. */
export interface FormulateBasicLayoutDesigner {
	moveRow(from: number, to: number): void;
	deleteRow(index: number): void;
	addStepAfter(index: number): void;
	deleteStep(index: number): void;
	/**
	 * Moves a field, from wherever it is, to a cell or to the unused fields.
	 * @param key The field's key.
	 * @param to Where it goes.
	 * @param index Its place there, 0 for the first.
	 */
	moveField(key: string, to: FormulateFieldPlace, index: number): void;
	/** Takes a field out of the layout, such as one that is no longer on the form. */
	removeField(key: string): void;
	/** The handle that moves a row, by dragging and with the keyboard. */
	renderRowHandle(key: string, label: string): TemplateResult;
	/** The hint the handles of the rows point to, and the announcements of their moves. */
	renderRowStatus(): TemplateResult;
	/** The handle that moves a field, by dragging and with the keyboard. */
	renderFieldHandle(key: string, label: string): TemplateResult;
}
