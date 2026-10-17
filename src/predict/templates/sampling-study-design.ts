// Templates for the topic "Sampling & study design" (QM1 past exams: name the sampling method of a plan, match plans
// to sampling methods (2024 single choice, 2025 matching), bias in surveys, population / sampling frame / sample /
// parameter / statistic, the anatomy of an experiment (treatment, unit, response, blocking; 2025 matching), and what
// random sampling, random assignment, placebos, blinding and blocking do and do not achieve).
// Conceptual keys come from the label the generator used to write each text (method, bias, role, design flags); the
// test file labels every printed text a second time with its own rules. Counts (systematic and proportional stratified
// samples, number of treatments and units) are computed here and recounted by brute force in the test.
import { INSTRUCTION, buildMatching, buildMcq, buildMulti, mistakesNote, num, numericField, type Choice } from '../build';
import type { Rng } from '../rng';
import { sum } from '../stats';
import type { Template } from '../types';
import { cap, listText } from './_dist';

const TOPIC = 'Sampling & study design' as const;
const ROMAN = ['I', 'II', 'III', 'IV'];
const reasonsNote = (rs: { id: string; correct: boolean; why: string }[]) =>
  '\n\n**Option by option**\n' + rs.map((r) => `- **${r.id}** ${r.correct ? '(correct)' : '(wrong)'}: ${r.why}`).join('\n');
export const ord = (j: number) => `${j}${[11, 12, 13].includes(j % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[j % 10] ?? 'th'}`;
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** A whole-number answer (no tolerance). */
const whole = (x: number) => {
  const f = numericField('n', undefined, x, 0);
  return { correctAnswer: f.answer, tolerance: f.tolerance };
};
const orText = (xs: readonly string[]) => `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
/** The picked items in the order of the full list (e.g. rising times 2, 8, 24 hours instead of 24, 2, 8). */
const inOrder = <T>(all: readonly T[], picked: readonly T[]) => all.filter((x) => picked.includes(x));

// =====================================================================================================================
// 1. Sampling methods
// =====================================================================================================================

export type Method = 'srs' | 'stratified' | 'cluster' | 'multistage' | 'systematic' | 'convenience' | 'voluntary';
const METHODS: Method[] = ['srs', 'stratified', 'cluster', 'multistage', 'systematic', 'convenience', 'voluntary'];
export const METHOD_NAME: Record<Method, string> = {
  srs: 'Simple random sampling',
  stratified: 'Stratified sampling',
  cluster: 'Cluster sampling',
  multistage: 'Multi-stage sampling',
  systematic: 'Systematic sampling',
  convenience: 'Convenience sampling',
  voluntary: 'Voluntary response sampling',
};
const SHORT = (m: Method) => lc(METHOD_NAME[m]).replace(' sampling', '');
const METHOD_DEF: Record<Method, string> = {
  srs: 'the whole sample is drawn in one random draw from a list of the entire population, so every possible set of that size has the same chance',
  stratified: 'the population is first split into groups (strata) and a separate random sample is drawn from *every* group',
  cluster: 'a few groups (clusters) are drawn at random and *everyone* in the chosen groups is included',
  multistage: 'groups are drawn at random first, and then a random sample is drawn *within* each chosen group',
  systematic: 'after a random start, every $k$-th name on an ordered list is taken',
  convenience: 'the researcher simply takes the people who are easiest to reach',
  voluntary: 'people decide themselves whether they take part',
};
/** Wrong methods in order of how often they are confused with the true one. */
const CONFUSE: Record<Method, Method[]> = {
  srs: ['stratified', 'systematic', 'multistage', 'cluster', 'convenience'],
  stratified: ['cluster', 'multistage', 'srs', 'systematic', 'convenience'],
  cluster: ['stratified', 'multistage', 'srs', 'convenience', 'systematic'],
  multistage: ['cluster', 'stratified', 'srs', 'systematic', 'convenience'],
  systematic: ['srs', 'stratified', 'cluster', 'convenience', 'multistage'],
  convenience: ['voluntary', 'srs', 'cluster', 'systematic', 'stratified'],
  voluntary: ['convenience', 'srs', 'stratified', 'cluster', 'systematic'],
};
const methodWhy = (truth: Method, w: Method) => `${METHOD_NAME[w]} would mean that ${METHOD_DEF[w]}; in this plan ${METHOD_DEF[truth]}.`;

interface Pop {
  intro: string;
  member: string;
  members: string;
  groups: string;
  G: [number, number];
  strat: string;
  strata: string[];
  list: string;
  conv: (n: number) => string;
  vol: string;
}
const POPS: Pop[] = [
  {
    intro: 'A national chain of bakeries wants to know how its staff feel about a new rota system.',
    member: 'employee', members: 'employees', groups: 'shops', G: [40, 70], strat: 'job type', strata: ['bakers', 'shop assistants', 'delivery drivers'], list: 'the payroll list',
    conv: (n) => `The HR manager interviews the first ${n} employees she meets in the canteen of the head office.`,
    vol: 'A link to an online questionnaire is posted in the staff newsletter, and every employee who decides to fill it in is included.',
  },
  {
    intro: 'The Guild of Wizards wants to estimate how many hours per week its members spend practising spells.',
    member: 'wizard', members: 'wizards', groups: 'wizard towers', G: [20, 40], strat: 'speciality', strata: ['fire mages', 'healers', 'illusionists', 'alchemists'], list: 'the guild register',
    conv: (n) => `The guild secretary questions the first ${n} wizards who walk into the Grand Library on Monday morning.`,
    vol: 'A questionnaire is pinned to the notice board of the Grand Library, and every wizard who decides to fill it in is included.',
  },
  {
    intro: 'The organisers of a large music festival want to know how satisfied campers are with the showers and toilets.',
    member: 'camper', members: 'campers', groups: 'camping fields', G: [20, 36], strat: 'ticket type', strata: ['regular-ticket holders', 'VIP-ticket holders', 'crew-pass holders'], list: 'the ticket database',
    conv: (n) => `A staff member asks the first ${n} campers who pass the information tent on Saturday morning.`,
    vol: 'A message in the festival app invites campers to rate the facilities, and every camper who decides to respond is included.',
  },
  {
    intro: 'A provincial library service wants to know how satisfied its members are with the opening hours.',
    member: 'library member', members: 'library members', groups: 'branch libraries', G: [24, 40], strat: 'membership type', strata: ['youth members', 'adult members', 'senior members'], list: 'the membership database',
    conv: (n) => `A librarian asks the first ${n} members who return a book at the central library on Saturday.`,
    vol: 'A poster in every branch invites members to give their opinion on the library website, and every member who decides to respond is included.',
  },
  {
    intro: 'A water company wants to estimate the average daily water use of the households in its region.',
    member: 'household', members: 'households', groups: 'villages', G: [30, 50], strat: 'type of home', strata: ['households in apartments', 'households in terraced houses', 'households in detached houses'], list: 'the customer register',
    conv: (n) => `An employee visits the first ${n} households on the streets closest to the company's main office.`,
    vol: 'An advertisement in the local paper asks households to report their water use online, and every household that decides to respond is included.',
  },
];

