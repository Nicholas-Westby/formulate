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
		editItem: (name: string, position: number) => (name ? `Edit ${name}` : `Edit item ${position}`),
		deleteItem: (name: string, position: number) => (name ? `Delete ${name}` : `Delete item ${position}`),
		enabledItem: (name: string, position: number) => (name ? `Enabled: ${name}` : `Enabled: item ${position}`),
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
		layoutNotFound: 'Layout not found',
		template: 'Template',
		templateDescription: 'The template that shows the form on a page.',
		templateNotInstalled: (id: string) => `Not installed (${id})`,
		layoutFormMissing:
			'The form of this layout could not be read, so its fields cannot be laid out here. Its name, alias and template can still be changed.',
		legacyDataValues:
			'These data values were made by an older version of Formulate and can no longer be changed. Create new data values to use instead.',
		fields: 'Fields',
		handlers: 'Handlers',
		addField: (kind?: string) => (kind ? `Add ${kind} field` : 'Add field'),
		editField: (kind?: string) => (kind ? `Edit ${kind} field` : 'Edit field'),
		deleteField: 'Delete field',
		confirmDeleteField: (name?: string) =>
			`Are you sure you want to delete ${name ? `the field ${name}` : 'this field'}? It is removed from the form when the form is saved.`,
		addHandler: (kind?: string) => (kind ? `Add ${kind} handler` : 'Add handler'),
		editHandler: (kind?: string) => (kind ? `Edit ${kind} handler` : 'Edit handler'),
		deleteHandler: 'Delete handler',
		confirmDeleteHandler: (name?: string) =>
			`Are you sure you want to delete ${name ? `the handler ${name}` : 'this handler'}? It is removed from the form when the form is saved.`,
		unnamed: 'Unnamed',
		unknownKind: 'Not installed',
		validationCount: (count: number) => (count === 1 ? '1 validation' : `${count} validations`),
		noKindsFound: 'No kind matches the filter.',
		label: 'Label',
		labelDescription: 'What visitors see with the field.',
		category: 'Category',
		categoryDescription: "One of the field categories set up in Formulate's configuration.",
		noCategory: 'No category',
		validations: 'Validations',
		validationsDescription: 'Checked in this order when the form is submitted.',
		validationNotFound: 'Validation not found',
		itemNotRead: 'Could not be read',
		dataValuesNotFound: 'Data values not found',
		unknownFieldKind:
			'The kind of this field is not installed, so only its name and alias can be changed here. Its settings are kept as they are.',
		unknownHandlerKind:
			'The kind of this handler is not installed, so only its name, alias and whether it is enabled can be changed here. Its settings are kept as they are.',
		enabled: 'Enabled',
		enabledDescription: 'Whether the handler runs when the form is submitted.',
		buttonKind: 'Button kind',
		buttonKindDescription:
			"What the button does, such as Submit, which sends the form. The kinds are set up in Formulate's configuration.",
		noButtonKind: 'No button kind',
		dataValuesDescription: 'The data values that hold the choices visitors pick from.',
		orientation: 'Orientation',
		orientationDescription: 'Whether the choices are laid out across or down.',
		defaultOrientation: 'As the template lays them out',
		horizontal: 'Horizontal',
		vertical: 'Vertical',
		text: 'Text',
		headerTextDescription: 'The heading the form shows.',
		hiddenTextDescription: 'The value sent with each submission of the form. Visitors do not see it.',
		textConstantDescription:
			'The value the server adds to each submission of the form. Visitors do not see it, and their browsers do not send it.',
		richTextDescription: 'The formatted text the form shows.',
		fieldNotFound: 'Field not found',
		recipientPosition: (position: number) => `Email address ${position}`,
		addRecipient: 'Add recipient',
		noFieldsToPick: 'The form has no fields to choose from.',
		fieldAndAlias: (name: string, alias: string) => (alias ? `${name} (${alias})` : name),
		senderEmail: 'Sender email',
		senderEmailDescription:
			"The address the email is sent from, such as `forms@example.com`. Leave it blank to send from the site's address (`Umbraco:CMS:Global:Smtp:From`).",
		recipients: 'Recipients',
		recipientsDescription:
			'The addresses the email is sent to. Each can have a name, such as `Sales <sales@example.com>`, or list several addresses separated by commas.',
		recipientFields: 'Recipient fields',
		recipientFieldsDescription:
			"Fields whose values are addresses to send the email to too, such as the visitor's own email. When the site sets `Formulate:Email:Whitelist`, only the addresses it allows are sent to, and none when it is empty.",
		deliveryType: 'Delivery',
		deliveryTypeDescription: "How the recipients get the email. With Bcc, they do not see each other's addresses.",
		deliveryTo: 'To',
		deliveryCc: 'Cc',
		deliveryBcc: 'Bcc',
		emailSubject: 'Subject',
		emailSubjectDescription: "The email's subject.",
		emailMessage: 'Message',
		emailMessageDescription: 'The text at the start of the email.',
		appendFields: 'Append fields',
		appendFieldsDescription: 'Adds the submitted values below the message, and attaches the files that were sent.',
		includeHiddenFields: 'Include hidden fields',
		includeHiddenFieldsDescription: 'With Append fields, adds the values of Hidden fields too.',
		excludeFieldLabels: 'Exclude field labels',
		excludeFieldLabelsDescription: 'With Append fields, adds the values without the names of their fields.',
		appendPayload: 'Append payload',
		appendPayloadDescription: 'With Append fields, adds the URL and name of the page the form was sent from, before the values.',
		fieldsToInclude: 'Fields to include',
		fieldsToIncludeDescription:
			"With Append fields, the fields whose values are added, in the form's order. Choose none to add them all. A Text Constant field adds its text.",
		subjectView: 'Subject view',
		subjectViewDescription: (path: string) =>
			'The view that writes the subject, such as `' + path + '`. Leave it blank to use the subject above.',
		htmlView: 'HTML view',
		htmlViewDescription: (path: string) =>
			'The view that writes the email, such as `' + path + '`. When this and the text view are blank, that sample is used.',
		textView: 'Text view',
		textViewDescription: (path: string) =>
			'The view that writes a plain text email, such as `' + path + '`. It is used only when there is no HTML view.',
		sendDataUrl: 'URL',
		sendDataUrlDescription:
			'The address the data is sent to, such as `https://crm.example.com/forms`. Its own query values are sent too.',
		httpMethod: 'Method',
		httpMethodDescription: 'The HTTP method of the request.',
		transmissionFormat: 'Transmission format',
		transmissionFormatDescription:
			"How the data is sent: in the URL's query string, as a form body, as JSON, or as JSON for a HubSpot form, with the page the form was sent from.",
		unknownTransmissionFormat: (format: string) => `${format} (not a format Formulate knows, so nothing is sent)`,
		fieldsToSend: 'Fields to send',
		fieldsToSendDescription:
			"The fields whose values are sent, in this order, and the name each is sent with. A blank name sends the field's alias, or its name when it has none.",
		noFieldsSent: "No fields are sent, so the request has none of the form's values. Choose the fields to send, or add all of them.",
		addAllFields: 'Add all fields',
		fieldNameSent: (name: string, position: number) => (name ? `Name sent for ${name}` : `Name sent for item ${position}`),
		storeDataDescription:
			'Stores each submission of this form in the Umbraco database: the values of its fields, the page it was sent from and the files sent with it. There is nothing to set here.',
	},
} satisfies UmbLocalizationDictionary;
