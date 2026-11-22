import { UMB_WORKSPACE_CONDITION_ALIAS, UMB_WORKSPACE_ENTITY_IS_NEW_CONDITION_ALIAS } from '@umbraco-cms/backoffice/workspace';
import { FORMULATE_FORM_WORKSPACE_ALIAS } from '../constants.js';
import { FORMULATE_SUBMISSION_MODAL_ALIAS } from './submission-modal.token.js';

/** The submissions viewer: the form workspace's Submissions view, and the sidebar of a submission. */
export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'workspaceView',
		alias: 'Formulate.WorkspaceView.Form.Submissions',
		name: 'Formulate Form Submissions Workspace View',
		element: () => import('./submissions-workspace-view.element.js'),
		// After Fields and Handlers.
		weight: 50,
		meta: { label: '#formulate_submissions', pathname: 'submissions', icon: 'icon-inbox' },
		conditions: [
			{ alias: UMB_WORKSPACE_CONDITION_ALIAS, match: FORMULATE_FORM_WORKSPACE_ALIAS },
			// A form that is not saved yet has no submissions; the view shows once it is.
			{ alias: UMB_WORKSPACE_ENTITY_IS_NEW_CONDITION_ALIAS, match: false },
		],
	},
	{
		type: 'modal',
		alias: FORMULATE_SUBMISSION_MODAL_ALIAS,
		name: 'Formulate Submission Modal',
		element: () => import('./submission-modal.element.js'),
	},
];