interface Draw { G: number; n: number; c: number; m: number; k: number }
function plan(meth: Method, p: Pop, d: Draw, rng: Rng): string {
  switch (meth) {
    case 'srs':
      return rng.pick([
        `Every ${p.member} in ${p.list} gets a number, and a random number generator picks ${d.n} different numbers; those ${p.members} are surveyed.`,
        `All names in ${p.list} go into a computer lottery, which draws ${d.n} names completely at random in one go.`,
      ]);
    case 'stratified':
      return rng.chance(0.5)
        ? `The ${p.members} are first divided by ${p.strat} into ${listText(p.strata)}; then ${d.m} ${p.members} are drawn at random from each of these ${p.strata.length} groups.`
        : `From every one of the ${d.G} ${p.groups}, ${d.m} ${p.members} are drawn at random.`;
    case 'cluster':
      return `${d.c} of the ${d.G} ${p.groups} are chosen at random, and all ${p.members} in these ${d.c} ${p.groups} are surveyed.`;
    case 'multistage':
      return `${d.c} of the ${d.G} ${p.groups} are chosen at random; next, ${d.m} ${p.members} are chosen at random within each of these ${d.c} ${p.groups}.`;
    case 'systematic':
      return `${cap(p.list)} is sorted alphabetically; one of the first ${d.k} names is chosen at random, and from there every ${ord(d.k)} name on the list is selected.`;
    case 'convenience':
      return p.conv(d.n);
    case 'voluntary':
      return p.vol;
  }
}
const draw = (rng: Rng, p: Pop): Draw => ({
  G: rng.int(...p.G),
  n: rng.pick([50, 60, 80, 100, 120, 150, 200]),
  c: rng.int(3, 8),
  m: rng.pick([5, 8, 10, 12, 15, 20]),
  k: rng.pick([10, 12, 15, 20, 25, 40, 50]),
});
/** k distinct methods, at least two of the easily confused group-based ones (as in the past exams). */
function pickMethods(rng: Rng, k: number): Method[] {
  const group = rng.sample(['stratified', 'cluster', 'multistage'] as Method[], rng.int(2, 3));
  return rng.shuffle([...group, ...rng.sample(['srs', 'systematic', 'convenience', 'voluntary'] as Method[], k - group.length)]);
}
const defLine = (m: Method) => `**${METHOD_NAME[m]}**: ${METHOD_DEF[m]}.`;

const samplingMethod: Template = {
  id: 'sampling-study-design.sampling-method',
  topic: TOPIC,
  title: 'Name the sampling method of a plan, match plans to methods, or count a systematic / proportional stratified sample',
  types: ['single-choice', 'matching', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const p = rng.pick(POPS);
    const d = draw(rng, p);
    if (type === 'numeric') {
      if (rng.chance(0.5)) {
        const n = rng.pick([40, 50, 60, 80, 100, 120]);
        const k = rng.pick([12, 15, 20, 25, 30, 40]);
        const N = n * k;
        const r = rng.int(2, k - 1);
        const j = rng.pick([3, 4, 5, 6, 8, 10, n]);
        const ans = r + (j - 1) * k;
        const which = j === n ? 'last' : ord(j);
        return {
          type,
          stem: `${p.intro} ${cap(p.list)} contains ${N} ${p.members}, numbered from 1 to ${N}. A systematic sample of ${n} ${p.members} is drawn from this list, and the randomly chosen starting point is number ${r}.\nWhat is the number of the ${which} ${p.member} in the sample?`,
          instruction: INSTRUCTION.numeric(0),
          ...whole(ans),
          explanation:
            `In systematic sampling the list is split into ${n} equal blocks, so the sampling interval is $k = \\dfrac{N}{n} = \\dfrac{${N}}{${n}} = ${k}$. ` +
            `After the random start ${r}, every ${ord(k)} number is taken: ${r}, ${r + k}, ${r + 2 * k}, …\n` +
            `The ${which} selected number is $${r} + (${j} - 1) \\cdot ${k} = ${ans}$.\n\n` +
            `Common slips: using $${r} + ${j} \\cdot ${k} = ${r + j * k}$ (one step too many), or taking $k = ${n}$ (the sample size instead of $N/n$).`,
        };
      }
      const f = rng.pick([20, 25, 40, 50]);
      let nh: number[];
      do nh = p.strata.map(() => rng.int(3, 30));
      while (new Set(nh).size < nh.length);
      const Nh = nh.map((x) => x * f);
      const N = sum(Nh);
      const n = sum(nh);
      const i = rng.int(0, p.strata.length - 1);
      return {
        type,
        stem:
          `${p.intro} ${cap(p.list)} contains ${N} ${p.members}: ${listText(Nh.map((x, h) => `${x} ${p.strata[h]}`))}. ` +
          `A stratified sample of ${n} ${p.members} is drawn with ${p.strat} as the strata, and every stratum is represented in proportion to its size.\nHow many ${p.strata[i]} are in the sample?`,
        instruction: INSTRUCTION.numeric(0),
        ...whole(nh[i]),
        explanation:
          `With proportional allocation every stratum gets the same sampling fraction $\\dfrac{n}{N} = \\dfrac{${n}}{${N}} = ${num(n / N, 4)}$ (here: 1 in ${f}).\n` +
          `So the number of ${p.strata[i]} in the sample is $${n} \\cdot \\dfrac{${Nh[i]}}{${N}} = ${nh[i]}$.\n` +
          `Check: ${nh.join(' + ')} = ${n}, the full sample.\n\n` +
          `Common slip: splitting the sample equally over the ${p.strata.length} strata ($${n}/${p.strata.length} \\approx ${num(n / p.strata.length, 1)}$) ignores that the strata have different sizes.`,
      };
    }
    if (type === 'matching') {
      const ms = pickMethods(rng, rng.int(3, 4));
      const extra = rng.sample(METHODS.filter((m) => !ms.includes(m)), rng.int(1, 2));
      const plans = ms.map((m) => plan(m, p, d, rng));
      const mm = buildMatching(rng, ms.map((m, i) => ({ prompt: plans[i], answer: METHOD_NAME[m] })), extra.map((m) => METHOD_NAME[m]));
      return {
        type,
        stem: `${p.intro} The ${p.members} are spread over ${d.G} ${p.groups}. The research team considers the ${ms.length} plans below for selecting respondents.\nMatch each plan with the sampling method it uses.`,
        instruction: INSTRUCTION.matching,
        prompts: mm.prompts,
        choices: mm.choices,
        correctAnswer: mm.correctAnswer,
        explanation:
          ms.map((m, i) => `- Plan ${i + 1} ("${plans[i].split(' ').slice(0, 9).join(' ')} …") is **${lc(METHOD_NAME[m])}**: ${METHOD_DEF[m]}.`).join('\n') +
          `\n\nThe key difference: stratified sampling samples *within every* group, cluster sampling takes *everyone* in a *few random* groups, and multi-stage sampling takes a random sample within a few random groups. ` +
          `${cap(listText(extra.map((m) => lc(METHOD_NAME[m]))))} ${extra.length > 1 ? 'are' : 'is'} not used.`,
      };
    }
    if (rng.chance(0.6)) {
      const meth = rng.pick(METHODS);
      const text = plan(meth, p, d, rng);
      const mcq = buildMcq(rng, { text: METHOD_NAME[meth] }, CONFUSE[meth].map((w) => ({ text: METHOD_NAME[w], why: methodWhy(meth, w) })), { count: optionCount });
      const lead = rng.pick(['The sample is selected as follows.', 'The research team proposes the following plan.', 'Respondents are selected like this:']);
      return {
        type,
        stem: `${p.intro} ${lead}\n${text}\nWhich sampling method is used here?`,
        options: mcq.options,
        correctAnswer: mcq.correctAnswer,
        explanation: `In this plan ${METHOD_DEF[meth]}: this is **${lc(METHOD_NAME[meth])}**.\n\nCompare: ${defLine(CONFUSE[meth][0])}${mistakesNote(mcq.distractors)}`,
      };
    }
    // single choice in the 2024 style: four plans, options are complete assignments
    const ms = pickMethods(rng, 4);
    const plans = ms.map((m) => plan(m, p, d, rng));
    const label = (q: Method[]) => q.map((m, i) => `${ROMAN[i]}: ${SHORT(m)}`).join(', ');
    const swaps: (Choice & { score: number })[] = [];
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        const q = [...ms];
        [q[i], q[j]] = [q[j], q[i]];
        swaps.push({ text: label(q), why: `swaps plans ${ROMAN[i]} and ${ROMAN[j]}: ${ROMAN[i]} is ${SHORT(ms[i])} and ${ROMAN[j]} is ${SHORT(ms[j])} sampling.`, score: CONFUSE[ms[i]].indexOf(ms[j]) + CONFUSE[ms[j]].indexOf(ms[i]) + rng.next() });
      }
    swaps.sort((a, b) => a.score - b.score);
    const mcq = buildMcq(rng, { text: label(ms) }, swaps.map(({ text, why }) => ({ text, why })), {
      count: optionCount,
      fallback: (t) => {
        const q = [...ms];
        const [a, b, c] = [t % 4, (t + 1) % 4, (t + 2) % 4];
        [q[a], q[b], q[c]] = [ms[c], ms[a], ms[b]];
        return { text: label(q), why: 'mixes up three of the plans.' };
      },
    });
    return {
      type,
      stem: `${p.intro} The ${p.members} are spread over ${d.G} ${p.groups}. Four plans for selecting respondents are proposed:\n${plans.map((t, i) => `(${ROMAN[i]}) ${t}`).join('\n')}\nWhich option names the sampling method of every plan correctly?`,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation: ms.map((m, i) => `- (${ROMAN[i]}) is **${SHORT(m)}** sampling: ${METHOD_DEF[m]}.`).join('\n') + `\n\nSo the correct option is **${label(ms)}**.${mistakesNote(mcq.distractors)}`,
    };
  },
};

