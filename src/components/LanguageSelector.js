
import React from 'react';
import { languageOptions } from '../services/compileService';

const LanguageSelector = ({ language, setLanguage }) => {
  return (
    <div className="language-selector">
      <select 
        value={language?.id || ''}
        onChange={(e) => {
          const selectedLang = languageOptions.find(
            (lang) => lang.id === parseInt(e.target.value)
          );
          setLanguage(selectedLang);
        }}
        className="language-select"
      >
        <option value="" disabled>
          Select Language
        </option>
        {languageOptions.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
