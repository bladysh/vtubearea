import { createContext, useContext, useMemo, type ReactNode } from "react";
import english_messages from "./locales/en.json";
import russian_messages from "./locales/ru.json";

export type TranslationKey = keyof typeof english_messages;
export type Locale = "en" | "ru";
export type TranslateFunction = (key: TranslationKey, values?: Record<string, string | number>) => string;

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "ru"];

const messages_by_locale: Record<Locale, Partial<Record<TranslationKey, string>>> = {
  en: english_messages,
  ru: russian_messages,
};

/** Falls back to English, then to the key itself, so a missing string never breaks the UI. */
export function create_translator(locale: Locale): TranslateFunction {
  const messages = messages_by_locale[locale];
  return (key, values) => {
    const template = messages[key] ?? english_messages[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (placeholder, value_name: string) => String(values[value_name] ?? placeholder));
  };
}

const translate_context = createContext<TranslateFunction>(create_translator("en"));

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const translate = useMemo(() => create_translator(locale), [locale]);
  return <translate_context.Provider value={translate}>{children}</translate_context.Provider>;
}

export function useTranslate(): TranslateFunction {
  return useContext(translate_context);
}