// =====================================================================================================================
// 2. Bias in surveys; population, sampling frame, sample, parameter, statistic
// =====================================================================================================================

export type Bias = 'undercoverage' | 'nonresponse' | 'response' | 'voluntary' | 'none';
const BIASES: Bias[] = ['undercoverage', 'nonresponse', 'response', 'voluntary', 'none'];
export const BIAS_NAME: Record<Bias, string> = {
  undercoverage: 'Undercoverage',
  nonresponse: 'Nonresponse bias',
  response: 'Response bias',
  voluntary: 'Voluntary response bias',
  none: 'No bias: only sampling variability',
};
const BIAS_DEF: Record<Bias, string> = {
  undercoverage: 'part of the population is missing from the list the sample is drawn from, so it has no chance to be selected',
  nonresponse: 'a large part of the selected people do not answer, and those who answer may differ from those who do not',
  response: 'the answers themselves are inaccurate, for example because of a leading question, the person asking, or a question people prefer not to answer honestly',
  voluntary: 'people choose themselves whether to take part, so mainly those with strong opinions respond',
  none: 'the sample is drawn at random from a complete list and everyone answers honestly, so the result differs from the population value only by chance',
};
const CONF_B: Record<Bias, Bias[]> = {
  undercoverage: ['nonresponse', 'voluntary', 'none', 'response'],
  nonresponse: ['voluntary', 'undercoverage', 'none', 'response'],
  response: ['nonresponse', 'none', 'undercoverage', 'voluntary'],
  voluntary: ['nonresponse', 'undercoverage', 'response', 'none'],
  none: ['nonresponse', 'response', 'undercoverage', 'voluntary'],
};
const TOWNS = ['Maastricht', 'Heerlen', 'Venlo', 'Sittard', 'Roermond', 'Weert'];
const resp = (rng: Rng) => {
  const n = rng.pick([400, 500, 800, 1000, 1200, 1500]);
  const p = rng.int(9, 34);
  return { n, p, r: (n * p) / 100 };
};
const small = (rng: Rng) => rng.pick([150, 200, 250, 300, 400, 500]);

