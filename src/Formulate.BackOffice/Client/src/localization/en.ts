import type { UmbLocalizationDictionary } from '@umbraco-cms/backoffice/localization-api';

// English text for the Formulate back office. Use the keys as #formulate_<key> in manifests and
// this.localize.term('formulate_<key>') in elements.
export default {
	formulate: {
		section: 'Formulate',
		forms: 'Forms',
		dataValues: 'Data Values',
		validationLibrary: 'Validation Library',
		welcome: 'Welcome',
		welcomeHeadline: 'Welcome to Formulate',
		welcomeIntroduction: 'Formulate builds the forms on your website. Its work is split into three trees:',
		welcomeForms: 'Forms holds your forms, their fields and what happens when they are sent, and the layouts that arrange the fields.',
		welcomeDataValues: 'Data Values holds lists of choices, such as countries, for drop downs, checkbox lists and other fields.',
		welcomeValidationLibrary:
			'Validation Library holds rules, such as "required" or a pattern to match, that fields can share.',
		welcomeShowForm:
			'To show a form on a page, add a property that uses the Formulate Form Layout Picker to a document type, then pick a layout.',
		version: (version: string) => `Formulate ${version}`,
		nothingToCreate: 'Nothing can be created here.',
		itemNotFound: 'This item no longer exists. Someone may have deleted it.',
		moved: 'Moved',
		duplicated: 'Duplicated',
		confirmDeleteFolder: (name: string) =>
			`Are you sure you want to delete <strong>${name}</strong>? Everything in the folder is deleted with it.`,
		confirmDeleteForm: (name: string) =>
			`Are you sure you want to delete <strong>${name}</strong>? Its layouts are deleted with it.`,
		noSettings: 'This kind has no settings.',
		editorNotAvailable: 'The editor for this kind is not available, so its settings cannot be changed here.',
		errorMessage: 'Error message',
		mandatoryMessageDescription: 'Shown when the field is left empty.',
		clientSideOnly: 'Client side only',
		clientSideOnlyDescription:
			'Only the browser checks that the field is filled in. The server accepts the form without it.',
		regularExpression: 'Regular expression',
		regularExpressionDescription: 'The pattern a value must match, such as ^\\d{5}$ for a five digit zip code.',
		regexMessageDescription: 'Shown when the value does not match the pattern.',
		regexInvalid: (reason: string) =>
			`Browsers cannot read this regular expression, so they cannot check values with it: ${reason}`,
		items: 'Items',
		listItemsDescription: 'The choices, in the order they are shown. Each value is both stored and shown.',
		pairListItemsDescription:
			'The choices, in the order they are shown. The value is what is stored, the label what visitors see.',
		itemValue: (position: number) => `Value of item ${position}`,
		itemLabel: (position: number) => `Label of item ${position}`,
		removeItem: (name: string, position: number) => (name ? `Remove ${name}` : `Remove item ${position}`),
		moveItem: (name: string, position: number) => (name ? `Move ${name}` : `Move item ${position}`),
		moveHint:
			'Drag to move it, or press the up and down arrow keys. Enter picks it up and puts it down, and Escape puts it back.',
		itemPickedUp: (position: number, count: number) =>
			`Picked up item ${position} of ${count}. Press the up and down arrow keys to move it, Enter to put it down, or Escape to put it back.`,
		itemMoved: (position: number, count: number) => `Moved to item ${position} of ${count}.`,
		itemPutDown: (position: number, count: number) => `Put down at item ${position} of ${count}.`,
		itemPutBack: (position: number, count: number) => `Put back at item ${position} of ${count}.`,
		dynamicDataValues: 'This kind makes its items itself, so there is nothing to set here.',
		usStatesDataValues:
			'The 50 states, Washington, D.C., American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin Islands, in alphabetical order. Visitors see each name, such as Alabama; its two-letter postal code, such as AL, is what is stored. Formulate makes these items itself, so there is nothing to set here.',
		legacyDataValues:
			'These data values were made by an older version of Formulate and can no longer be changed. Create new data values to use instead.',
	},
} satisfies UmbLocalizationDictionary;
