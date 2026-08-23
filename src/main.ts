import './style.css';
import { assignGroup, type Assignment, type Spec } from './logic';

interface SpecsFile {
  specializations: Spec[];
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

const form = document.querySelector<HTMLFormElement>('#setup')!;
const playersList = document.querySelector<HTMLUListElement>('#players')!;
const noDupesInput = document.querySelector<HTMLInputElement>('#opt-no-dupes')!;
const noDupeClassesInput = document.querySelector<HTMLInputElement>('#opt-no-dupe-classes')!;
const mustLustInput = document.querySelector<HTMLInputElement>('#opt-must-lust')!;
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

function renderCard(assignment: Assignment, index: number): string {
  const { playerName, spec } = assignment;
  const classColor = CLASS_COLORS[spec.class] ?? '#ffffff';
  const lustBadge = spec.bloodlust ? '<span class="badge lust" title="This spec can Bloodlust">🩸 Bloodlust</span>' : '';
  const subroleBadge = spec.subrole
    ? `<span class="badge subrole" title="Damage style">${spec.subrole === 'Melee' ? '🗡' : '🏹'} ${spec.subrole}</span>`
    : '';
  return `
    <article class="player-card role-${spec.role.toLowerCase()}" style="--class-color: ${classColor}; --stagger: ${index * 90}ms">
      <div class="player-name">${escapeHtml(playerName)}</div>
      <img class="spec-icon" src="${iconUrl(spec)}" alt="${escapeHtml(spec.name)} ${escapeHtml(spec.class)} icon" width="72" height="72" />
      <div class="spec-name">${escapeHtml(spec.name)}</div>
      <div class="class-name">${escapeHtml(spec.class)}</div>
      <div class="badges">
        <span class="badge role-badge">${ROLE_BADGES[spec.role] ?? spec.role}</span>
        ${subroleBadge}
        ${lustBadge}
      </div>
    </article>`;
}

function generate(): void {
  if (specs.length === 0) return;

  const names = [...playersList.querySelectorAll('input')].map((el) => el.value);
  let assignments: Assignment[];
  try {
    assignments = assignGroup(specs, names, {
      noDuplicates: noDupesInput.checked,
      noDuplicateClasses: noDupeClassesInput.checked,
      mustIncludeBloodlust: mustLustInput.checked,
      meleeCount: setMeleeInput.checked ? Number(rangeMeleeInput.value) : null,
      rangedCount: setRangedInput.checked ? Number(rangeRangedInput.value) : null,
    });
  } catch (err) {
    summaryEl.textContent =
      err instanceof Error ? err.message : 'Something went wrong while forging the group.';
    return;
  }

  cardsEl.innerHTML = assignments.map(renderCard).join('');
  resultsSection.hidden = false;

  const lusters = assignments.filter((a) => a.spec.bloodlust);
  summaryEl.innerHTML = lusters.length
    ? `🩸 Bloodlust provided by <strong>${lusters.map((a) => escapeHtml(a.playerName)).join('</strong>, <strong>')}</strong>`
    : 'No bloodlust in this group.';

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
  } catch (err) {
    console.error(err);
    summaryEl.textContent = 'Failed to load specs.json — is the dev server running?';
    resultsSection.hidden = false;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    generate();
  });

  rangeMeleeInput.addEventListener('input', syncDpsSliders);
  rangeRangedInput.addEventListener('input', syncDpsSliders);
  setMeleeInput.addEventListener('change', syncDpsSliders);
  setRangedInput.addEventListener('change', syncDpsSliders);
  syncDpsSliders();
}

void init();
