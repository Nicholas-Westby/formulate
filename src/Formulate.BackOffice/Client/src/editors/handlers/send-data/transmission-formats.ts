/**
 * How the Send Data handler sends its data, as the server spells the formats
 * (src/Formulate.Extensions.SendData/Constants.cs, Constants.TransmissionFormats). The server reads them
 * ignoring case.
 */
export const FORMULATE_TRANSMISSION_FORMATS = {
	QueryString: 'Query String',
	FormBody: 'Form Body',
	Json: 'JSON',
	HubSpotJson: 'HubSpot JSON',
} as const;

/** The term each format is shown by: the server's names, in the words of the user's language. */
export const FORMULATE_TRANSMISSION_FORMAT_TERMS: Record<string, string> = {
	[FORMULATE_TRANSMISSION_FORMATS.QueryString]: 'formulate_transmissionFormatQueryString',
	[FORMULATE_TRANSMISSION_FORMATS.FormBody]: 'formulate_transmissionFormatFormBody',
	[FORMULATE_TRANSMISSION_FORMATS.Json]: 'formulate_transmissionFormatJson',
	[FORMULATE_TRANSMISSION_FORMATS.HubSpotJson]: 'formulate_transmissionFormatHubSpotJson',
};
