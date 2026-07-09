const DEVICE_TOKEN_KEY = 'britsync_device_token';

export function getDeviceToken(): string {
    let token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
        const arr = new Uint8Array(24);
        crypto.getRandomValues(arr);
        token = 'dev_' + Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
    return token;
}

export function isAndroidApk(): boolean {
    return typeof window !== 'undefined' && 'AndroidBridge' in window;
}

export function triggerFingerprint(): Promise<string> {
    return new Promise((resolve, reject) => {
        if (isAndroidApk()) {
            (window as any).onNativeFingerprintSuccess = (deviceToken?: string) => {
                resolve(deviceToken || getDeviceToken());
            };
            (window as any).onNativeFingerprintFailed = (error?: string) => {
                reject(new Error(error || 'Fingerprint authentication failed'));
            };
            try {
                (window as any).AndroidBridge.startFingerprint();
            } catch (e) {
                reject(new Error('Failed to start fingerprint scanner'));
            }
        } else {
            const timeout = setTimeout(() => {
                resolve(getDeviceToken());
            }, 1200);
            (window as any).__fp_cancel = () => {
                clearTimeout(timeout);
                reject(new Error('Fingerprint cancelled'));
            };
        }
    });
}
