// Vite imports a file's text with "?raw". The tests read the server's C# constants this way, so the back office
// spells what the server reads as the server does (see server-constants.ts).
declare module '*?raw' {
	const text: string;
	export default text;
}
