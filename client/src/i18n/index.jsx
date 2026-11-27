import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import es from './es.js';
import en from './en.js';
import fr from './fr.js';
import pt from './pt.js';

export const LANGS = ['es', 'en', 'fr', 'pt'];
const DICTS = { es, en, fr, pt };
const LOCALES = { es: 'es-ES', en: 'en-US', fr: 'fr-FR', pt: 'pt-BR' };

function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
}

function initialLang() {
  try {
    const saved = localStorage.getItem('lang');
    if (LANGS.includes(saved)) return saved;
  } catch {}
  const nav = (navigator.language || 'es').slice(0, 2);
  return LANGS.includes(nav) ? nav : 'es';
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l) => {
    setLangState(l);
    try {
      localStorage.setItem('lang', l);
    } catch {}
  }, []);

  const value = useMemo(() => {
    const locale = LOCALES[lang];
    const t = (key, vars) => {
      let s = lookup(DICTS[lang], key) ?? lookup(es, key) ?? key;
      if (typeof s === 'string' && vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
      return s;
    };
    const dateFmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    const longFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const dtFmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const numFmt = new Intl.NumberFormat(locale);
    let regions;
    try {
      regions = new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      regions = null;
    }
    return {
      lang,
      locale,
      setLang,
      t,
      fmtDate: (iso) => (iso ? dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : ''),
      fmtLong: (iso) => (iso ? longFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : ''),
      fmtDateTime: (s) => (s ? dtFmt.format(new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`)) : ''),
      fmtNum: (n) => numFmt.format(n),
      country: (code) => (code ? regions?.of(code) || code : ''),
      monthShort: (ym) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(`${ym}-01T00:00:00Z`)),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
