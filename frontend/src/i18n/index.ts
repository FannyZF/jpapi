import { createI18n } from "vue-i18n";
import zh from "./zh";
import en from "./en";

const saved = localStorage.getItem("lang") || "zh";

const i18n = createI18n({
  legacy: false,
  locale: saved,
  fallbackLocale: "zh",
  messages: { zh, en },
});

export default i18n;

export function setLang(lang: string) {
  i18n.global.locale.value = lang;
  localStorage.setItem("lang", lang);
}