interface BiasCase { kind: Bias; text: (rng: Rng) => string; note: string }
export const BIAS_CASES: BiasCase[] = [
  { kind: 'undercoverage', text: (rng) => `To estimate the share of residents of ${rng.pick(TOWNS)} who take the bus at least once a week, the municipality draws a simple random sample of ${small(rng)} residents from its register of parking-permit holders. Everyone selected answers the question.`, note: 'residents without a parking permit (often exactly the people who take the bus) are not in the register, so they cannot be selected.' },
  { kind: 'undercoverage', text: (rng) => `A polling agency wants to know how many adults stream music every day. It calls ${small(rng)} numbers drawn at random from the landline telephone directory; someone picks up at every number and answers all the questions.`, note: 'many (especially younger) people only have a mobile phone and are not in the landline directory, so they cannot be selected.' },
  { kind: 'undercoverage', text: (rng) => `To learn how students rate the campus Wi-Fi, the IT department e-mails ${small(rng)} students drawn at random from the list of students who logged in to the campus Wi-Fi last week. Every selected student replies.`, note: 'students who did not use the Wi-Fi last week (perhaps because it works badly for them) are not on the list.' },
  { kind: 'undercoverage', text: (rng) => `The Dwarf Council wants to know what all dwarves of the mountain think about a new tunnel tax. It draws ${small(rng)} names at random from the register of dwarves who own a mine, and each of them is interviewed anonymously.`, note: 'dwarves without a mine are not in the register, so they cannot be selected, and they may think differently about a tunnel tax.' },
  { kind: 'nonresponse', text: (rng) => { const v = resp(rng); return `A random sample of ${v.n} households is drawn from the complete address list of ${rng.pick(TOWNS)} and sent a twelve-page paper questionnaire about leisure time. Only ${v.r} households (${v.p}%) send it back, and the report is based on these.`; }, note: 'most selected households did not respond; busy households, for instance, rarely return a long questionnaire, so the households that did respond may not be representative.' },
  { kind: 'nonresponse', text: (rng) => { const v = resp(rng); return `For a study on working hours, ${v.n} nurses drawn at random from the staff list of a hospital are phoned at home between 10:00 and 12:00 on weekdays. Only ${v.r} of them (${v.p}%) can be reached and answer.`; }, note: 'nurses who work morning shifts are not at home when called, so the nurses who answer probably work different hours from those who do not.' },
  { kind: 'nonresponse', text: (rng) => { const v = resp(rng); return `An online shop e-mails a satisfaction questionnaire to ${v.n} customers drawn at random from its full customer file. Only ${v.r} customers (${v.p}%) fill it in.`; }, note: 'most selected customers did not respond, and those who do (often the very happy or very unhappy ones) may differ from the rest.' },
  { kind: 'response', text: (rng) => `A dentist draws ${small(rng)} patients at random from her patient records and, during their check-up, asks each of them in person how many times a week they floss. Every patient answers.`, note: 'patients asked by their own dentist tend to overstate how often they floss: the answers themselves are inaccurate.' },
  { kind: 'response', text: (rng) => `A cycling lobby asks ${small(rng)} randomly chosen residents of ${rng.pick(TOWNS)}: "Given the many dangerous accidents caused by cars, would you support more separated bike lanes?" Everyone answers.`, note: 'the question is leading: its wording pushes people towards "yes".' },
  { kind: 'response', text: (rng) => `The king's tax collector visits ${small(rng)} randomly chosen farms and asks each farmer, face to face, how much grain the farm harvested this year. All farmers answer.`, note: 'farmers who fear higher taxes tend to under-report their harvest: the answers are biased.' },
  { kind: 'response', text: (rng) => `A university picks ${small(rng)} students at random; each of them is asked by their own tutor, in a face-to-face conversation, how many hours they studied last week. All of them answer.`, note: 'students want to look good in front of their tutor and tend to overstate their study hours.' },
  { kind: 'voluntary', text: (rng) => `A TV talk show asks viewers to text YES or NO to the question whether fireworks should be banned. ${rng.int(20, 90) * 100} viewers send a text, and ${rng.int(55, 85)}% vote YES.`, note: 'viewers decide themselves whether to text; people with strong opinions are much more likely to take part.' },
  { kind: 'voluntary', text: (rng) => `A news website shows the poll "Should the centre of ${rng.pick(TOWNS)} become car-free?" next to an article. ${rng.int(8, 40) * 100} readers click an answer, and ${rng.int(25, 75)}% click yes.`, note: 'readers decide themselves whether to click; mostly people with strong feelings about cars respond.' },
  { kind: 'voluntary', text: (rng) => `A bakery chain prints a QR code on its receipts that invites customers to rate its new sourdough bread. ${rng.int(3, 12) * 100} customers scan the code and give a rating.`, note: 'customers decide themselves whether to rate; very enthusiastic or very disappointed customers are the most likely to do so.' },
  { kind: 'none', text: (rng) => `A phone company draws a simple random sample of ${small(rng)} customers from its complete customer list. All selected customers answer a neutral question anonymously, and ${rng.int(55, 85)}% say they are satisfied with their contract.`, note: 'the sample is drawn at random from a complete list, everyone answers, anonymously and to a neutral question. The estimate can still miss the true value, but only by chance.' },
  { kind: 'none', text: (rng) => `A university draws ${small(rng)} students at random from its complete student register. All of them fill in an anonymous online questionnaire with neutral questions about their commute, and ${rng.int(30, 70)}% say they travel by bike.`, note: 'the sample is drawn at random from a complete list and everyone answers neutral questions anonymously. The estimate can still miss the true value, but only by chance.' },
];
const biasWhy = (w: Bias, note: string) =>
  w === 'none' ? `overlooks the problem in how the data were collected: ${note}` : `${BIAS_NAME[w]} means that ${BIAS_DEF[w]}; that is not the main problem here: ${note}`;

const TERMS = ['Population', 'Sampling frame', 'Sample', 'Parameter', 'Statistic'] as const;
type Term = (typeof TERMS)[number];
type TermStory = (N: number, F: number, n: number, p: number) => { story: string } & Record<Term, string>;
const TERM_STORIES: TermStory[] = [
  (N, F, n, p) => ({
    story: `The board of a hockey club with ${N} members wants to know which share of its members would pay a higher fee for a new clubhouse. Only ${F} members have an e-mail address on file, so the board e-mails a short questionnaire to ${n} of them, chosen at random. Everyone replies, and ${p}% say they would pay more.`,
    Population: `All ${N} members of the hockey club`, 'Sampling frame': `The ${F} members with an e-mail address on file`, Sample: `The ${n} members who receive the questionnaire`,
    Parameter: `The share of all ${N} club members who would pay a higher fee`, Statistic: `The ${p}% of the e-mailed members who would pay more`,
  }),
  (N, F, n, p) => ({
    story: `The Elven Council wants to know which share of the ${N} elves of the Silver Forest would like a new bridge over the river. Its census scroll lists only ${F} of them, and the council's messengers visit ${n} elves drawn at random from the scroll. Of these elves, ${p}% want the bridge.`,
    Population: `All ${N} elves of the Silver Forest`, 'Sampling frame': `The census scroll with ${F} elves`, Sample: `The ${n} elves visited by the messengers`,
    Parameter: `The share of all ${N} elves who would like a bridge`, Statistic: `The ${p}% of the visited elves who want the bridge`,
  }),
  (N, F, n, p) => ({
    story: `A city wants to know which share of its ${N} restaurants would join a car-free Sunday market. Its licence register contains ${F} restaurants (the newest ones are still missing). The city phones ${n} restaurants picked at random from the register, and ${p}% of them would join.`,
    Population: `All ${N} restaurants in the city`, 'Sampling frame': `The licence register with ${F} restaurants`, Sample: `The ${n} restaurants that are phoned`,
    Parameter: `The share of all ${N} restaurants that would join the market`, Statistic: `The ${p}% of the phoned restaurants that would join`,
  }),
];

