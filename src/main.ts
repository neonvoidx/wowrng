import './style.css';
import { assignGroup, type Assignment, type Options, type Spec } from './logic';

interface BuffInfo {
  name: string;
  blizzIcon: string;
  spellId?: number;
}

interface SpecsFile {
  specializations: Spec[];
  buffs: Record<string, BuffInfo>;
}

const CLASS_COLORS: Record<string, string> = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  Druid: '#FF7C0A',
  Evoker: '#33937F',
  Hunter: '#ABD473',
  Mage: '#3FC7EB',
  Monk: '#00FF96',
  Paladin: '#F48CBA',
  Priest: '#FFFFFF',
  Rogue: '#FFF468',
  Shaman: '#0070DD',
  Warlock: '#8788EE',
  Warrior: '#C69B6D',
};

const ROLE_BADGES: Record<string, string> = {
  Tank: '🛡 Tank',
  Healer: '✚ Healer',
  DPS: '⚔ DPS',
};

/** Small fast seeded PRNG so a URL seed reproduces the exact same group. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const form = document.querySelector<HTMLFormElement>('#setup')!;
const playersList = document.querySelector<HTMLUListElement | HTMLOListElement>('#players')!;
const otpToggles = [...playersList.querySelectorAll<HTMLInputElement>('.otp-toggle')];
const otpSelects = [...playersList.querySelectorAll<HTMLSelectElement>('.otp-select')];
const noDupesInput = document.querySelector<HTMLInputElement>('#opt-no-dupes')!;
const noDupeClassesInput = document.querySelector<HTMLInputElement>('#opt-no-dupe-classes')!;
const mustLustInput = document.querySelector<HTMLInputElement>('#opt-must-lust')!;
const maxOneAugInput = document.querySelector<HTMLInputElement>('#opt-max-one-aug')!;
const mustBattleRezInput = document.querySelector<HTMLInputElement>('#opt-must-battle-rez')!;
const limitSpecsInput = document.querySelector<HTMLInputElement>('#opt-limit-specs')!;
const specListEl = document.querySelector<HTMLDivElement>('#spec-list')!;
const specAllButton = document.querySelector<HTMLButtonElement>('#spec-all')!;
const specNoneButton = document.querySelector<HTMLButtonElement>('#spec-none')!;
const specActionsEl = document.querySelector<HTMLDivElement>('.spec-actions')!;
const setMeleeInput = document.querySelector<HTMLInputElement>('#opt-set-melee')!;
const rangeMeleeInput = document.querySelector<HTMLInputElement>('#range-melee')!;
const outMeleeEl = document.querySelector<HTMLOutputElement>('#out-melee')!;
const rowMeleeEl = document.querySelector<HTMLDivElement>('#row-melee')!;
const setRangedInput = document.querySelector<HTMLInputElement>('#opt-set-ranged')!;
const rangeRangedInput = document.querySelector<HTMLInputElement>('#range-ranged')!;
const outRangedEl = document.querySelector<HTMLOutputElement>('#out-ranged')!;
const rowRangedEl = document.querySelector<HTMLDivElement>('#row-ranged')!;
const resultsSection = document.querySelector<HTMLElement>('#results')!;
const summaryEl = document.querySelector<HTMLParagraphElement>('#summary')!;
const cardsEl = document.querySelector<HTMLDivElement>('#cards')!;

let specs: Spec[] = [];
let buffCatalog: Record<string, BuffInfo> = {};

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function iconUrl(spec: Spec): string {
  return `${import.meta.env.BASE_URL}icons/${spec.icon}.jpg`;
}

function buffIconUrl(id: string): string {
  return `${import.meta.env.BASE_URL}icons/buff-${id}.jpg`;
}

function bringsFor(spec: Spec): { id: string; name: string }[] {
  const items: { id: string; name: string }[] = [];
  if (spec.bloodlust) {
    const id = spec.lustSpell ?? 'bloodlust';
    items.push({ id, name: buffCatalog[id]?.name ?? 'Bloodlust' });
  }
  if (spec.battleRez) {
    const id = spec.rezSpell ?? 'raise-ally';
    items.push({ id, name: buffCatalog[id]?.name ?? 'Battle Rez' });
  }
  for (const id of [...(spec.raidBuffs ?? []), ...(spec.utility ?? [])]) {
    const buff = buffCatalog[id];
    if (buff) items.push({ id, name: buff.name });
  }
  if (spec.selfRezSpell) {
    const buff = buffCatalog[spec.selfRezSpell];
    if (buff) items.push({ id: spec.selfRezSpell, name: buff.name });
  }
  return items;
}

function renderCard(assignment: Assignment, index: number, locked: boolean): string {
  const { playerName, spec } = assignment;
  const classColor = CLASS_COLORS[spec.class] ?? '#ffffff';
  const subroleBadge = spec.subrole
    ? `<span class="badge subrole" title="Damage style">${spec.subrole === 'Melee' ? '🗡' : '🏹'} ${spec.subrole}</span>`
    : '';
  const lustChip = spec.bloodlust
    ? '<span class="badge lust" title="Can cast a raid-wide haste cooldown">🩸 Bloodlust</span>'
    : '';
  const rezName = spec.battleRez
    ? (buffCatalog[spec.rezSpell ?? 'raise-ally']?.name ?? 'Raise Ally')
    : '';
  const rezChip = rezName
    ? `<span class="badge brez" title="${escapeHtml(rezName)}: resurrect an ally in combat"><img src="${buffIconUrl('battle-rez')}" alt="" width="14" height="14" loading="lazy" />Battle Rez</span>`
    : '';
  const selfRezChip =
    !rezChip && spec.selfRezSpell
      ? `<span class="badge brez" title="${escapeHtml(buffCatalog[spec.selfRezSpell]?.name ?? 'Reincarnation')}: return to life after death"><img src="${buffIconUrl(spec.selfRezSpell)}" alt="" width="14" height="14" loading="lazy" />Self Rez</span>`
      : '';
  const brings = bringsFor(spec)
    .map(({ id, name }) => {
      const inner = `<img src="${buffIconUrl(id)}" alt="" width="18" height="18" loading="lazy" /><span>${escapeHtml(name)}</span>`;
      const spellId = buffCatalog[id]?.spellId;
      const content = spellId
        ? `<a class="brings-link" href="https://www.wowhead.com/spell=${spellId}" data-wowhead="spell=${spellId}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : inner;
      return `<li>${content}</li>`;
    })
    .join('');
  return `
    <article class="player-card role-${spec.role.toLowerCase()}" style="--class-color: ${classColor}; --stagger: ${index * 90}ms">
      ${locked ? '<div class="otp-lock" title="One trick pony — locked spec">🔒</div>' : ''}
      <div class="player-name">${escapeHtml(playerName)}</div>
      <img class="spec-icon" src="${iconUrl(spec)}" alt="${escapeHtml(spec.name)} ${escapeHtml(spec.class)} icon" width="72" height="72" />
      <div class="spec-name">${escapeHtml(spec.name)}</div>
      <div class="class-name">${escapeHtml(spec.class)}</div>
      <div class="badges">
        <span class="badge role-badge">${ROLE_BADGES[spec.role] ?? spec.role}</span>
        ${subroleBadge}
        ${lustChip}
        ${rezChip}
        ${selfRezChip}
      </div>
      <div class="brings">
        <div class="brings-title">Brings</div>
        <ul class="brings-list">${brings}</ul>
      </div>
    </article>`;
}

const specKey = (spec: Spec): string => `${spec.class}:${spec.name}`;

function buildSpecList(): void {
  specListEl.innerHTML = '';

  const byClass = new Map<string, Spec[]>();
  for (const spec of specs) {
    const list = byClass.get(spec.class) ?? [];
    list.push(spec);
    byClass.set(spec.class, list);
  }

  for (const [className, classSpecs] of [...byClass.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const group = document.createElement('div');
    group.className = 'spec-group';
    group.style.setProperty('--class-color', CLASS_COLORS[className] ?? '#ffffff');

    const title = document.createElement('div');
    title.className = 'spec-group-title';
    title.textContent = className;
    group.append(title);

    const items = document.createElement('div');
    items.className = 'spec-group-items';
    for (const spec of classSpecs) {
      const label = document.createElement('label');
      label.className = 'option spec-check';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.key = specKey(spec);

      const icon = document.createElement('img');
      icon.src = iconUrl(spec);
      icon.alt = '';
      icon.width = 20;
      icon.height = 20;
      icon.loading = 'lazy';

      const text = document.createElement('span');
      text.textContent = spec.name;

      label.append(checkbox, icon, text);
      items.append(label);
    }
    group.append(items);
    specListEl.append(group);
  }
}

function activeSpecs(): Spec[] {
  if (!limitSpecsInput.checked) return specs;
  const excluded = new Set(
    [...specListEl.querySelectorAll<HTMLInputElement>('input:not(:checked)')].map(
      (el) => el.dataset.key,
    ),
  );
  return specs.filter((s) => !excluded.has(specKey(s)));
}

function optionsFromUi(): Options {
  return {
    noDuplicates: noDupesInput.checked,
    noDuplicateClasses: noDupeClassesInput.checked,
    mustIncludeBloodlust: mustLustInput.checked,
    maxOneAug: maxOneAugInput.checked,
    mustIncludeBattleRez: mustBattleRezInput.checked,
    meleeCount: setMeleeInput.checked ? Number(rangeMeleeInput.value) : null,
    rangedCount: setRangedInput.checked ? Number(rangeRangedInput.value) : null,
    pins: pinsFromUi(),
  };
}

/** One-trick spec keys per player, or null when unticked/unselected. */
function pinsFromUi(): (string | null)[] {
  return otpToggles.map((toggle, i) =>
    toggle.checked && otpSelects[i].value ? otpSelects[i].value : null,
  );
}

