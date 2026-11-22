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
	},
} satisfies UmbLocalizationDictionary;