const surveyBias: Template = {
  id: 'sampling-study-design.survey-bias',
  topic: TOPIC,
  title: 'Main source of error in a survey (undercoverage, nonresponse, response, voluntary response, chance); population / frame / sample / parameter / statistic',
  types: ['single-choice', 'matching'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    if (type === 'matching' && rng.chance(0.35)) {
      const N = rng.int(40, 90) * 10;
      const F = N - rng.int(3, 15) * 10;
      const n = rng.pick([40, 50, 60, 80, 100]);
      const s = rng.pick(TERM_STORIES)(N, F, n, rng.int(15, 70));
      const asked = rng.sample(TERMS, rng.int(4, 5));
      const mm = buildMatching(rng, rng.shuffle(asked).map((t) => ({ prompt: s[t], answer: t })), [...TERMS]);
      return {
        type,
        stem: `${s.story}\nMatch each description with the correct term.`,
        instruction: INSTRUCTION.matching,
        prompts: mm.prompts,
        choices: mm.choices,
        correctAnswer: mm.correctAnswer,
        explanation:
          `- **Population**: everyone the question is about: ${lc(s.Population)}.\n- **Sampling frame**: the list the sample is actually drawn from: ${lc(s['Sampling frame'])}.\n` +
          `- **Sample**: the units that are actually selected: ${lc(s.Sample)}.\n- **Parameter**: a number describing the population (usually unknown): ${lc(s.Parameter)}.\n` +
          `- **Statistic**: a number computed from the sample, used to estimate the parameter: ${lc(s.Statistic)}.\n\n` +
          `Note that the frame (${F}) is smaller than the population (${N}): ${N - F} units cannot be selected at all, which is a risk of **undercoverage**.`,
      };
    }
    if (type === 'matching') {
      const kinds = rng.sample(BIASES, rng.int(3, 4));
      const cases = kinds.map((k) => rng.pick(BIAS_CASES.filter((c) => c.kind === k)));
      const texts = cases.map((c) => c.text(rng));
      const mm = buildMatching(rng, cases.map((c, i) => ({ prompt: texts[i], answer: BIAS_NAME[c.kind] })), BIASES.map((b) => BIAS_NAME[b]));
      return {
        type,
        stem: `A consumer organisation checks how ${cases.length} recent surveys were carried out (see the descriptions below). For each survey, choose the main reason why its result may differ from the true value in the population.`,
        instruction: INSTRUCTION.matching,
        prompts: mm.prompts,
        choices: mm.choices,
        correctAnswer: mm.correctAnswer,
        explanation: cases.map((c, i) => `- Survey ${i + 1}: **${BIAS_NAME[c.kind]}**. ${cap(c.note)}`).join('\n') + `\n\nDefinitions: ${BIASES.map((b) => `**${BIAS_NAME[b]}**: ${BIAS_DEF[b]}.`).join(' ')}`,
      };
    }
    const c = rng.pick(BIAS_CASES);
    const mcq = buildMcq(rng, { text: BIAS_NAME[c.kind] }, CONF_B[c.kind].map((w) => ({ text: BIAS_NAME[w], why: biasWhy(w, c.note) })), { count: optionCount });
    return {
      type,
      stem: `${c.text(rng)}\nWhat is the main reason why the result of this survey may differ from the true value for the whole population?`,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation: `**${BIAS_NAME[c.kind]}**: ${BIAS_DEF[c.kind]}. Here, ${c.note}${mistakesNote(mcq.distractors)}`,
    };
  },
};

// =====================================================================================================================
// 3. Anatomy of a study: experiment or observational study, treatment, unit, response, blocking, confounding
// =====================================================================================================================

interface Exp { story: (rng: Rng) => string; unit: string; treat: string; factor: string; response: string; block: string; who: string }
export const EXPS: Exp[] = [
  { story: (rng) => { const all = ['compost', 'seaweed extract', 'chicken manure', 'a chemical fertiliser']; const l = inOrder(all, rng.sample(all, rng.int(2, 4))); return `A horticulturist compares ${l.length} fertilisers for tomato plants: ${listText(l)}. Her plants grow in ${rng.int(2, 4)} greenhouses that get different amounts of sunlight, so within each greenhouse she assigns ${rng.int(4, 10)} plants at random to each fertiliser. After ten weeks, she weighs the tomatoes picked from every plant.`; },
    unit: 'a tomato plant', treat: 'a particular fertiliser', factor: 'The fertiliser', response: 'The weight of the tomatoes per plant', block: 'The greenhouse', who: 'the horticulturist' },
  { story: (rng) => { const all = ['Moonwater', 'Dreamdust', 'Owl Whisper', 'Slumberroot']; const l = inOrder(all, rng.sample(all, rng.int(2, 4))); return `The potion master of a school of wizardry tests ${l.length} sleeping potions: ${listText(l)}. Her test subjects are dwarves and elves, who are known to react differently to potions, so she assigns the potions at random separately among the dwarves and among the elves. For every subject she records how many minutes it takes to fall asleep.`; },
    unit: 'a test subject', treat: 'a particular sleeping potion', factor: 'The sleeping potion', response: 'The time until falling asleep', block: 'The species (dwarf or elf)', who: 'the potion master' },
  { story: (rng) => { const all = ['flashcards', 'practice exams', 'study groups', 'rereading the slides']; const l = inOrder(all, rng.sample(all, rng.int(2, 4))); return `A study coach compares ${l.length} ways of preparing for a statistics exam: ${listText(l)}. First-year and second-year students differ in experience, so she assigns the methods at random separately within each year. Afterwards she records the exam score of each of the ${rng.int(6, 12) * 10} students.`; },
    unit: 'a student', treat: 'a particular preparation method', factor: 'The preparation method', response: 'The exam score', block: 'The year of study', who: 'the study coach' },
  { story: (rng) => { const all = ['2 hours', '8 hours', '24 hours', '48 hours']; const l = inOrder(all, rng.sample(all, rng.int(2, 4))); return `A pizza chain tests ${l.length} rising times for its dough: ${listText(l)}. Some restaurants bake in wood-fired ovens and others in electric ovens, so within each oven type the batches of dough are assigned at random to the rising times, ${rng.int(4, 9)} batches per rising time. A tasting panel gives each baked crust a score from 1 to 10.`; },
    unit: 'a batch of dough', treat: 'a particular rising time', factor: 'The rising time', response: 'The tasting score of the crust', block: 'The type of oven', who: 'the tasting panel' },
  { story: (rng) => { const all = ['classical music', 'pop music', 'no music']; const l = inOrder(all, rng.sample(all, rng.int(2, 3))); return `A dairy farmer wonders whether music in the barn affects milk production. Her herd has two breeds that give very different amounts of milk, so within each breed she assigns the cows at random to barns with ${orText(l)}. After a month she records the daily milk yield of each of her ${rng.int(4, 12) * 10} cows.`; },
    unit: 'a cow', treat: 'a particular type of music', factor: 'The music played in the barn', response: 'The daily milk yield', block: 'The breed of the cow', who: 'the dairy farmer' },
];
interface Obs { story: (rng: Rng) => string; explanatory: string; response: string; confounder: string }
export const OBS: Obs[] = [
  { story: (rng) => `A gym looks at the records of ${rng.int(20, 60) * 10} members and finds that members who take group classes visit the gym more often per month than members who only train alone. The members decided themselves whether to take classes, and members with more free time may be more likely to do so.`,
    explanatory: 'Taking group classes or not', response: 'The number of gym visits per month', confounder: 'The amount of free time of a member' },
  { story: (rng) => `A lecturer records, for ${rng.int(10, 30) * 10} students, whether they sit in the front rows of the lecture hall and which grade they get for the course. Students pick their own seats, and motivated students may prefer the front rows.`,
    explanatory: 'Sitting in the front rows or not', response: 'The course grade', confounder: 'The motivation of a student' },
  { story: (rng) => `A village elder notes, for ${rng.int(5, 15) * 10} villagers, whether they drink the herbal tea of the local witch and how many colds they catch during the winter. The villagers decide themselves whether to drink the tea, and the tea drinkers tend to be older than the others.`,
    explanatory: 'Drinking the herbal tea or not', response: 'The number of colds caught during the winter', confounder: 'The age of a villager' },
];
export const ROLE = {
  experiment: 'an experiment', observational: 'an observational study', response: 'the response variable', treatment: 'a treatment factor',
  block: 'a blocking factor', unit: 'an experimental unit', explanatory: 'the explanatory variable', confounder: 'a possible confounding variable',
} as const;

