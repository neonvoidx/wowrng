export type Role = 'Tank' | 'Healer' | 'DPS';

export interface Spec {
  class: string;
  name: string;
  role: Role;
  bloodlust: boolean;
  /** Can resurrect an ally in combat (Raise Ally, Rebirth). */
  battleRez: boolean;
  /** Exact bloodlust spell id into the buffs catalog (Time Warp, Primal Rage, …). */
  lustSpell?: string;
  /** Exact battle rez spell id into the buffs catalog (Rebirth, Raise Ally). */
  rezSpell?: string;
  /** Self-resurrect spell id into the buffs catalog (Reincarnation). */
  selfRezSpell?: string;
  /** Only present on DPS specs. */
  subrole?: 'Melee' | 'Ranged';
  /** Ids into the buffs catalog (class throughput buff per Midnight). */
  raidBuffs?: string[];
  /** Notable raid utility ids into the buffs catalog. */
  utility?: string[];
  icon: string;
}

export interface Assignment {
  playerName: string;
  role: Role;
  spec: Spec;
}

export interface Options {
  noDuplicates: boolean;
  noDuplicateClasses: boolean;
  mustIncludeBloodlust: boolean;
  /** Cap the group to at most one Augmentation evoker (never forces one in). */
  maxOneAug: boolean;
  /** Ensure at least one battle-rez-capable spec (Death Knight, Druid). */
  mustIncludeBattleRez: boolean;
  /** Minimum melee DPS count, or null to leave unconstrained. */
  meleeCount: number | null;
  /** Minimum ranged DPS count, or null to leave unconstrained. */
  rangedCount: number | null;
  /** Per-player one-trick spec keys ('Class:Name'), index-aligned with
   *  playerNames; null/undefined = random. Pinned players always get their
   *  spec; the remaining rules are applied where still applicable. */
  pins?: (string | null)[];
}

const ROLE_SLOTS: readonly Role[] = ['Tank', 'Healer', 'DPS', 'DPS', 'DPS'];

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function normalizeNames(playerNames: string[]): string[] {
  return ROLE_SLOTS.map((_, i) => {
    const trimmed = (playerNames[i] ?? '').trim();
    return trimmed.length > 0 ? trimmed : `Player ${i + 1}`;
  });
}

