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
