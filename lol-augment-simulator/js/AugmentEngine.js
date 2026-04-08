/**
 * AugmentEngine.js
 * Core engine for ARAM Mayhem Hextech Augment simulator.
 * Manages augment pools, draw logic, reroll, selection, and combo detection.
 * Completely decoupled from the DOM — no rendering code lives here.
 */

class AugmentEngine {
  /**
   * @param {object} augmentData  - Parsed augments.json
   * @param {object} familyData   - Parsed families.json
   * @param {object} config       - Parsed config.json
   */
  constructor(augmentData, familyData, config) {
    this._allAugments = augmentData.augments;        // [{id, tier, family, isSpecial?, specialType?}]
    this._allFamilies = familyData.families;         // [{id, color, memberIds}]
    this._config = config;                           // {rounds, cardsPerRound, tierProbabilities}
    this._state = null;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Reset to fresh game state. Must be called before dealing any rounds. */
  reset() {
    // Build per-tier pools of augment IDs
    const pools = { kSilver: [], kGold: [], kPrismatic: [] };
    for (const aug of this._allAugments) {
      if (pools[aug.tier]) pools[aug.tier].push(aug.id);
    }
    // Shuffle each pool
    for (const pool of Object.values(pools)) {
      AugmentEngine._shuffleInPlace(pool);
    }

    this._state = {
      round: 0,
      pools,
      usedIds: new Set(),
      selectedIds: [],       // IDs of augments the player has chosen
      currentOptions: [],    // [{id, tier, rerolled: bool}] for the active round
      currentTier: null,
      gameOver: false,
    };
  }

  /**
   * Determine the tier for a round based on configured probabilities.
   * @param {number} roundIndex - 0-based round index
   * @returns {'kSilver'|'kGold'|'kPrismatic'}
   */
  pickTier(roundIndex) {
    const probs = this._config.tierProbabilities[roundIndex];
    if (!probs) return 'kPrismatic';

    const rand = Math.random();
    let cumulative = 0;
    for (const [tier, prob] of Object.entries(probs)) {
      cumulative += prob;
      if (rand < cumulative) return tier;
    }
    // Fallback: last key
    return Object.keys(probs).at(-1);
  }

  /**
   * Deal cards for the current round and advance internal state.
   * @returns {{ tier: string, cards: Array<{id, tier, rerolled}> } | null}
   */
  dealRound() {
    if (!this._state || this._state.gameOver) return null;

    const tier = this.pickTier(this._state.round);
    this._state.currentTier = tier;

    const cards = [];
    for (let i = 0; i < this._config.cardsPerRound; i++) {
      const id = this._drawFromPool(tier);
      if (id) cards.push({ id, tier, rerolled: false });
    }

    this._state.currentOptions = cards;
    return { tier, cards };
  }

  /**
   * Check if a card at the given index can be rerolled.
   * @param {number} cardIndex
   * @returns {boolean}
   */
  canReroll(cardIndex) {
    const card = this._state.currentOptions[cardIndex];
    return !!card && !card.rerolled;
  }

  /**
   * Reroll the card at the given index. Returns the new augment ID, or null if pool is empty.
   * @param {number} cardIndex
   * @returns {string|null}
   */
  reroll(cardIndex) {
    if (!this.canReroll(cardIndex)) return null;
    const card = this._state.currentOptions[cardIndex];
    const newId = this._drawFromPool(card.tier);
    if (!newId) return null;
    this._state.currentOptions[cardIndex] = { id: newId, tier: card.tier, rerolled: true };
    return newId;
  }

  /**
   * Select the card at the given index. Handles special augments.
   * @param {number} cardIndex
   * @returns {{ type: 'normal'|'special', specialType?: string, gainedIds: string[], convertedIds?: string[] }}
   */
  selectCard(cardIndex) {
    const card = this._state.currentOptions[cardIndex];
    if (!card) return null;
    const aug = this.getAugmentById(card.id);
    if (!aug) return null;

    if (aug.isSpecial) {
      return this._handleSpecial(aug);
    } else {
      this._state.selectedIds.push(aug.id);
      this._advanceRound();
      return { type: 'normal', gainedIds: [aug.id] };
    }
  }

  /**
   * Returns all active combo sets (families with ≥2 selected members).
   * @returns {Array<{ familyId: string, count: number, memberAugIds: string[] }>}
   */
  getActiveCombos() {
    const counts = {};
    for (const id of this._state.selectedIds) {
      const aug = this.getAugmentById(id);
      const families = aug?.family ?? [];
      for (const fam of families) {
        counts[fam] = (counts[fam] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .filter(([, c]) => c >= 2)
      .map(([familyId, count]) => ({
        familyId,
        count,
        memberAugIds: this._state.selectedIds.filter(id => {
          const a = this.getAugmentById(id);
          const fs = a?.families?.length ? a.families : (a?.family ? [a.family] : []);
          return fs.includes(familyId);
        }),
      }));
  }

  /**
   * Get the active combo for a specific augment (if its family has ≥2 members selected).
   * @param {string} augId
   * @returns {{ familyId, count, memberAugIds } | null}
   */
  getFamilyComboForAug(augId) {
    const aug = this.getAugmentById(augId);
    const families = aug?.families?.length ? aug.families : (aug?.family ? [aug.family] : []);
    if (!families.length) return null;
    const combos = this.getActiveCombos();
    return combos.filter(c => families.includes(c.familyId));
  }

  /** @returns {object|null} augment data object by ID */
  getAugmentById(id) {
    return this._allAugments.find(a => a.id === id) ?? null;
  }

  /** @returns {object|null} family data object by ID */
  getFamilyById(id) {
    return this._allFamilies.find(f => f.id === id) ?? null;
  }

  /** @returns {number} current 0-based round index */
  getCurrentRound()   { return this._state.round; }
  /** @returns {number} total rounds from config */
  getTotalRounds()    { return this._config.rounds; }
  /** @returns {string|null} current round's tier */
  getCurrentTier()    { return this._state.currentTier; }
  /** @returns {boolean} */
  isGameOver()        { return this._state.gameOver; }
  /** @returns {string[]} copy of selected augment IDs */
  getSelectedIds()    { return [...this._state.selectedIds]; }
  /** @returns {Array<{id,tier,rerolled}>} current round's card options */
  getCurrentOptions() { return [...this._state.currentOptions]; }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Draw one augment ID from a pool tier. Marks it as used. Returns null if exhausted. */
  _drawFromPool(tier) {
    const available = (this._state.pools[tier] ?? []).filter(id => !this._state.usedIds.has(id));
    if (!available.length) return null;
    const id = available[Math.floor(Math.random() * available.length)];
    this._state.usedIds.add(id);
    return id;
  }

  /** Draw one augment from any available tier (Prismatic preferred). Returns {id, tier} or null. */
  _drawAnyPool() {
    for (const tier of ['kPrismatic', 'kGold', 'kSilver']) {
      const id = this._drawFromPool(tier);
      if (id) return { id, tier };
    }
    return null;
  }

  /** Handle special augment effects. Advances the round when done. */
  _handleSpecial(aug) {
    switch (aug.specialType) {
      case 'give_gold': {
        const id = this._drawFromPool('kGold');
        if (id) this._state.selectedIds.push(id);
        this._advanceRound();
        return { type: 'special', specialType: 'give_gold', gainedIds: id ? [id] : [] };
      }
      case 'give_two': {
        const gained = [];
        for (let i = 0; i < 2; i++) {
          const tiers = ['kSilver', 'kGold', 'kPrismatic'];
          const tier = tiers[Math.floor(Math.random() * tiers.length)];
          const id = this._drawFromPool(tier) ?? this._drawAnyPool()?.id;
          if (id) { this._state.selectedIds.push(id); gained.push(id); }
        }
        this._advanceRound();
        return { type: 'special', specialType: 'give_two', gainedIds: gained };
      }
      case 'give_prismatic': {
        const id = this._drawFromPool('kPrismatic');
        if (id) this._state.selectedIds.push(id);
        this._advanceRound();
        return { type: 'special', specialType: 'give_prismatic', gainedIds: id ? [id] : [] };
      }
      case 'convert_prismatic': {
        const convertedIds = [...this._state.selectedIds];
        const newIds = this._state.selectedIds.map(() => {
          const id = this._drawFromPool('kPrismatic');
          return id ?? null;
        });
        // Apply conversion: replace selected IDs where we got a new prismatic
        this._state.selectedIds = this._state.selectedIds.map((old, i) => newIds[i] ?? old);
        this._advanceRound();
        return { type: 'special', specialType: 'convert_prismatic', convertedIds, gainedIds: newIds.filter(Boolean) };
      }
      default:
        this._advanceRound();
        return { type: 'normal', gainedIds: [] };
    }
  }

  _advanceRound() {
    this._state.round++;
    if (this._state.round >= this._config.rounds) {
      this._state.gameOver = true;
    }
  }

  static _shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
