/* Word size to be used */
const WORD_SIZE = 5;
/* Maximum number of attempts */
const MAX_STEPS = 6;
/* Default strategy to use */
const DEFAULT_STRATEGY = 7;

import { program } from 'commander';
program
  .option('-s, --strategy <value>', 'Strategy to use', DEFAULT_STRATEGY)
  .option('-u, --unattended', 'Run the solver for all the possibile solutions')
  .option('-a, --answer <value>', 'Set a target solution')
  .parse(process.argv);

const options = program.opts();

if (!options.unattended)
  console.log('--- interactive mode');
else
  console.log(`--- unattended mode (iterations = ${options.answer ? 1 : dictionary.solutions.length})`);
console.log(`--- using strategy ${options.strategy}`);
if (!options.answer)
  console.log('--- no answer supplied');
else
  console.log(`--- searching for answer "${options.answer}"`);

/* Prompt utils */
import { getPrompt, closePrompt } from './prompt.js';

/* Get wordle dictionary */
import { dictionary, getRank } from './words/words.js';
dictionary.values.sort();

const cache = new Map();

function calculateCharFreqs(solutions) {
  let hits = {};
  let weights = {};
  let maxHits = 0, _maxChar;
  for (const word of solutions) {
    for (const w of word) {
      if (!hits[w]) hits[w] = 1;
      else hits[w]++;
      if (hits[w] > maxHits) {
        maxHits = hits[w];
        _maxChar = w;
      }
    }
  }

  for (const [c, h] of Object.entries(hits)) {
    weights[c] = Math.round(h / maxHits * 100) / 100;
  }

  return weights;
}

function calculateCharFreqsByPosition(solutions) {
  let hitsByPos = {};
  let weightByPos = {};
  let maxHitsByPos = {};
  for (const word of solutions) {
    for (let i = 0; i < word.length; i++) {
      const w = word.charAt(i);
      if (!hitsByPos[i]) hitsByPos[i] = {};
      if (!hitsByPos[i][w]) hitsByPos[i][w] = 1;
      else hitsByPos[i][w]++;
      if (!maxHitsByPos[i] || hitsByPos[i][w] > maxHitsByPos[i]) {
        maxHitsByPos[i] = hitsByPos[i][w];
      }
    }
  }

  for (const [pos, hits] of Object.entries(hitsByPos)) {
    for (const [c, h] of Object.entries(hits)) {
      if (!weightByPos[pos]) weightByPos[pos] = {};
      weightByPos[pos][c] = Math.round(h / maxHitsByPos[pos] * 100) / 100;
    }
  }

  return weightByPos;
}

function solveUnattended(answer, strategy) {
  console.log(`\nunattended mode: searching for answer "${answer}" using strategy ${strategy}`);

  /* Initialize solutions to the whole dictionary */
  let remainingWords = [...dictionary.values];
  let steps = 0;
  let exitValue = 0;
  let resultMask;

  for (; ;) {
    if (!remainingWords.includes(answer)) {
      console.log('failure: the solution is not present in the dictionary\n');
      exitValue = -1;
      break;
    }

    const inputWord = guess(remainingWords, strategy, steps, resultMask);
    if (!checkWord(inputWord, remainingWords)) {
      console.log('failure: guessed word is not in the dictionary\n');
      exitValue = -2;
      break;
    }

    resultMask = evaluateMask(inputWord, answer);
    if (!checkMask(resultMask)) {
      console.log('failure: evaluated mask is wrong\n');
      exitValue = -3;
      break;
    }

    remainingWords = update(inputWord, resultMask, remainingWords);

    steps++;

    if (inputWord === answer) {
      console.log(`success: the solution is "${inputWord}" (${steps})`);
      exitValue = steps;
      break;
    }

    if (steps === MAX_STEPS) {
      const wordsFilt = remainingWords.map(w => {
        if (dictionary.solutions.includes(w)) return w + '*';
        return w;
      });
      console.log(`failure: could not find ${answer ? `solution "${answer}"` : 'solution'} in ${MAX_STEPS} steps ${JSON.stringify(wordsFilt)}`);
      exitValue = (steps + 1);
      break;
    }
  }

  return exitValue;
}

