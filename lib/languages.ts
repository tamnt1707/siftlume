/**
 * Summary output languages. `name` is sent to the model, `label` is the native name shown to
 * users, and `tag` (BCP 47) picks a matching text-to-speech voice.
 */
export const OUTPUT_LANGUAGES = [
  { name: 'English', label: 'English', tag: 'en' },
  { name: 'Vietnamese', label: 'Tiếng Việt', tag: 'vi' },
  { name: 'Japanese', label: '日本語', tag: 'ja' },
  { name: 'Chinese (Simplified)', label: '简体中文', tag: 'zh-CN' },
  { name: 'Chinese (Traditional)', label: '繁體中文', tag: 'zh-TW' },
  { name: 'Korean', label: '한국어', tag: 'ko' },
  { name: 'Spanish', label: 'Español', tag: 'es' },
  { name: 'French', label: 'Français', tag: 'fr' },
  { name: 'German', label: 'Deutsch', tag: 'de' },
  { name: 'Portuguese', label: 'Português', tag: 'pt' },
  { name: 'Italian', label: 'Italiano', tag: 'it' },
  { name: 'Russian', label: 'Русский', tag: 'ru' },
  { name: 'Thai', label: 'ไทย', tag: 'th' },
  { name: 'Indonesian', label: 'Bahasa Indonesia', tag: 'id' },
  { name: 'Hindi', label: 'हिन्दी', tag: 'hi' },
  { name: 'Arabic', label: 'العربية', tag: 'ar' },
] as const;

export const speechTagFor = (language: string | undefined) => OUTPUT_LANGUAGES.find((l) => l.name === language)?.tag;
