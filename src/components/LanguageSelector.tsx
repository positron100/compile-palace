
import React from 'react';
import { languageOptions } from '../services/compileService';

interface Language {
  id: number;
  name: string;
}

interface LanguageSelectorProps {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ language, setLanguage }) => {
  return (
    <div className="language-selector">
      <select 
        value={language?.id || ''}
        onChange={(e) => {
          const selectedLang = languageOptions.find(
            (lang) => lang.id === parseInt(e.target.value)
          );
          if (selectedLang) {
            setLanguage(selectedLang);
          }
        }}
        className="language-select"
      >
        <option value="" disabled>
          Select Language
        </option>
        {languageOptions.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.name.split(' ')[0]} {/* Only display the language name, not the version */}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