async function solveWithPrompt(answer, strategy) {
  /* Initialize to the whole dictionary */
  let remainingWords = [...dictionary.values];

  let steps = 0;
  let resultMask;

  for (; ;) {
    if (remainingWords.length === 0) {
      console.log('\nfailure: the solution is not present in the dictionary');
      break;
    }

    console.log(`\nstep #${steps + 1}`);
    console.log(`remaining words = ${remainingWords.length}`);

    let inputWord = await getPrompt('insert word (press ENTER to make a guess): ');
    if (!inputWord || inputWord.length === 0) {
      inputWord = guess(remainingWords, strategy, steps, resultMask);
      console.log(`picked "${inputWord}"`);
    }
    if (!checkWord(inputWord, remainingWords)) continue;

    if (!answer) {
      resultMask = await getPrompt('insert wordle color mask (0=grey, 1=yellow, 2=green, press ENTER to skip word): ');
      if (!resultMask || resultMask.length === 0) {
        console.log('skipping word');
        remainingWords = remainingWords.filter(w => w !== inputWord);
        continue;
      }
    } else {
      resultMask = evaluateMask(inputWord, answer);
    }
    if (!checkMask(resultMask)) continue;

    remainingWords = update(inputWord, resultMask, remainingWords);

    steps++;

    if (/[^2$]+/.test(resultMask) === false) {
      console.log(`\nsuccess: the solution is "${inputWord}" (found in ${steps} steps)\n`);
      break;
    }

    if (steps === MAX_STEPS) {
      const wordsFilt = remainingWords.map(w => {
        if (dictionary.solutions.includes(w)) return w + '*';
        return w;
      });
      console.log(`\nfailure: could not find ${answer ? `solution "${answer}"` : 'solution'} in ${MAX_STEPS} steps ${JSON.stringify(wordsFilt)}\n`);
      break;
    }
  }

  closePrompt();
}

function checkWord(word, dict) {
  if (word.length !== WORD_SIZE) {
    console.error('invalid word length!');
    return false;
  }
  if (!dict.includes(word)) {
    console.error('this word is not included in the dictionary');
    return false;
  }
  return true;
}

function checkMask(mask) {
  if (mask.length !== WORD_SIZE) {
    console.error('invalid mask length!');
    return false;
  }
  if (/[^012$]+/.test(mask)) {
    console.error('invalid mask format!');
    return false;
  }
  return true;
}

