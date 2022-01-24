/* Prompt from stdin */
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import { promisify } from 'util';

let prompt;
let rl;

const getPrompt = str => {
    if (prompt) return prompt(str);
    rl = readline.createInterface({ input, output });
    prompt = promisify(rl.question).bind(rl);
    return prompt(str);
}

const closePrompt = _ => {
    if (!prompt) return;
    rl.close();
    prompt = null;
}

export {
    getPrompt,
    closePrompt,
}