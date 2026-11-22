/**
 * The paths of the built-in sample views of the Designed Email handler, as the server has them
 * (src/Formulate.Extensions.SendEmail/DesignedEmail/EmailViewPaths.cs). A site can put its own view at a
 * sample's path, or anywhere else.
 */
export const FORMULATE_SAMPLE_EMAIL_VIEWS = {
	subject: '~/Views/Formulate/Email/Sample (Subject).cshtml',
	html: '~/Views/Formulate/Email/Sample (HTML).cshtml',
	text: '~/Views/Formulate/Email/Sample (Text).cshtml',
} as const;
