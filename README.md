**This is just a weekend project, so take it easy :-)**

## simple-worlde-solver

Wordle solver for `Node.js`.


I am aware of other efforts that use greedy algorithms and similars, but in the end I wanted to adopt simpler strategies that could mimic how a human would guess words or could be executed by just evaluating properties of the words (e.g. not considering all the combinations of the words).

## Dictionary

The dictionary has been copied from the Wordle javascript client.
It is splitted in two blocks, one with the words among which Wordle selects a solution every day, and another one with all the possibile inputs.
Of course the latter is bigger than the former. In total, summing up the two blocks, we have ~12000 words.

## Interactive mode

You can use `simple-wordle-solver` to solve a Wordle puzzle by interacting with the process stdin.

Start the program with
```
node index.js
```
the output will be
```
steps done = 0
remaining words = 12972
insert word (press ENTER to make a guess):
```
Here you can type a word or just press ENTER to make the program guess the next word to try.

By pressing ENTER the output will be:
```
picked "jehus"
insert wordle color mask (0=grey, 1=yellow, 2=green, press ENTER to skip word):
```
Now it's again user turn, you need to inesert the result from Wordle by writing a mask of length 5 made up of `0`, `1` or `2`, where:
- `0` -> grey
- `1` -> yellow
- `2` -> green

Now the program will eliminate the wrong solutions from the dictionary taking into account the mask and will prompt the user again for a new word.

The program will halt if a solution is found in under 6 steps or an error occurs.

## Unattended mode

The program can also be launched in unattended mode.
```
node index.js 1000 1
```

The first paramer is the number of iterations while the second one is the guess strategy to adopt.

For any iteration the program will pick a random solution and then challenge itself by using the guessing strategy defined in the command line.

This is very useful for e.g. comparing different strategies in terms of speed, success rate and average steps needed to solve.

When the programs ends it will present an useful summary.

```
total iterations	 = 1000
solved avg steps	 = 3.98
errors 			     = 0
solved %		     = 95%
unsolved %		     = 5%
```

## Strategies

- `0` : random guess among the remaining words

This works surprsingly well, with a success rate of ~94-95% in ~4.15 average steps. Of course it is the quickest strategy.

- `1` : pick words with the higest number of distinct chars

This is the default strategy. It has a success rate of ~95-96% in ~4.10 average steps. It executes in reasonable time.

- `2`: pick words with the most frequent chars in the remaining words

This strategy proved to be very poor. It has a success rate of ~87% in ~4.5 average steps. It also is very slow, since it needs to re-calculate chars frequency at each step.

- `3`: mix 1 and 2, pick words with the most frequent *distinct* chars

This is the best strategy in terms of success rate (~95-96%) and average steps needed (~3.8). However it is as slow as `3`.
