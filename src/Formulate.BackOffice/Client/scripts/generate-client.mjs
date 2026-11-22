// Generates the TypeScript client in src/api from the committed OpenAPI description of the
// Formulate Management API (openapi/formulate.json). Run "npm run generate-client" in the client
// folder after the API changes and the description has been regenerated from the dev site.
//
// The generator builds its output with the TypeScript compiler API, which TypeScript 7 (the
// version the client type-checks with) does not ship. So it runs from its own packages in this
// folder (scripts/package.json), where "typescript" is a version that still has that API.
import { fileURLToPath } from 'node:url';
import { createClient, defaultPlugins } from '@hey-api/openapi-ts';

const fromClientFolder = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

await createClient({
	input: fromClientFolder('openapi/formulate.json'),
	output: fromClientFolder('src/api'),
	plugins: [
		// Keep the default plugins, but replace the SDK plugin so its options can be set below.
		...defaultPlugins.filter((plugin) => (typeof plugin === 'string' ? plugin : plugin.name) !== '@hey-api/sdk'),
		{
			// Throw on error responses, like the back office's own client, so tryExecute reports them.
			name: '@hey-api/client-fetch',
			throwOnError: true,
		},
		{
			name: '@hey-api/sdk',
			responseStyle: 'fields',
		},
	],
});
