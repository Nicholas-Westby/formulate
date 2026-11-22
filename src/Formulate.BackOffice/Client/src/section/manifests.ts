import { FORMULATE_MENU_ALIAS, FORMULATE_SECTION_ALIAS, FORMULATE_SECTION_PATHNAME } from '../constants.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'section',
		alias: FORMULATE_SECTION_ALIAS,
		name: 'Formulate Section',
		// After Members (500) and before Translation (400).
		weight: 450,
		meta: {
			label: '#formulate_section',
			pathname: FORMULATE_SECTION_PATHNAME,
		},
		conditions: [
			{
				alias: 'Umb.Condition.SectionUserPermission',
				match: FORMULATE_SECTION_ALIAS,
			},
		],
	},
	{
		type: 'menu',
		alias: FORMULATE_MENU_ALIAS,
		name: 'Formulate Menu',
	},
	{
		type: 'sectionSidebarApp',
		kind: 'menu',
		alias: 'Formulate.SectionSidebarApp.Menu',
		name: 'Formulate Section Sidebar Menu',
		weight: 100,
		meta: {
			label: '#formulate_section',
			menu: FORMULATE_MENU_ALIAS,
		},
		conditions: [
			{
				alias: 'Umb.Condition.SectionAlias',
				match: FORMULATE_SECTION_ALIAS,
			},
		],
	},
	{
		type: 'dashboard',
		alias: 'Formulate.Dashboard.Welcome',
		name: 'Formulate Welcome Dashboard',
		element: () => import('./welcome-dashboard.element.js'),
		weight: 100,
		meta: {
			label: '#formulate_welcome',
			pathname: 'welcome',
		},
		conditions: [
			{
				alias: 'Umb.Condition.SectionAlias',
				match: FORMULATE_SECTION_ALIAS,
			},
		],
	},
];
