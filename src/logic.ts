export type Role = 'Tank' | 'Healer' | 'DPS';

export interface Spec {
  class: string;
  name: string;
  role: Role;
  bloodlust: boolean;
  /** Only present on DPS specs. */
  subrole?: 'Melee' | 'Ranged';
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
  /** Minimum melee DPS count, or null to leave unconstrained. */
  meleeCount: number | null;
  /** Minimum ranged DPS count, or null to leave unconstrained. */
  rangedCount: number | null;
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

  // Minimums: leftover DPS slots (if any) are unconstrained.
  const meleeMin = options.meleeCount;
  const rangedMin = options.rangedCount;
  if ((meleeMin ?? 0) + (rangedMin ?? 0) > 3) {
    throw new Error('Melee and ranged DPS amounts together cannot exceed 3');
  }

  const key = (spec: Spec) => `${spec.class}:${spec.name}`;
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
    if (pool.length === 0) throw new Error(`No specs available for ${what}`);
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
  const drawForRole = (role: Role): Spec =>
    role === 'DPS'
      ? drawFrom(candidates('DPS', false, undefined, dpsRequirements[dpsIndex++]), `role ${role}`)
      : drawFrom(candidates(role, false), `role ${role}`);

  const roles = shuffle(ROLE_SLOTS, rng);
  const names = normalizeNames(playerNames);

  const assignments: Assignment[] = roles.map((role, i) => ({
    playerName: names[i],
    role,
    spec: drawForRole(role),
  }));

  if (options.mustIncludeBloodlust && !assignments.some((a) => a.spec.bloodlust)) {
    const swappable = assignments.filter(
      (a) => candidates(a.role, true, a).length > 0,
    );
    if (swappable.length === 0) throw new Error('Could not satisfy the bloodlust requirement');
    const target = pick(swappable, rng);
    usedSpecs.delete(key(target.spec));
    usedClasses.delete(target.spec.class);
    target.spec = drawFrom(candidates(target.role, true, target), 'bloodlust swap');
  }

  return assignments;
}
