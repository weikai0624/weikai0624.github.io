/**
 * LanguageManager.js
 * Handles i18n for the ARAM Mayhem simulator.
 *
 * Adding a new language:
 *   1. Create  language/XX.json  with the same key structure as zh-TW.json
 *   2. Add "XX" to the "languages" array in data/config.json
 *   That's it — the language switcher will pick it up automatically.
 *
 * Usage:
 *   const lang = new LanguageManager();
 *   await lang.loadLanguage('zh-TW');
 *   lang.t('ui.title')                         // "海克斯增幅裝置"
 *   lang.t('ui.round_label', {round:2, remaining:2}) // "第 2 回合　剩餘 2 回合"
 *   lang.aug('adapt', 'name')                  // "ADAPt"
 *   lang.aug('adapt', 'description')           // "將額外攻擊力轉換..."
 *   lang.fam('wee_woo', 'name')                // "急救隊"
 *   lang.famBonus('wee_woo', 3)                // "治療和護盾效果額外提升25%..."
 *   lang.tier('kGold')                         // "金級"
 */

class LanguageManager {
  constructor() {
    this._strings = {};
    this._currentLang = null;
    this._availableLanguages = [];
  }

  /**
   * Load a language file by code (e.g. 'zh-TW', 'en').
   * @param {string} code
   * @throws if the file cannot be fetched or parsed
   */
  async loadLanguage(code) {
    const res = await fetch(`language/${code}.json`);
    if (!res.ok) throw new Error(`[LanguageManager] Cannot load language file: language/${code}.json (HTTP ${res.status})`);
    this._strings = await res.json();
    this._currentLang = code;
  }

  /**
   * Set the list of available language codes (read from config.json).
   * @param {string[]} langs
   */
  setAvailableLanguages(langs) {
    this._availableLanguages = langs;
  }

  /** @returns {string[]} */
  getAvailableLanguages() { return this._availableLanguages; }

  /** @returns {string|null} */
  getCurrentLanguage() { return this._currentLang; }

  /**
   * Resolve a dot-separated key and interpolate {param} placeholders.
   * Returns the key itself if the path is not found.
   * @param {string} key   e.g. 'ui.round_label'
   * @param {object} params  e.g. { round: 2, remaining: 2 }
   * @returns {string}
   */
  t(key, params = {}) {
    const parts = key.split('.');
    let node = this._strings;
    for (const part of parts) {
      if (node == null || typeof node !== 'object') return key;
      node = node[part];
    }
    if (typeof node !== 'string') return key;
    return node.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
  }

  /**
   * Convenience: resolve an augment field.
   * @param {string} augId
   * @param {'name'|'nameEN'|'description'} field
   * @returns {string}
   */
  aug(augId, field = 'name') {
    return this.t(`augments.${augId}.${field}`);
  }

  /**
   * Convenience: resolve a family field.
   * @param {string} familyId
   * @param {'name'|'nameEN'} field
   * @returns {string}
   */
  fam(familyId, field = 'name') {
    return this.t(`families.${familyId}.${field}`);
  }

  /**
   * Convenience: resolve a family's bonus description for a given piece count.
   * @param {string} familyId
   * @param {number} count  2 | 3 | 4
   * @returns {string}
   */
  famBonus(familyId, count) {
    return this.t(`families.${familyId}.bonuses.${count}`);
  }

  /**
   * Convenience: resolve a tier display name.
   * @param {'kSilver'|'kGold'|'kPrismatic'} tierId
   * @returns {string}
   */
  tier(tierId) {
    return this.t(`tiers.${tierId}`);
  }

  /**
   * Convenience: return a rules array (each item is an HTML string).
   * @returns {string[]}
   */
  rules() {
    const r = this._strings?.ui?.rules;
    return Array.isArray(r) ? r : [];
  }
}
