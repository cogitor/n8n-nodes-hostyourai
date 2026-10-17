export const DEFAULT_BASE_URL = 'https://hostyourai.com/api/v1';
export const DEFAULT_COLD_START_RETRIES = 4;
export const DEFAULT_COLD_START_WAIT_SECONDS = 90;

const ALLOWED_DOMAIN = 'hostyourai.com';

export type BaseUrlValidation =
	| { isValid: true; baseUrl: string }
	| { isValid: false; error: string };

export function validateBaseUrl(value: unknown): BaseUrlValidation {
	const raw = typeof value === 'string' ? value.trim() : '';
	const candidate = raw.length > 0 ? raw : DEFAULT_BASE_URL;

	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		return { isValid: false, error: 'Base URL must be a valid absolute URL' };
	}

	if (parsed.protocol !== 'https:') {
		return { isValid: false, error: 'Base URL must use HTTPS' };
	}
	if (parsed.username || parsed.password) {
		return { isValid: false, error: 'Base URL must not include username or password' };
	}

	const hostname = parsed.hostname.toLowerCase();
	const allowed = hostname === ALLOWED_DOMAIN || hostname.endsWith(`.${ALLOWED_DOMAIN}`);
	if (!allowed) {
		return { isValid: false, error: 'Base URL host must be hostyourai.com or its subdomain' };
	}

	return { isValid: true, baseUrl: parsed.toString().replace(/\/+$/, '') };
}
