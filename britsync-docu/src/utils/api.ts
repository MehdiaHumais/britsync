const getApiBaseUrl = (): string => {
    const isDev = import.meta.env.DEV;
    if (isDev) {
        return 'http://localhost:5003';
    }
    return import.meta.env.VITE_API_BASE_URL || '';
};

interface ApiOptions extends Omit<RequestInit, 'body'> {
    body?: any;
}

export const apiCall = async (endpoint: string, options: ApiOptions = {}) => {
    const apiBase = getApiBaseUrl();
    const normalizedEndpoint = endpoint.startsWith('/api') ? endpoint : `/api/${endpoint}`;
    // Force path namespace to /api/docu/ for backend routing separation
    const docuEndpoint = normalizedEndpoint.replace('/api/', '/api/docu/');
    const url = apiBase ? `${apiBase}${docuEndpoint}` : docuEndpoint;

    const token = localStorage.getItem('docu_token');
    const defaultHeaders: Record<string, string> = {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token && { 'Authorization': `Bearer ${token}` }),
    };

    const config: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        } as HeadersInit
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API call failed: ${endpoint}`, error);
        throw error;
    }
};

export const getImageUrl = (imagePath: string): string => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    const apiBase = getApiBaseUrl();
    if (imagePath.startsWith('/uploads/')) {
        return `${apiBase}${imagePath}`;
    }
    return imagePath;
};

export default apiCall;
