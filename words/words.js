import { dictionary } from './wordle-list.js';
import { createReadStream } from 'fs';
import readline from 'readline';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Importing dictionary and rank set...');

//const words5 = await _getMostPopularLength(0, 5);
import words5 from './words5.js';

const cache = new Map();

console.log(`--- dictionary [size = ${dictionary.values.length}] [solutions = ${dictionary.solutions.length}]`);
console.log(`--- ranks set  [size = ${words5.length}]`);

async function _getMostPopularLength(size, len) {
  const fileStream = createReadStream(__dirname + '/enwiki-20210820-words-frequency.txt');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const output = [];

  for await (const line of rl) {
    if (size && output.length === size) break;
    const word = line.split(' ')[0];
    if (word.length === len && !/[^a-z]/i.test(word)) output.push(word);
  }

  return output;
}

const getRank = word => {
  if (cache.has(word)) return cache.get(word);
  let rank = words5.indexOf(word);
  if (rank < 0) console.log(`WARNING: word "${word}" not ranked`);
  cache.set(word, rank);
  return rank;
};

export {
  dictionary,
  getRank,
};