interface Fact2 { intro: string; f1: string; l1: string[]; f2: string; l2: string[]; units: string; blocks: string }
const FACT2: Fact2[] = [
  { intro: 'A bakery is looking for the best recipe for its bread', f1: 'flour type', l1: ['wheat', 'spelt', 'rye', 'oat'], f2: 'baking temperature', l2: ['200 °C', '220 °C', '240 °C'], units: 'loaves', blocks: 'ovens' },
  { intro: 'A gardener wants to grow the biggest pumpkins', f1: 'fertiliser', l1: ['compost', 'seaweed extract', 'chicken manure', 'no fertiliser'], f2: 'watering schedule', l2: ['daily', 'every other day', 'twice a week'], units: 'pumpkin plants', blocks: 'fields' },
  { intro: 'An alchemist is searching for the strongest healing potion', f1: 'herb', l1: ['sage', 'mandrake', 'nettle', 'moonflower'], f2: 'brewing time', l2: ['1 hour', '3 hours', '6 hours'], units: 'cauldrons of potion', blocks: 'cellars' },
  { intro: 'A web shop wants to know which banner gets the most clicks', f1: 'banner colour', l1: ['red', 'blue', 'green', 'yellow'], f2: 'banner position', l2: ['top of the page', 'side bar', 'bottom of the page'], units: 'groups of visitors', blocks: 'countries' },
];

