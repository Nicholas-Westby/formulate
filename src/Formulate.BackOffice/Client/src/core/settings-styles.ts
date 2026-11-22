import { css } from '@umbraco-cms/backoffice/external/lit';

/**
 * The spacing of settings shown one under another (vertical umb-property-layouts), as Umbraco's property
 * settings space theirs. The item dialogs use it for their own settings, and the field editors in them for
 * theirs, so that both are spaced alike.
 */
export const FORMULATE_SETTINGS_STYLES = css`
	umb-property-layout[orientation='vertical'] {
		padding: var(--uui-size-space-2) 0;
	}

	umb-property-layout:first-of-type {
		padding-top: 0;
	}

	umb-property-layout:last-of-type {
		padding-bottom: 0;
	}
`;
