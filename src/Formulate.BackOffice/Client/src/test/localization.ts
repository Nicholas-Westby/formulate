import { umbLocalizationManager, type UmbLocalizationSet } from '@umbraco-cms/backoffice/localization-api';
import en from '../localization/en.js';

/**
 * Loads Formulate's English text as the back office does (each term as section_key), so elements show their
 * text instead of their keys. Without it, a term shows as its key.
 */
export function loadFormulateEnglish() {
	const terms: UmbLocalizationSet = { $code: 'en', $dir: 'ltr' };

	for (const [section, sectionTerms] of Object.entries(en)) {
		for (const [key, term] of Object.entries(sectionTerms)) {
			terms[`${section}_${key}`] = term;
		}
	}

	umbLocalizationManager.registerLocalization(terms);
}
