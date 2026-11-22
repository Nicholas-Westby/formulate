import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readStringConstants, transmissionFormats } from './server-constants.ts';

test("reads the string constants of a C# class, by their names", () => {
	const source = `
		public static partial class Constants
		{
			public const string HttpClientName = "Formulate.SendData";

			public static class TransmissionFormats
			{
				public const string QueryString = "Query String";

				public const string Json = "JSON";
			}
		}`;

	assert.deepEqual(readStringConstants(source, 'TransmissionFormats'), { QueryString: 'Query String', Json: 'JSON' });
	assert.throws(() => readStringConstants(source, 'Missing'), /Missing/);
});

test("gives Send Data's transmission formats as the server spells them", () => {
	assert.deepEqual(transmissionFormats(), {
		QueryString: 'Query String',
		FormBody: 'Form Body',
		Json: 'JSON',
		HubSpotJson: 'HubSpot JSON',
	});
});
