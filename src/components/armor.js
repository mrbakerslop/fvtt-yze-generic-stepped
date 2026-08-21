import { YearZeroRoll } from '../lib/yzur.js';
import { resolveArmorProtection } from '../system/armor-rules.js';

export default class Armor {
  // eslint-disable-next-line no-shadow
  constructor(rating, name, modifier = 0) {
    this.rating = rating;
    this.value = rating;
    this.name = name ?? 'Armor';
    this.modifier = modifier;
    this.penetrated = false;
    this.damage = 0;
    this.ablated = false;
  }

  /* ------------------------------------------- */
  /*  Getters                                    */
  /* ------------------------------------------- */

  get label() {
    return `${this.name} [${this.rating}]`;
  }

  get level() {
    return this.value > 0 ? Math.max(0, this.value + this.modifier) : 0;
  }

  get penetrationLimit() {
    return this.level - 2;
  }

  get damaged() {
    return this.ablated || this.value < this.rating;
  }

  /* ------------------------------------------- */
  /*  Methods                                    */
  /* ------------------------------------------- */

  modify(n) {
    this.modifier = Number(n) || 0;
  }

  isPenetratedByDamage(baseDamage) {
    return baseDamage > this.penetrationLimit;
  }

  async penetration(amount, baseDamage, modifier, { ablate = true } = {}) {
    const previousModifier = this.modifier;
    if (modifier !== undefined && modifier !== null) this.modify(modifier);
    const result = resolveArmorProtection({
      amount,
      baseDamage,
      rating: this.value,
      modifier: this.modifier,
    });
    amount = result.remaining;
    this.damage += result.damageDeflected;
    if (result.penetrated) {
      this.penetrated = true;
      if (ablate) await this.ablation();
    }
    this.modify(previousModifier);
    return amount;
  }

  async ablation() {
    const roll = new YearZeroRoll('1d6np');
    await roll.roll();
    if (roll.total === 1) {
      this.value = Math.max(0, this.value - 1);
      this.ablated = true;
      return true;
    }
    return false;
  }
}
