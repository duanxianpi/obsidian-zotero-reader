declare interface Window {
	rtl?: boolean;

	dev?: boolean;

	DarkReader?: typeof import('darkreader');

	zoteroPrint?: (options?: { overrideSettings?: Record<string, string> }) => Promise<void>;

	BLOB_URL_MAP: Record<string, string>;
}

declare module '*.scss' {
	const scss: string;
	export default scss;
}

declare module '!!raw-loader!*' {
	const raw: string;
	export default raw;
}