export function assignGroup(
  specs: Spec[],
  playerNames: string[],
  options: Options,
  rng: () => number = Math.random,
): Assignment[] {
  const pools: Record<Role, Spec[]> = { Tank: [], Healer: [], DPS: [] };
  for (const spec of specs) pools[spec.role].push(spec);

  const key = (spec: Spec) => `${spec.class}:${spec.name}`;

  // Resolve one-trick pins against the pool. Pinned specs leave the draw
  // pools entirely; their players are bound to them.
  const pinnedByIndex = new Map<number, Spec>();
  (options.pins ?? []).forEach((k, index) => {
    if (!k) return;
    const found = Object.values(pools)
      .flat()
      .find((s) => key(s) === k);
    if (found) pinnedByIndex.set(index, found);
  });
  const hasPins = pinnedByIndex.size > 0;
  for (const spec of pinnedByIndex.values()) {
    const poolIndex = pools[spec.role].indexOf(spec);
    if (poolIndex >= 0) pools[spec.role].splice(poolIndex, 1);
  }

  // Minimums: leftover DPS slots (if any) are unconstrained.
  // Pins already contributing melee/ranged DPS lower what the draws must cover.
  let meleeMin = options.meleeCount;
  let rangedMin = options.rangedCount;
  for (const spec of pinnedByIndex.values()) {
    if (spec.role !== 'DPS' || !spec.subrole) continue;
    if (spec.subrole === 'Melee' && meleeMin !== null) meleeMin = Math.max(0, meleeMin - 1);
    if (spec.subrole === 'Ranged' && rangedMin !== null) rangedMin = Math.max(0, rangedMin - 1);
  }
  if ((meleeMin ?? 0) + (rangedMin ?? 0) > 3) {
    throw new Error('Melee and ranged DPS amounts together cannot exceed 3');
  }
  const usedSpecs = new Set<string>();
  const usedClasses = new Set<string>();  const candidates = (
    role: Role,
    requireLust: boolean,
    replacing?: Assignment,
    subrole?: 'Melee' | 'Ranged' | null,
  ): Spec[] =>
    pools[role].filter((s) => {
      if (requireLust && !s.bloodlust) return false;
      if (replacing) {
        // The bloodlust swap must not disturb the melee/ranged balance.
        if (s.subrole !== replacing.spec.subrole) return false;
      } else if (subrole && s.subrole !== subrole) {
        return false;
      }
      const isCurrent = replacing && key(s) === key(replacing.spec);
      if (!isCurrent) {
        if (options.noDuplicates && usedSpecs.has(key(s))) return false;
        if (options.noDuplicateClasses && usedClasses.has(s.class)) return false;
      }
      return true;
    });

  const reserve = (spec: Spec): void => {
    usedSpecs.add(key(spec));
    usedClasses.add(spec.class);
  };

  const drawFrom = (pool: Spec[], what: string): Spec => {
    if (pool.length === 0) throw new Error(`Not enough ${what} specs selected`);
    const chosen = pick(pool, rng);
    reserve(chosen);
    return chosen;
  };

  // Which subrole each DPS slot must satisfy; null = unconstrained.
  const fillSubrole = (n: number, subrole: 'Melee' | 'Ranged'): ('Melee' | 'Ranged')[] =>
    Array.from({ length: n }, () => subrole);
  const dpsRequirements: ('Melee' | 'Ranged' | null)[] = shuffle(
    [...fillSubrole(meleeMin ?? 0, 'Melee'), ...fillSubrole(rangedMin ?? 0, 'Ranged')],
    rng,
  );
  while (dpsRequirements.length < 3) dpsRequirements.push(null);

  let dpsIndex = 0;
  const drawForRole = (role: Role): Spec => {
    if (role !== 'DPS') return drawFrom(candidates(role, false), role);
    const req = dpsRequirements[dpsIndex++];
    return drawFrom(candidates('DPS', false, undefined, req), req ? `${req.toLowerCase()} DPS` : 'DPS');
  };

  const names = normalizeNames(playerNames);

  // Player -> role sequence. Without pins the classic shuffle; with pins each
  // pinned player takes their spec's role and the remaining needs (stealing a
  // slot from DPS first when pins overfill a role) are shuffled across the rest.
  const roles: Role[] = (() => {
    if (!hasPins) return shuffle(ROLE_SLOTS, rng);
    const needs: Record<Role, number> = { Tank: 1, Healer: 1, DPS: 3 };
    const stealOrder: Role[] = ['DPS', 'Healer', 'Tank'];
    for (const index of [...pinnedByIndex.keys()].sort((a, b) => a - b)) {
      const role = pinnedByIndex.get(index)!.role;
      if (needs[role] > 0) {
        needs[role]--;
      } else {
        for (const r of stealOrder) {
          if (needs[r] > 0) {
            needs[r]--;
            break;
          }
        }
      }
    }
    const rest: Role[] = [];
    for (const r of ['Tank', 'Healer', 'DPS'] as const) {
      for (let i = 0; i < needs[r]; i++) rest.push(r);
    }
    const shuffledRest = shuffle(rest, rng);
    let next = 0;
    return names.map((_, i) => {
      const pin = pinnedByIndex.get(i);
      if (pin) return pin.role;
      const role = shuffledRest[next++];
      return role ?? 'DPS';
    });
  })();

  const pinnedAssignments = new Set<Assignment>();
  const assignments: Assignment[] = roles.map((role, i) => {
    const pin = pinnedByIndex.get(i);
    if (pin) {
      reserve(pin);
      const assignment = { playerName: names[i], role: pin.role, spec: pin };
      pinnedAssignments.add(assignment);
      return assignment;
    }
    return { playerName: names[i], role, spec: drawForRole(role) };
  });

  const lustHolders = () => assignments.filter((a) => a.spec.bloodlust);
  const lustCount = () => lustHolders().length;
  const brHolders = () => assignments.filter((a) => a.spec.battleRez);
  const isAug = (s: Spec) => s.class === 'Evoker' && s.name === 'Augmentation';

  // Cap Augmentation evokers at one: reroll any extras into other specs
  // from the same role pool. Never pulls an Aug in; never touches a pin.
  if (options.maxOneAug) {
    const extras = shuffle(
      assignments.filter((a) => isAug(a.spec) && !pinnedAssignments.has(a)),
      rng,
    ).slice(1);
    for (const target of extras) {
      usedSpecs.delete(key(target.spec));
      usedClasses.delete(target.spec.class);
      const pool = candidates(target.role, false, target).filter((s) => !isAug(s));
      if (pool.length === 0) {
        reserve(target.spec); // stuck; try the next extra instead
        continue;
      }
      target.spec = pick(pool, rng);
      reserve(target.spec);
    }
  }

  // Lust swap-in must not sneak an Aug past the cap; it also must not strip
  // the group's only battle rez when that rule is active.
  const wantBloodlust = options.mustIncludeBloodlust;
  if (wantBloodlust && lustCount() === 0) {
    const protectSoleBr = options.mustIncludeBattleRez && brHolders().length === 1;
    const poolFor = (a: Assignment): Spec[] =>
      candidates(a.role, true, a).filter(
        (s) =>
          !(options.maxOneAug && isAug(s) && assignments.some((x) => x !== a && isAug(x.spec))) &&
          !(protectSoleBr && s.battleRez),
      );
    const swappable = assignments.filter((a) => !pinnedAssignments.has(a) && poolFor(a).length > 0);
    if (swappable.length === 0) {
      if (!hasPins) throw new Error('Could not satisfy the bloodlust requirement');
    } else {
      const target = pick(swappable, rng);
      usedSpecs.delete(key(target.spec));
      usedClasses.delete(target.spec.class);
      target.spec = pick(poolFor(target), rng);
      reserve(target.spec);
    }
  }

  // Ensure a battle rez (Death Knight / Druid) without disturbing lust rules:
  // never convert away the group's only luster.
  if (options.mustIncludeBattleRez && brHolders().length === 0) {
    const protectSoleLust = wantBloodlust && lustHolders().length === 1;
    const poolFor = (a: Assignment): Spec[] =>
      candidates(a.role, false, a).filter((s) => s.battleRez);
    const swappable = assignments.filter(
      (a) => !(protectSoleLust && a.spec.bloodlust) && !pinnedAssignments.has(a) && poolFor(a).length > 0,
    );
    if (swappable.length === 0) {
      if (!hasPins) throw new Error('Could not satisfy the battle rez requirement');
    } else {
      const target = pick(swappable, rng);
      usedSpecs.delete(key(target.spec));
      usedClasses.delete(target.spec.class);
      target.spec = pick(poolFor(target), rng);
      reserve(target.spec);
    }
  }

  return assignments;
}
