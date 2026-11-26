import { LANGS, useI18n } from '../i18n/index.jsx';

export default function LangSwitch({ className = 'lang' }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={className} role="group" aria-label="Idioma / Language">
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={l === lang} onClick={() => setLang(l)} lang={l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