let blacklist = [];
function guess(solutions, strategy, stepsDone, lastMask) {
  let pick;

  /* Strategy 0 : fastest, random guess */
  /* ~90% of success rate */
  if (strategy === 0) {
    pick = solutions[Math.floor(Math.random() * solutions.length)];
  }

  /* Strategy 1 : fast, words with highest number of unique characters */
  /* ~92% of success rate */
  if (strategy === 1) {
    let max = 0;
    let candidates = [];
    for (const word of solutions) {
      if (!cache.has(word)) {
        const distincts = new Set();
        let val = 0;
        for (let i = 0; i < word.length; i++) {
          if (lastMask && lastMask.charAt(i) === '2') continue;
          const w = word.charAt(i);
          distincts.add(w);
        }
        val = distincts.size;
        cache.set(word, val);
      }
      const value = cache.get(word);
      if (value < max) continue;
      else if (value > max) {
        candidates = [word];
        max = value;
      }
      else if (value === max) {
        candidates.push(word);
      }
    }
    pick = candidates[0];
  }

  /* Strategy 2 : slow, words with highest frequency chars metric */
  /* ~80% of success rate */
  if (strategy === 2) {
    const weights = calculateCharFreqs(solutions);
    let max = 0;
    let candidates = [];
    for (const word of solutions) {
      let value = 0;
      for (let i = 0; i < word.length; i++) {
        if (lastMask && lastMask.charAt(i) === '2') continue;
        const w = word.charAt(i);
        value = value + 1 * weights[w];
      }
      if (value < max) continue;
      else if (value > max) {
        candidates = [word];
        max = value;
      }
      else if (value === max) {
        candidates.push(word);
      }
    }
    pick = candidates[0];
  }

  /* Strategy 3 : slow, words with highest frequency _distinct_ chars metric */
  /* ~92% of success rate */
  if (strategy === 3) {
    const weights = calculateCharFreqs(solutions);
    let max = 0;
    let candidates = [];
    for (const word of solutions) {
      const distincts = new Set();
      let value = 0;
      for (let i = 0; i < word.length; i++) {
        if (lastMask && lastMask.charAt(i) === '2') continue;
        const w = word.charAt(i);
        if (distincts.has(w)) continue;
        distincts.add(w);
        value = value + 1 * weights[w];
      }
      if (value < max) continue;
      else if (value > max) {
        candidates = [word];
        max = value;
      }
      else if (value === max) {
        candidates.push(word);
      }
    }
    pick = candidates[0];
  }

  /* Strategy 4 : slow, words with highest _positioning_ frequency distinct chars metric */
  /* ~95% of success rate */
  if (strategy === 4) {
    const weightsByPos = calculateCharFreqsByPosition(solutions);
    let max = 0;
    let candidates = [];
    for (const word of solutions) {
      const distincts = new Set();
      let value = 0;
      for (let i = 0; i < word.length; i++) {
        if (lastMask && lastMask.charAt(i) === '2') continue;
        const w = word.charAt(i);
        if (distincts.has(w)) continue;
        distincts.add(w);
        value = value + 1 * weightsByPos[i][w];
      }
      if (value < max) continue;
      else if (value > max) {
        candidates = [word];
        max = value;
      }
      else if (value === max) {
        candidates.push(word);
      }
    }
    pick = candidates[0];
  }

  /* Strategy 5 : slow, refine strategy 4 by picking the most common word among the candidates with highest positioning frequency distinct chars metric */
  /* ~98% of success rate */
  if (strategy === 5) {
    const weightsByPos = calculateCharFreqsByPosition(solutions);
    let max = 0;
    let candidates = [];
    for (const word of solutions) {
      const distincts = new Set();
      let value = 0;
      for (let i = 0; i < word.length; i++) {
        if (lastMask && lastMask.charAt(i) === '2') continue;
        const w = word.charAt(i);
        if (distincts.has(w)) continue;
        distincts.add(w);
        value = value + 1 * weightsByPos[i][w];
      }
      if (value < max) continue;
      else if (value > max) {
        candidates = [word];
        max = value;
      }
      else if (value === max) {
        candidates.push(word);
      }
    }

    const rankedCandidates = orderByRank(candidates, blacklist);
    pick = rankedCandidates[0];
  }

  /* Strategy 6 : slow, refine strategy 5 by choosing only by most common english word at the last steps */
  /* ~98% of success rate */
  if (strategy === 6) {
    if ((MAX_STEPS - stepsDone <= 2) && solutions.length > MAX_STEPS - stepsDone) {
      const rankedCandidates = orderByRank(solutions, blacklist);
      pick = rankedCandidates[0];
    }
    else {
      pick = guess(solutions, 5, stepsDone, lastMask);
    }
  }

  /* Strategy 7 : slow, refine strategy 6 using a blacklist for bad suggestions */
  /* ~99% of success rate */
  if (strategy === 7) {
    blacklist = [
      'bally',
      'bitch',
      'brill',
      'bumpy',
      'derry',
      'doner',
      'fifer',
      'fitch',
      'hinny',
      'humpy',
      'jagir',
      'kerry',
      'linny',
      'mater',
      'molly',
      'moner',
      'moola',
      'pater',
      'pussy',
      'saker',
      'sammy',
      'saver',
      'shill',
      'stade',
      'terry',
    ];
    pick = guess(solutions, 6, stepsDone, lastMask);
  }

  return pick;
}

function update(word, mask, solutions) {
  const len = mask.length;
  /* Filters to apply to shrink the solutions */
  const filters = [];
  /* Track the number of known chars in the solution */
  const availableChars = {};
  /* Track the maxmimum occurrences of a char in the solution */
  const maxOccurences = {};

  console.log(`[${solutions.length}] word "${word}" -> mask "${mask}"`);

  for (let i = 0; i < len; i++) {
    const c = word.charAt(i);
    const m = mask.charAt(i);
    if (typeof availableChars[c] !== 'number') availableChars[c] = 0;

    /* m = 0 -> the char is not in the word */
    /* we can exclude that "c" is present in the spot at this step */
    if (m === '0') {
      addFilter('word', `return word.charAt(${i}) !== '${c}'`, filters);
    }
    /* m = 1 -> the char is in the word but in the wrong spot */
    /* we can exclude that "c" is present in the spot at this step */
    if (m === '1') {
      addFilter('word', `return word.charAt(${i}) !== '${c}'`, filters);
      /* Increment number of "c" in the potential solutions */
      availableChars[c]++;
    }
    /* m = 2 -> the char is in the word and in the correct spot */
    if (m === '2') {
      addFilter('word', `return word.charAt(${i}) === '${c}'`, filters);
      /* Increment number of "c" in the potential solutions */
      availableChars[c]++;
    }
  }

  /* Now try to understand if we found that a char is present at most n times */
  for (let i = 0; i < len; i++) {
    const c = word.charAt(i);
    const m = mask.charAt(i);

    /* if there is a 0 flag for a char "c", and we previously found a non-0 flag, */
    /* that means that c is present at most n times */
    if (m === '0' && availableChars[c]) {
      maxOccurences[c] = availableChars[c];
    }
  }

  /* Add the discovered filters */
  for (const [c, num] of Object.entries(availableChars)) {
    /* The solution does not contain a char */
    if (num === 0) {
      addFilter('word', `return !word.includes('${c}')`, filters);
    }
    /* The solution contains at least 1 char c */
    if (num === 1) {
      addFilter('word', `return word.includes('${c}')`, filters);
    }
    /* The solution has a minimum number of char c */
    if (num > 1) {
      addFilter('word', `return (word.match(/${c}/g) || []).length >= ${num}`, filters);
    }
    /* The solution has a maximum number of char c */
    if (maxOccurences[c]) {
      addFilter('word', `return (word.match(/${c}/g) || []).length <= ${maxOccurences[c]}`, filters);
    }
  }

  return solutions.filter(word => filters.every(f => f(word)));
}

