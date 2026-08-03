const STORAGE_KEY = 'learnmate_openrouter_api_key';

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setApiKey(key: string): void {
  if (key) {
    localStorage.setItem(STORAGE_KEY, key);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

export const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL as string;
