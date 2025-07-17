import { createContext, useContext, useState, useEffect } from 'react';
import { getCompanyInfo } from '../utils/authFetch';

const SUPPORTED_LANGUAGES = ['en', 'ua'];

const TRANSLATIONS_BASIC = {
  ua: {
    "No new notifications": "Сповіщення відсутні",
    "User info": "Користувач",
    "Settings": "Налаштування",
    "Required": "Обов'язкове",
    "Add field": "Додати поле",
    "Text Field": "Текстове поле",
    "Multi Choice": "Мультивибір",
    "Single Choice": "Вибір",
    "Label": "Заголовок",
    "Property Name": "Назва",
    "Create": "Створити",
    "Delete": "Видалити",
    "Add": "Додати",
    "Details": "Деталі",
    "back to list": "Повернутися до списку",
    "Use": "Використати",
    "Read": "Читати",
    "Discard": "Скасувати зміни",
    "Cancel": "Скасувати",
    "Edit": "Редагувати",
    "Copy": "Копіювати",
    "Name": "Назва",
    "Description": "Короткий опис",
    "Available for everyone": "Доступно публічно",
    "Tags": "Теги",
    "Text": "Текст",
    "Author name (optional)": "Псевдонім (необов'язково)",
    "Select an option": "Оберіть опцію...",
    "Enter new item": "Додати новий рядок",
    "Test": "Тест",
    "Variants (each line is a variant)": "Варіанти (кожен рядок - окремий варіант)",
    "Save": "Зберегти",
    "Load": "Завантажити",
    "Articles": "Тексти",
    "Type": "Тип",
    "Error": "Помилка",
    "Close": "Закрити",
    "Table": "Таблиця",
    "Back": "Назад",
  },
  en: {}
};

export const registerTranslations = (lang, newTranslations) => {
  TRANSLATIONS_BASIC[lang] = {
    ...TRANSLATIONS_BASIC[lang],
    ...newTranslations
  };
};

const STORAGE_KEY = 'preferred_language';

const detectBrowserLanguage = () => {
  let stored = localStorage.getItem(STORAGE_KEY);
  const companyInfo = getCompanyInfo();
  if (companyInfo && companyInfo.lang_ui) {
    stored = companyInfo.lang_ui;
  }
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
    return stored;
  }

  const languages = [
    navigator.language,
    ...(navigator.languages || [])
  ].map(lang => lang.toLowerCase());

  if (languages.some(lang => ['uk', 'uk-ua', 'ru', 'ru-ru'].includes(lang))) {
    return 'ua';
  }

  return 'en';
};

const defaultLocaleContext = {
  currentLang: 'en',
  setLang: (_a) => {},
  str: (_s) => '',
  labels: (_l) => [],
  addTranslation: (_tr) => {}
};

const LocaleContext = createContext(defaultLocaleContext);

export const LocaleProvider = ({ children }) => {
  const [currentLang, setCurrentLang] = useState('en');
  const [additionalTranslations, setAdditionalTranslations] = useState({
    en: {},
    ua: {}
  });

  const addTranslation = (lang, dict) => {
    const mergedDict = {
      ...additionalTranslations[lang],
      ...dict
    };
    setAdditionalTranslations(prev => ({
      ...prev,
      [lang]: mergedDict
    }));
  };

  useEffect(() => {
    const detected = detectBrowserLanguage();
    setCurrentLang(detected);
    console.log("Detected language is " + detected);
  }, []);

  const setLang = (lang) => {
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      setCurrentLang(lang);
      localStorage.setItem(STORAGE_KEY, lang);
    } else {
      console.error(`Unsupported language: ${lang}`);
    }
  };

  const str = (s) => {
    if (currentLang in TRANSLATIONS_BASIC && s in TRANSLATIONS_BASIC[currentLang]) {
      return TRANSLATIONS_BASIC[currentLang][s];
    }

    if (currentLang in additionalTranslations && s in additionalTranslations[currentLang]) {
      return additionalTranslations[currentLang][s];
    }

    if (currentLang !== 'en') {
      console.log("Untranslated text detected:", s);
    }

    return s;
  };

  const labels = (data) => {
    return data.map(item => {
      if (item.label) {
        return {...item, label: str(item.label)}
      }
      return item
    })
  };

  return (
    <LocaleContext.Provider value={{ currentLang, setLang, str, addTranslation, labels }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => useContext(LocaleContext);
