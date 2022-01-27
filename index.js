/* Word size to be used */
const WORD_SIZE = 5;
/* Maximum number of attempts */
const MAX_STEPS = 6;
/* Default strategy to use */
const DEFAULT_STRATEGY = 1;

/* Prompt utils */
import { getPrompt, closePrompt } from './prompt.js';

/* Get wordle dictionary */
import dictionary from './words.js';
console.log(`--- dictionary size = ${dictionary.values.length} ---`);

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
    for (let i=0; i<word.length; i++) {
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
  console.log(`unattended mode: searching for answer "${answer}" using strategy ${strategy}`);

  /* Initialize solutions to the whole dictionary */
  let remainingWords = [...dictionary.values];
  let steps = 0;
  let exitValue = 0;

  for (;;) {
    if (!remainingWords.includes(answer)) {
      console.log('failure: the solution is not present in the dictionary\n');
      exitValue = -1;
      break;
    }

    const inputWord = guess(remainingWords, strategy);
    if (!checkWord(inputWord, remainingWords)) {
      console.log('failure: guessed word is not in the dictionary\n');
      exitValue = -2;
      break;
    }

    const resultMask = evaluateMask(inputWord, answer);
    if (!checkMask(resultMask)) {
      console.log('failure: evaluated mask is wrong\n');
      exitValue = -3;
      break;
    }

    remainingWords = update(inputWord, resultMask, remainingWords);

    steps++;

    if (inputWord === answer) {
      console.log(`success: the solution is "${inputWord}" (${steps})\n`);
      exitValue = steps;
      break;
    }

    if (steps === MAX_STEPS) {
      console.log(`failure: could not find solution in ${MAX_STEPS} steps :-(\n`);
      exitValue = (steps+1);
      break;
    }
  }

  return exitValue;
}

async function solveWithPrompt(strategy) {
  /* Initialize to the whole dictionary */
  let remainingWords = [...dictionary.values];

  let steps = 0;
  for (;;) {
    if (remainingWords.length === 0) {
      console.log('\nfailure: the solution is not present in the dictionary');
      break;
    }

    console.log(`\nstep #${steps+1}`);
    console.log(`remaining words = ${remainingWords.length}`);

    let inputWord = await getPrompt('insert word (press ENTER to make a guess): ');
    if (!inputWord || inputWord.length === 0) {
      inputWord = guess(remainingWords, strategy);
      console.log(`picked "${inputWord}"`);
    }
    if (!checkWord(inputWord, remainingWords)) continue;

    let resultMask = await getPrompt('insert wordle color mask (0=grey, 1=yellow, 2=green, press ENTER to skip word): ');
    if (!resultMask || resultMask.length === 0) {
      console.log('skipping word');
      remainingWords = remainingWords.filter(w => w !== inputWord);
      continue;
    }
    if (!checkMask(resultMask)) continue;

    remainingWords = update(inputWord, resultMask, remainingWords);

    steps++;

    if (/[^2$]+/.test(resultMask) === false) {
      console.log(`\nsuccess: the solution is "${inputWord}" (found in ${steps} steps)\n`);
      break;
    }

    if (steps === MAX_STEPS) {
      console.log(`\nfailure: could not find solution in ${MAX_STEPS} steps :-(\n`);
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

function guess(solutions, strategy) {
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
        for (const w of word)
          distincts.add(w);
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
    pick = candidates[Math.floor(Math.random() * candidates.length)];
  }

  /* Strategy 2 : slow, words with highest frequency chars metric */
  /* ~80% of success rate */
  if (strategy === 2) {
    const weights = calculateCharFreqs(solutions);
    let max = 0;
    let candidates = [];
    for (const word of solutions) {
      let value = 0;
      for (const w of word)
        value = value + 1 * weights[w];
      if (value < max) continue;
      else if (value > max) {
        candidates = [word];
        max = value;
      }
      else if (value === max) {
        candidates.push(word);
      }
    }
    pick = candidates[Math.floor(Math.random() * candidates.length)];
  }

  /* Strategy 3 : slow, words with highest frequency distinct chars metric */
  /* ~93-94% of success rate */
  if (strategy === 3) {
    const weights = calculateCharFreqs(solutions);
    let max = 0;
    let candidates = [];
    for (const word of solutions) {
      const distincts = new Set();
      let value = 0;
      for (const w of word) {
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
    pick = candidates[Math.floor(Math.random() * candidates.length)];
  }

  /* Strategy 4 : slow, words with highest positioning frequency distinct chars metric */
  /* ~94-95% of success rate */
  if (strategy === 4) {
    const weightsByPos = calculateCharFreqsByPosition(solutions);
    let max = 0;
    let candidates = [];
    for (const word of solutions) {
      const distincts = new Set();
      let value = 0;
      for (let i=0; i<word.length; i++) {
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
    pick = candidates[Math.floor(Math.random() * candidates.length)];
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

if (process.argv.length <= 2) {
  await solveWithPrompt(4);
} else {
  const iterations = parseInt(process.argv[2]);
  const strategy = process.argv.length > 3 ? parseInt(process.argv[3]) : DEFAULT_STRATEGY;

  const steps = [];
  for (let i = 0; i < iterations; i++) {
    const randomSolution = dictionary.solutions[Math.floor(Math.random() * dictionary.solutions.length)];
    const iters = solveUnattended(randomSolution, strategy);
    steps.push(iters);
  }
  const unsolved = steps.filter(s => s >= MAX_STEPS + 1);
  const solved = steps.filter(s => s > 0 && s <= MAX_STEPS);
  const errored = steps.filter(s => s <= 0);
  const savg = (solved.reduce((x, y) => x + y) / solved.length);

  console.log(`total iterations\t = ${iterations}`);
  console.log(`solved avg steps\t = ${Math.round(savg * 100) / 100}`);
  console.log(`errors \t\t\t = ${errored.length}`);
  console.log(`solved %\t\t = ${100 * solved.length / iterations}%`);
  console.log(`unsolved %\t\t = ${100 * unsolved.length / iterations}%`);
}