const studyAnatomy: Template = {
  id: 'sampling-study-design.study-anatomy',
  topic: TOPIC,
  title: 'Experiment or observational study; treatment, unit, response, blocking and confounding variables; number of treatments and units',
  types: ['matching', 'single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    if (type === 'numeric') {
      const f = rng.pick(FACT2);
      // levels in their natural order; never 2 × 2, where adding the numbers of levels (2 + 2) gives the right count
      const l1 = inOrder(f.l1, rng.sample(f.l1, rng.int(2, 4)));
      const l2 = inOrder(f.l2, rng.sample(f.l2, l1.length === 2 ? 3 : rng.int(2, 3)));
      const r = rng.int(3, 8);
      const k = rng.chance(0.5) ? rng.int(2, 4) : 1;
      const askUnits = rng.chance(0.6) || k > 1;
      const T = l1.length * l2.length;
      const ans = askUnits ? T * r * k : T;
      const blockTxt = k > 1 ? ` Because the ${f.blocks} differ, the complete design is carried out separately in each of ${k} ${f.blocks}.` : '';
      return {
        type,
        stem: `${f.intro}. The experiment varies two factors: ${f.f1} (${listText(l1)}) and ${f.f2} (${listText(l2)}). All combinations of the two factors are tested, each on ${r} ${f.units}.${blockTxt}\n${askUnits ? `How many ${f.units} are needed in total?` : 'How many treatments does this experiment have?'}`,
        instruction: INSTRUCTION.numeric(0),
        ...whole(ans),
        explanation:
          `A treatment is a combination of one level of each factor, so there are $${l1.length} \\times ${l2.length} = ${T}$ treatments (${f.f1} has ${l1.length} levels, ${f.f2} has ${l2.length}).` +
          (askUnits
            ? ` Each treatment gets ${r} ${f.units}${k > 1 ? ` in each of the ${k} ${f.blocks} (blocks)` : ''}, so $${T} \\times ${r}${k > 1 ? ` \\times ${k}` : ''} = ${ans}$ ${f.units} are needed.`
            : ` (The ${r} ${f.units} per treatment are replicates, not extra treatments.)`) +
          `\n\nCommon slips: adding the numbers of levels (${l1.length} + ${l2.length} = ${l1.length + l2.length}) instead of multiplying them${k > 1 ? ', or forgetting that the design is repeated in every block' : ''}.`,
      };
    }
    if (type === 'single-choice') {
      const e = rng.pick(EXPS);
      const [T, U, R, B] = [e.treat, e.unit, lc(e.response), lc(e.block)];
      const ds: Choice[] = [
        { text: `${U}; ${T}; ${R}`, why: 'swaps the treatment and the experimental unit: the treatment is what is applied, the unit is what it is applied to.' },
        { text: `${T}; ${R}; ${U}`, why: 'swaps the experimental unit and the response: the response is what is measured on each unit.' },
        { text: `random assignment; ${U}; ${R}`, why: 'takes the random assignment (a principle of design) for the treatment; the treatment is the condition that is assigned.' },
        { text: `${T}; ${e.who}; ${R}`, why: `takes ${e.who} for the experimental unit; the units are what the treatments are applied to.` },
        { text: `${T}; ${U}; ${B}`, why: `takes the blocking variable for the response; ${B} is known before the experiment and is not the measured outcome.` },
        { text: `${B}; ${U}; ${R}`, why: `takes the blocking variable for the treatment; ${B} is not assigned by the researcher, it is only used to form groups of similar units.` },
      ];
      const mcq = buildMcq(rng, { text: `${T}; ${U}; ${R}` }, rng.shuffle(ds), { count: optionCount });
      return {
        type,
        stem: `${e.story(rng)}\nWhat are the treatment, the experimental unit and the response variable of this experiment (in this order)?`,
        options: mcq.options,
        correctAnswer: mcq.correctAnswer,
        explanation:
          `- **Treatment**: what the researcher assigns, here ${T}.\n- **Experimental unit**: what a treatment is assigned to, here ${U}.\n- **Response**: what is measured on every unit afterwards, here ${R}.\n` +
          `${cap(B)} is a **blocking** variable: the random assignment is done separately within each block.${mistakesNote(mcq.distractors)}`,
      };
    }
    if (rng.chance(0.7)) {
      const e = rng.pick(EXPS);
      const pairs = [
        { prompt: 'This study is …', answer: ROLE.experiment },
        ...rng.shuffle([
          { prompt: `${e.factor} is …`, answer: ROLE.treatment },
          { prompt: `${e.response} is …`, answer: ROLE.response },
          { prompt: `${e.block} is …`, answer: ROLE.block },
          ...(rng.chance(0.5) ? [{ prompt: `${cap(e.unit)} is …`, answer: ROLE.unit }] : []),
        ]),
      ];
      const mm = buildMatching(rng, pairs, [ROLE.experiment, ROLE.observational, ROLE.response, ROLE.treatment, ROLE.block, ROLE.unit]);
      return {
        type,
        stem: `${e.story(rng)}\nFill in the blanks.`,
        instruction: INSTRUCTION.matching,
        prompts: mm.prompts,
        choices: mm.choices,
        correctAnswer: mm.correctAnswer,
        explanation:
          `The researcher actively assigns the treatments (at random), so this is **an experiment**, not an observational study. ` +
          `${e.response} is **the response variable**: it is measured afterwards and may depend on the treatment. ` +
          `${e.factor} is **a treatment factor**: the researcher decides which unit gets which level. ` +
          `${e.block} is **a blocking factor**: the researcher cannot assign it, but uses it to form groups of similar units and randomises within each group, which removes its effect from the comparison. ` +
          `Each treatment is applied to ${e.unit}, so that is **an experimental unit**.`,
      };
    }
    const o = rng.pick(OBS);
    const pairs = [
      { prompt: 'This study is …', answer: ROLE.observational },
      ...rng.shuffle([
        { prompt: `${o.explanatory} is …`, answer: ROLE.explanatory },
        { prompt: `${o.response} is …`, answer: ROLE.response },
        { prompt: `${o.confounder} is …`, answer: ROLE.confounder },
      ]),
    ];
    const mm = buildMatching(rng, pairs, [ROLE.experiment, ROLE.observational, ROLE.response, ROLE.explanatory, ROLE.confounder, ROLE.block]);
    return {
      type,
      stem: `${o.story(rng)}\nFill in the blanks.`,
      instruction: INSTRUCTION.matching,
      prompts: mm.prompts,
      choices: mm.choices,
      correctAnswer: mm.correctAnswer,
      explanation:
        `Nobody assigns the groups: the subjects choose them themselves and the researcher only records what happens, so this is **an observational study**. ` +
        `${o.explanatory} is **the explanatory variable** and ${lc(o.response)} is **the response variable**. ` +
        `${o.confounder} is **a possible confounding variable**: it may differ between the groups and also affect the response, so its effect cannot be separated from that of the explanatory variable. ` +
        `There is no blocking factor: blocking is part of the design of an experiment.`,
    };
  },
};

// =====================================================================================================================
// 4. Design principles: random sampling vs random assignment, placebo, blinding, blocking, confounding
// =====================================================================================================================

interface Trial { intro: string; subjects: string; population: string; treat: string; placebo: string; outcome: string; evaluators: string; blockVar: string; blockHow: string; confounder: string }
const TRIALS: Trial[] = [
  { intro: 'A sports-drink company wants to know whether its new energy drink makes amateur cyclists faster.', subjects: 'cyclists', population: 'all amateur cyclists in the Netherlands', treat: 'energy drink', placebo: 'a drink that looks and tastes the same but contains no active ingredients', outcome: 'the time needed to ride 20 km', evaluators: 'The coaches who time the rides', blockVar: 'Gender', blockHow: 'separately for men and for women', confounder: 'the fitness of the cyclists' },
  { intro: 'An education start-up wants to know whether its reading app improves the reading skills of eight-year-olds.', subjects: 'children', population: 'all eight-year-olds in the country', treat: 'reading app', placebo: 'a look-alike app with games but without reading exercises', outcome: 'the score on a reading test', evaluators: 'The teachers who mark the reading tests', blockVar: 'School', blockHow: 'separately within each participating school', confounder: 'how much the parents read with their children' },
  { intro: 'A tea brand claims that its new evening tea helps people sleep longer.', subjects: 'adults', population: 'all adults in Belgium', treat: 'evening tea', placebo: 'an ordinary herbal tea with the same taste and colour', outcome: 'the number of hours slept', evaluators: 'The researchers who read out the sleep trackers', blockVar: 'Age group', blockHow: 'separately for adults under 40 and adults aged 40 or older', confounder: 'the stress level of the participants' },
  { intro: 'A wizard claims that his potion makes beards grow faster.', subjects: 'dwarves', population: 'all dwarves of the Iron Hills', treat: 'potion', placebo: 'coloured water that looks, smells and tastes exactly like the potion', outcome: 'the beard growth after one month', evaluators: 'The barbers who measure the beards', blockVar: 'Clan', blockHow: 'separately within each of the three dwarf clans', confounder: 'the age of the dwarves' },
];
export interface Design { randomSample: boolean; randomAssign: boolean; placebo: boolean; evalBlind: boolean; blocked: boolean }

function trialStem(t: Trial, f: Design, n: number): string {
  const s1 = f.randomSample ? `${n} ${t.subjects} are drawn at random from a complete list of ${t.population}.` : `${n} ${t.subjects} sign up after seeing an advertisement on social media.`;
  const s2 = f.randomAssign
    ? `A computer lottery puts half of them in a group that gets the ${t.treat} and the other half in a control group${f.blocked ? `; this is done ${t.blockHow}` : ''}. ${f.placebo ? `The control group gets ${t.placebo}.` : 'The control group gets nothing.'}`
    : `Each of them decides for themselves whether to use the ${t.treat}; those who decide against it get nothing.`;
  const s3 = `${t.evaluators} ${f.evalBlind ? 'do not know' : 'know'} who received the ${t.treat}. Afterwards, ${t.outcome} is compared between the two groups.`;
  return `${t.intro} ${s1} ${s2} ${s3}`;
}

