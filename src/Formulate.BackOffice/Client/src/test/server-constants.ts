import recaptchaOptions from '../../../../Formulate.Core/Configuration/FormulateRecaptchaOptions.cs?raw';
import checkboxField from '../../../../Formulate.Core/FormFields/Checkbox/CheckboxFieldDefinition.cs?raw';
import dateField from '../../../../Formulate.Core/FormFields/Date/DateFieldDefinition.cs?raw';
import extendedRadioButtonListField from '../../../../Formulate.Core/FormFields/ExtendedRadioButtonList/ExtendedRadioButtonListFieldDefinition.cs?raw';
import recaptchaField from '../../../../Formulate.Core/FormFields/Recaptcha/RecaptchaFieldDefinition.cs?raw';
import textConstantField from '../../../../Formulate.Core/FormFields/TextConstant/TextConstantFieldDefinition.cs?raw';
import uploadField from '../../../../Formulate.Core/FormFields/Upload/UploadFieldDefinition.cs?raw';
import sendDataConstants from '../../../../Formulate.Extensions.SendData/Constants.cs?raw';
import emailViewPaths from '../../../../Formulate.Extensions.SendEmail/DesignedEmail/EmailViewPaths.cs?raw';
import emailSettings from '../../../../Formulate.Extensions.SendEmail/EmailSettings.cs?raw';

/**
 * The string constants of a C# class, by their names, from its source: each `public const string Name = "value";`
 * in the class's braces, not in classes nested in it. Enough for the server's small constant classes.
 * @param source The C# source.
 * @param className The class, such as TransmissionFormats.
 */
export function readStringConstants(source: string, className: string): Record<string, string> {
	const start = new RegExp(`\\bclass\\s+${className}\\b[^{]*\\{`).exec(source);

	if (!start) {
		throw new Error(`The source has no class ${className}.`);
	}

	// The class's own text: up to the brace that closes it, without the classes nested in it.
	let depth = 1;
	let body = '';

	for (let i = start.index + start[0].length; i < source.length && depth > 0; i++) {
		depth += source[i] === '{' ? 1 : source[i] === '}' ? -1 : 0;
		body += depth === 1 ? source[i] : ' ';
	}

	return Object.fromEntries([...body.matchAll(/public\s+const\s+string\s+(\w+)\s*=\s*"([^"]*)"\s*;/g)].map((match) => [match[1], match[2]]));
}

/**
 * The names of a C# class's public properties, in the order the source declares them: each
 * `public Type Name { get; ...`. Enough for the server's small settings classes, whose properties are the names of
 * their settings.
 * @param source The C# source.
 */
export function readPropertyNames(source: string): Array<string> {
	return [...source.matchAll(/public\s+[\w<>?,\s[\]]+?\s+(\w+)\s*\{\s*get;/g)].map((match) => match[1]!);
}

/** The server's constants the back office has to match, from the C# source. */
export const SERVER_CONSTANTS = {
	/**
	 * src/Formulate.Core/Configuration/FormulateRecaptchaOptions.cs: its constants, such as SectionName (the section
	 * of the reCAPTCHA settings), and its properties, the names of the settings in that section, such as SiteKey.
	 */
	recaptchaOptions: {
		constants: readStringConstants(recaptchaOptions, 'FormulateRecaptchaOptions'),
		properties: readPropertyNames(recaptchaOptions),
	},
	/** src/Formulate.Core/FormFields/Checkbox/CheckboxFieldDefinition.cs, its Constants. */
	checkboxField: readStringConstants(checkboxField, 'Constants'),
	/** src/Formulate.Core/FormFields/Date/DateFieldDefinition.cs, its Constants. */
	dateField: readStringConstants(dateField, 'Constants'),
	/** src/Formulate.Core/FormFields/ExtendedRadioButtonList/ExtendedRadioButtonListFieldDefinition.cs, its Constants. */
	extendedRadioButtonListField: readStringConstants(extendedRadioButtonListField, 'Constants'),
	/** src/Formulate.Core/FormFields/Recaptcha/RecaptchaFieldDefinition.cs, its Constants. */
	recaptchaField: readStringConstants(recaptchaField, 'Constants'),
	/** src/Formulate.Extensions.SendData/Constants.cs, Constants.TransmissionFormats. */
	transmissionFormats: readStringConstants(sendDataConstants, 'TransmissionFormats'),
	/** src/Formulate.Extensions.SendEmail/DesignedEmail/EmailViewPaths.cs. */
	emailViewPaths: readStringConstants(emailViewPaths, 'EmailViewPaths'),
	/** src/Formulate.Extensions.SendEmail/EmailSettings.cs: SectionName, the section of its settings, such as Whitelist. */
	emailSettings: readStringConstants(emailSettings, 'EmailSettings'),
	/** src/Formulate.Core/FormFields/TextConstant/TextConstantFieldDefinition.cs, its Constants. */
	textConstantField: readStringConstants(textConstantField, 'Constants'),
	/** src/Formulate.Core/FormFields/Upload/UploadFieldDefinition.cs, its Constants. */
	uploadField: readStringConstants(uploadField, 'Constants'),
};