function orderByRank(candidates, blacklist) {
  const compareFn = (first, second) => {
    const rankFirst = getRank(first, blacklist) >= 0 ? getRank(first, blacklist) : Number.MAX_SAFE_INTEGER;
    const rankSecond = getRank(second, blacklist) >= 0 ? getRank(second, blacklist) : Number.MAX_SAFE_INTEGER;
    if (rankFirst === rankSecond) return 0;
    if (rankFirst > rankSecond) return 1;
    if (rankFirst < rankSecond) return -1;
  };

  const rankedCandidates = [...candidates];
  rankedCandidates.sort(compareFn);

  for (const c of rankedCandidates)
    console.log(`${c}${dictionary.solutions.includes(c) ? '*' : ''}`, getRank(c, blacklist));

  return rankedCandidates;
}

function evaluateMask(word, answer) {
  const availableChars = {};
  const maskArr = [];
  const len = answer.length;

  /* Initialize mask with all 0 */
  for (let i = 0; i < len; i++) {
    if (typeof availableChars[answer.charAt(i)] !== 'number') availableChars[answer.charAt(i)] = 0;
    availableChars[answer.charAt(i)]++;
    maskArr.push('0');
  }

  /* Set flags "2" (=matched position) */
  for (let i = 0; i < len; i++) {
    if (word.charAt(i) === answer.charAt(i)) {
      availableChars[word.charAt(i)]--;
      maskArr[i] = '2';
    }
  }

  /* Set flags "1" (=char is in the word) */
  for (let i = 0; i < len; i++) {
    if (maskArr[i] === '2' || !availableChars[word.charAt(i)]) continue;
    availableChars[word.charAt(i)]--;
    maskArr[i] = '1';
  }

  return maskArr.join('');
}

function addFilter(param, fn, arr) {
  // console.log(`adding filter ${fn}`);
  arr.push(new Function(param, fn));
}

if (!options.unattended) {
  await solveWithPrompt(options.answer, parseInt(options.strategy));
} else {
  const stepsForSolvingTot = [];
  const iterations = options.answer ? 1 : dictionary.solutions.length;
  for (let i = 0; i < iterations; i++) {
    const solution = options.answer || dictionary.solutions[i];
    const stepsToSolve = solveUnattended(solution, parseInt(options.strategy));
    stepsForSolvingTot.push(stepsToSolve);
  }
  const unsolved = stepsForSolvingTot.filter(s => s >= MAX_STEPS + 1);
  const solved = stepsForSolvingTot.filter(s => s > 0 && s <= MAX_STEPS);
  const errored = stepsForSolvingTot.filter(s => s <= 0);
  const savg = solved.length > 0 ? (solved.reduce((x, y) => x + y) / solved.length) : 0;

  console.log(`\ntotal iterations\t = ${stepsForSolvingTot.length}`);
  console.log(`solved avg steps\t = ${round3(savg)}`);
  console.log(`errors \t\t\t = ${errored.length}`);
  console.log(`solved %\t\t = ${round3(100 * solved.length / stepsForSolvingTot.length)}%`);
  console.log(`unsolved %\t\t = ${round3(100 * unsolved.length / stepsForSolvingTot.length)}%`);
}

function round3(num) {
  return Math.round(num * 1000) / 1000;
}