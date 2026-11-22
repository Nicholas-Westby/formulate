import { umbLocalizationManager, type UmbLocalizationSet } from '@umbraco-cms/backoffice/localization-api';
import en from '../localization/en.js';

/**
 * Loads Formulate's English text as the back office does (each term as section_key), so elements show their
 * text instead of their keys. Without it, a term shows as its key.
 */
export function loadFormulateEnglish() {
	registerTerms(() => true);
}

/**
 * Loads some of Formulate's English text, as loadFormulateEnglish does; the other terms still show as their
 * keys.
 * @param keys The terms' keys, such as formulate_editItem.
 */
export function loadFormulateEnglishTerms(keys: ReadonlyArray<string>) {
	registerTerms((key) => keys.includes(key));
}

function registerTerms(include: (key: string) => boolean) {
	const terms: UmbLocalizationSet = { $code: 'en', $dir: 'ltr' };

	for (const [section, sectionTerms] of Object.entries(en)) {
		for (const [key, term] of Object.entries(sectionTerms)) {
			if (include(`${section}_${key}`)) {
				terms[`${section}_${key}`] = term;
			}
		}
	}

	umbLocalizationManager.registerLocalization(terms);
}