function statements(t: Trial, f: Design, rng: Rng) {
  const st: { text: string; correct: boolean; why: string }[] = [];
  const add = (text: string, correct: boolean, why: string) => st.push({ text, correct, why });
  const ra = f.randomAssign;
  if (rng.chance(0.5)) add('This study is an experiment.', ra, ra ? 'the researchers assign the treatment, so it is an experiment.' : 'the participants choose themselves; nothing is assigned, so it is an observational study.');
  else add('This study is an observational study.', !ra, ra ? 'the researchers assign the treatment by lottery, so it is an experiment.' : 'the participants choose themselves whether to use it; nothing is assigned, so it is an observational study.');
  if (!ra || f.placebo)
    add(`A clear difference in ${t.outcome} between the groups would be evidence that the ${t.treat} causes this difference.`, ra, ra ? 'random assignment (with a placebo control) makes the groups comparable, so a clear difference can be attributed to the treatment.' : `the groups chose themselves and may differ in other ways (for example ${t.confounder}), so a causal conclusion is not justified.`);
  add(`${cap(t.confounder)} may be confounded with the effect of the ${t.treat}.`, !ra, ra ? 'random assignment spreads such differences evenly over the groups (on average), so they are not confounded with the treatment.' : 'the participants chose their own group, so the groups may differ in this variable, which also affects the outcome.');
  add('The study is double-blind.', f.placebo && f.evalBlind, f.placebo && f.evalBlind ? 'the participants cannot tell their group (placebo) and the people who measure the outcome do not know it either.' : !f.placebo ? 'the participants know whether they received the real treatment, so the study is not even single-blind for them.' : 'the people who measure the outcome know who received the treatment.');
  add(`${t.blockVar} is used as a blocking variable.`, f.blocked, f.blocked ? `the random assignment is done ${t.blockHow}, so ${lc(t.blockVar)} forms the blocks.` : 'the assignment is not done separately within groups, so there are no blocks.');
  if (ra) {
    add(`The participants in the control group cannot tell whether they received the real ${t.treat}.`, f.placebo, f.placebo ? 'they get a placebo that cannot be told apart from the real thing.' : 'they get nothing, so they know they are in the control group.');
    add(`The results can be generalised to ${t.population}.`, f.randomSample, f.randomSample ? 'the participants are a random sample from the whole population.' : 'the participants are volunteers who answered an advertisement, not a random sample of the population.');
    if (!f.randomSample) add(`Because the ${t.subjects} were assigned to the groups at random, the results can be generalised to ${t.population}.`, false, 'random *assignment* supports cause-and-effect conclusions; generalising to a population requires random *sampling*, and these participants are volunteers.');
    if (!f.placebo) add(`An effect of simply expecting to improve cannot be separated from the effect of the ${t.treat}.`, true, 'without a placebo, the treated participants know they got the real thing, so expectations (the placebo effect) are mixed up with the treatment effect.');
  } else add(`The ${t.subjects} who chose the ${t.treat} may differ in other ways from those who did not.`, true, 'self-selection: people who choose a treatment often differ from those who do not.');
  return st;
}

function subsetLabel(mask: number): string {
  const ids = ROMAN.slice(0, 3).filter((_, i) => mask & (1 << i));
  if (!ids.length) return 'None of them';
  return ids.length === 1 ? `${ids[0]} only` : ids.length === 2 ? `${ids[0]} and ${ids[1]}` : 'I, II and III';
}

const designPrinciples: Template = {
  id: 'sampling-study-design.design-principles',
  topic: TOPIC,
  title: 'Which conclusions does a study design allow? (random sampling vs assignment, placebo, blinding, blocking, confounding)',
  types: ['multi-select', 'single-choice'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const t = rng.pick(TRIALS);
    const randomAssign = rng.chance(0.7);
    const f: Design = { randomSample: rng.chance(0.4), randomAssign, placebo: randomAssign && rng.chance(0.6), evalBlind: rng.chance(0.5), blocked: randomAssign && rng.chance(0.5) };
    const stem = trialStem(t, f, rng.pick([40, 60, 80, 100, 120, 200]));
    const all = statements(t, f, rng);
    if (type === 'multi-select') {
      const T = rng.shuffle(all.filter((s) => s.correct));
      const F = rng.shuffle(all.filter((s) => !s.correct));
      const nT = rng.int(Math.max(1, optionCount - F.length), Math.min(optionCount - 1, T.length));
      const m = buildMulti(rng, [...T.slice(0, nT), ...F.slice(0, optionCount - nT)], optionCount, nT);
      return {
        type,
        stem: `${stem}\nWhich of the following statements are correct?`,
        instruction: INSTRUCTION.multi,
        options: m.options,
        correctAnswer: m.correctAnswer,
        explanation: `Random **assignment** to the groups justifies cause-and-effect conclusions; random **sampling** from the population justifies generalising to that population. A placebo keeps the participants blind, and double-blind also requires that the people who measure the outcome do not know the groups.${reasonsNote(m.reasons)}`,
      };
    }
    const three = rng.sample(all, 3);
    const mask = three.reduce((acc, s, i) => (s.correct ? acc | (1 << i) : acc), 0);
    const flips: Choice[] = [0, 1, 2].map((i) => ({ text: subsetLabel(mask ^ (1 << i)), why: `misjudges statement ${ROMAN[i]}: ${three[i].why}` }));
    const twos: Choice[] = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => ({ text: subsetLabel(mask ^ (1 << i) ^ (1 << j)), why: `misjudges statements ${ROMAN[i]} and ${ROMAN[j]}.` }));
    const mcq = buildMcq(rng, { text: subsetLabel(mask) }, [...rng.shuffle(flips), ...rng.shuffle(twos)], { count: optionCount, fallback: (i) => ({ text: subsetLabel((mask ^ 7 ^ i) & 7), why: 'misjudges several statements.' }) });
    return {
      type,
      stem: `${stem}\nConsider the following statements:\n${three.map((s, i) => `${ROMAN[i]}. ${s.text}`).join('\n')}\nWhich of these statements are true?`,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation: three.map((s, i) => `- **${ROMAN[i]}** is ${s.correct ? 'true' : 'false'}: ${s.why}`).join('\n') + `\n\nSo the answer is **${subsetLabel(mask)}**.${mistakesNote(mcq.distractors)}`,
    };
  },
};

export const TEMPLATES: Template[] = [samplingMethod, surveyBias, studyAnatomy, designPrinciples];