/** Fill every OTP dropdown with all specs grouped by class. */
function buildOtpSelects(): void {
  const byClass = new Map<string, Spec[]>();
  for (const spec of specs) {
    const list = byClass.get(spec.class) ?? [];
    list.push(spec);
    byClass.set(spec.class, list);
  }
  for (const select of otpSelects) {
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.hidden = true;
    placeholder.textContent = 'Pick a spec';
    select.append(placeholder);
    for (const [className, classSpecs] of [...byClass.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const group = document.createElement('optgroup');
      group.label = className;
      for (const spec of classSpecs) {
        const option = document.createElement('option');
        option.value = specKey(spec);
        option.textContent = `${spec.name} (${spec.role})`;
        group.append(option);
      }
      select.append(group);
    }
  }
}

/** Rule defaults as shipped in the HTML; matching values stay out of the URL. */
const DEFAULTS = {
  d: noDupesInput.checked,
  dc: noDupeClassesInput.checked,
  l: mustLustInput.checked,
  aug: maxOneAugInput.checked,
  br: mustBattleRezInput.checked,
  ls: limitSpecsInput.checked,
};

/** Seed of the group currently shown; kept in the URL until the next
 *  generation replaces it, even while rules/names are tweaked afterwards. */
let activeSeed: number | undefined;

/** Mirror the current rules/names/limits into the query string, including the
 *  active group seed when one exists. */
function writeParams(): void {
  const opts = optionsFromUi();
  const p = new URLSearchParams();
  if (opts.noDuplicates !== DEFAULTS.d) p.set('d', opts.noDuplicates ? '1' : '0');
  if (opts.noDuplicateClasses !== DEFAULTS.dc) p.set('dc', opts.noDuplicateClasses ? '1' : '0');
  if (opts.mustIncludeBloodlust !== DEFAULTS.l) p.set('l', opts.mustIncludeBloodlust ? '1' : '0');
  if (opts.maxOneAug !== DEFAULTS.aug) p.set('aug', opts.maxOneAug ? '1' : '0');
  if (opts.mustIncludeBattleRez !== DEFAULTS.br) {
    p.set('br', opts.mustIncludeBattleRez ? '1' : '0');
  }
  if (setMeleeInput.checked) {
    // Off is the checkbox's default state, so only "on" needs encoding.
    p.set('me', '1');
    p.set('mv', String(opts.meleeCount));
  }
  if (setRangedInput.checked) {
    p.set('ra', '1');
    p.set('rv', String(opts.rangedCount));
  }
  if (limitSpecsInput.checked) {
    p.set('ls', '1');
    const excluded = [
      ...specListEl.querySelectorAll<HTMLInputElement>('input:not(:checked)'),
    ]
      .map((el) => el.dataset.key ?? '')
      .filter(Boolean);
    if (excluded.length > 0) p.set('ex', excluded.join(','));
  }
  [...(playersList.querySelectorAll<HTMLInputElement>('.player-name'))].forEach((el, i) => {
    const name = el.value.trim();
    if (name.length > 0) p.set(`p${i}`, name);
  });
  pinsFromUi().forEach((pin, i) => {
    if (pin) p.set(`t${i}`, pin);
  });
  if (activeSeed !== undefined) p.set('seed', String(activeSeed));

  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

/** Restore UI state from the query string; returns the seed to auto-generate
 *  with, if one is present. */
function applyUrlState(): number | undefined {
  const params = new URLSearchParams(location.search);
  if ([...params.keys()].length === 0) return undefined;

  const bool = (key: string, input: HTMLInputElement): void => {
    const value = params.get(key);
    if (value !== null) input.checked = value === '1';
  };
  bool('d', noDupesInput);
  bool('dc', noDupeClassesInput);
  bool('l', mustLustInput);
  bool('aug', maxOneAugInput);
  bool('br', mustBattleRezInput);
  bool('ls', limitSpecsInput);

  const slider = (
    enableKey: string,
    valueKey: string,
    enable: HTMLInputElement,
    range: HTMLInputElement,
  ): void => {
    const enabled = params.get(enableKey);
    if (enabled !== null) enable.checked = enabled === '1';
    const value = params.get(valueKey);
    if (enable.checked && value !== null && Number.isFinite(Number(value))) {
      range.value = String(Math.min(3, Math.max(0, Math.round(Number(value)))));
    }
  };
  slider('me', 'mv', setMeleeInput, rangeMeleeInput);
  slider('ra', 'rv', setRangedInput, rangeRangedInput);

  const nameInputs = playersList.querySelectorAll<HTMLInputElement>('.player-name');
  for (let i = 0; i < nameInputs.length; i++) {
    const name = params.get(`p${i}`);
    if (name !== null) nameInputs[i].value = name;
  }

  for (let i = 0; i < otpSelects.length; i++) {
    const trick = params.get(`t${i}`);
    const known = trick !== null && [...otpSelects[i].options].some((o) => o.value === trick);
    otpToggles[i].checked = known;
    if (known && trick !== null) {
      otpSelects[i].value = trick;
      otpSelects[i].hidden = false;
    } else {
      otpSelects[i].value = '';
      otpSelects[i].hidden = true;
    }
  }

  const excludedParam = params.get('ex');
  if (excludedParam !== null) {
    const excluded = new Set(excludedParam.split(','));
    for (const box of specListEl.querySelectorAll<HTMLInputElement>('input')) {
      box.checked = !excluded.has(box.dataset.key ?? '');
    }
  }

  syncDpsSliders();
  // Checkbox state was set directly above (no change event fires), so mirror
  // the spec-list visibility here too.
  specListEl.hidden = !limitSpecsInput.checked;
  specActionsEl.hidden = !limitSpecsInput.checked;

  const rawSeed = Number(params.get('seed'));
  return Number.isInteger(rawSeed) && rawSeed > 0 ? rawSeed : undefined;
}

function clearResults(): void {
  cardsEl.innerHTML = '';
  resultsSection.hidden = true;
}

function setSummary(messages: string[], warning = false): void {
  summaryEl.classList.toggle('warning', warning);
  summaryEl.innerHTML = messages
    .map((m) => `<span class="summary-line">${escapeHtml(m)}</span>`)
    .join('');
}

function generate(seedOverride?: number): void {
  if (specs.length === 0) return;

  const pins = pinsFromUi();
  const pool = activeSpecs();
  // A one-trick spec applies even when excluded by "Limit specializations":
  // it is added solely for that player (assignGroup removes pinned specs from
  // the draw pools, so nobody else can receive it).
  for (const pin of pins) {
    if (!pin || pool.some((s) => specKey(s) === pin)) continue;
    const spec = specs.find((s) => specKey(s) === pin);
    if (spec) pool.push(spec);
  }
  if (pool.length === 0) {
    setSummary(['No specializations selected.']);
    clearResults();
    return;
  }

  const seed = seedOverride ?? Math.floor(Math.random() * 0x7fffffff);
  const names = [...playersList.querySelectorAll<HTMLInputElement>('.player-name')].map((el) => el.value);

  // Soften rules that the selected pool makes impossible, and say so. Pinned
  // players do not draw from the pool, so they lower how many specs are needed.
  const opts = optionsFromUi();
  const warnings: string[] = [];
  const drawsNeeded = 5 - pins.filter(Boolean).length;

  if (opts.mustIncludeBloodlust && !pool.some((s) => s.bloodlust)) {
    opts.mustIncludeBloodlust = false;
    warnings.push(
      "“Must include bloodlust” was ignored: none of your selected specializations provide bloodlust.",
    );
  }
  if (opts.mustIncludeBattleRez && !pool.some((s) => s.battleRez)) {
    opts.mustIncludeBattleRez = false;
    warnings.push(
      "“Must have battle rez” was ignored: none of your selected specializations can resurrect allies.",
    );
  }
  if (opts.noDuplicates && pool.length < drawsNeeded) {
    opts.noDuplicates = false;
    warnings.push(
      `“No duplicate specializations” was ignored: you selected only ${pool.length} specialization${pool.length === 1 ? '' : 's'}, but ${drawsNeeded} are needed.`,
    );
  }
  if (opts.noDuplicateClasses && new Set(pool.map((s) => s.class)).size < drawsNeeded) {
    opts.noDuplicateClasses = false;
    warnings.push(
      `“No duplicate classes” was ignored: you selected fewer than ${drawsNeeded} distinct classes.`,
    );
  }

  let assignments: Assignment[];
  try {
    assignments = assignGroup(pool, names, opts, mulberry32(seed));
  } catch (err) {
    setSummary([err instanceof Error ? err.message : 'Something went wrong while forging the group.']);
    clearResults();
    return;
  }

  cardsEl.innerHTML = assignments.map((a, i) => renderCard(a, i, pins[i] !== null)).join('');
  // Ask Wowhead's tooltip widget to scan the freshly injected links (harmless
  // no-op if the widget script has not loaded, e.g. offline).
  (window as unknown as { $WowheadPower?: { refreshLinks?: () => void } }).$WowheadPower?.refreshLinks?.();
  resultsSection.hidden = false;
  setSummary(warnings, true);
  activeSeed = seed;
  writeParams();

  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function syncDpsSliders(): void {
  // Sliders stay hidden until their checkbox is ticked.
  rowMeleeEl.hidden = !setMeleeInput.checked;
  rowRangedEl.hidden = !setRangedInput.checked;

  if (setMeleeInput.checked && setRangedInput.checked) {
    // Cap each slider by what's left of the 3 DPS slots.
    rangeRangedInput.max = String(3 - Number(rangeMeleeInput.value));
    rangeMeleeInput.max = String(3 - Number(rangeRangedInput.value));
    if (Number(rangeRangedInput.value) > Number(rangeRangedInput.max)) {
      rangeRangedInput.value = rangeRangedInput.max;
    }
    if (Number(rangeMeleeInput.value) > Number(rangeMeleeInput.max)) {
      rangeMeleeInput.value = rangeMeleeInput.max;
    }
  } else {
    rangeMeleeInput.max = '3';
    rangeRangedInput.max = '3';
  }

  outMeleeEl.textContent = rangeMeleeInput.value;
  outRangedEl.textContent = rangeRangedInput.value;
}

async function init(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}specs.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as SpecsFile;
    specs = data.specializations;
    buffCatalog = data.buffs ?? {};
  } catch (err) {
    console.error(err);
    setSummary(['Failed to load specs.json — is the dev server running?']);
    resultsSection.hidden = false;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    generate();
  });

  rangeMeleeInput.addEventListener('input', () => {
    syncDpsSliders();
    writeParams();
  });
  rangeRangedInput.addEventListener('input', () => {
    syncDpsSliders();
    writeParams();
  });
  setMeleeInput.addEventListener('change', () => {
    syncDpsSliders();
    writeParams();
  });
  setRangedInput.addEventListener('change', () => {
    syncDpsSliders();
    writeParams();
  });

  limitSpecsInput.addEventListener('change', () => {
    specListEl.hidden = !limitSpecsInput.checked;
    specActionsEl.hidden = !limitSpecsInput.checked;
    writeParams();
  });

  for (const [button, checked] of [
    [specAllButton, true],
    [specNoneButton, false],
  ] as const) {
    button.addEventListener('click', () => {
      for (const box of specListEl.querySelectorAll<HTMLInputElement>('input')) box.checked = checked;
      writeParams();
    });
  }
  specListEl.addEventListener('change', () => writeParams());

  for (const input of [
    noDupesInput,
    noDupeClassesInput,
    mustLustInput,
    maxOneAugInput,
    mustBattleRezInput,
  ]) {
    input.addEventListener('change', () => writeParams());
  }
  playersList.addEventListener('input', () => writeParams());

  otpToggles.forEach((toggle, i) => {
    toggle.addEventListener('change', () => {
      otpSelects[i].hidden = !toggle.checked;
      writeParams();
    });
  });
  for (const select of otpSelects) {
    select.addEventListener('change', () => writeParams());
  }

  buildSpecList();
  buildOtpSelects();
  syncDpsSliders();

  // Touch devices: a tap emulates hover (Wowhead's widget then shows the
  // tooltip), so swallow the click to avoid navigating away mid-inspection.
  if (window.matchMedia('(hover: none)').matches) {
    cardsEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a.brings-link')) e.preventDefault();
    });
  }

  // Restore a shared link (rules, names, limits) after the DOM is built; a
  // seed in the URL replays the exact same generated group.
  const urlSeed = applyUrlState();
  if (urlSeed !== undefined) generate(urlSeed);
}

void init();
