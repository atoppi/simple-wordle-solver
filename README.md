**This is just a weekend project, so take it easy :-)**

## simple-worlde-solver

Wordle solver for `Node.js`.


I am aware of other efforts that use greedy algorithms and similars, but in the end I wanted to adopt simpler strategies that could mimic how a human would guess words or could be executed by just evaluating properties of the words (e.g. not considering all the combinations of the words).

## Dictionary

The dictionary has been copied from the Wordle javascript client.
It is splitted in two blocks, one with the words among which Wordle selects a solution every day, and another one with all the possibile inputs.
Of course the latter is bigger than the former. In total, summing up the two blocks, we have ~13000 words.

## Interactive mode

You can use `simple-wordle-solver` to solve a Wordle puzzle by interacting with the process stdin.

Start the program with
```
node index.js --strategy=0
```
the output will be
```
Importing dictionary and rank set...
--- dictionary size = 12972 (solutions = 2315)
--- ranks array size = 165507
--- interactive mode
--- using strategy 6
--- no answer supplied

step #1
remaining words = 12972
insert word (press ENTER to make a guess):
```
Here you can type a word or just press ENTER to make the program guess the next word to try.

By pressing ENTER the output will be:
```
picked "recal"
insert wordle color mask (0=grey, 1=yellow, 2=green, press ENTER to skip word):
```
Now it's again user turn, you need to inesert the result from Wordle by writing a mask of length 5 made up of `0`, `1` or `2`, where:
- `0` -> grey
- `1` -> yellow
- `2` -> green

Now the program will eliminate the wrong solutions from the dictionary taking into account the mask and will prompt the user again for a new word.

```
insert wordle color mask (0=grey, 1=yellow, 2=green, press ENTER to skip word): 00110
[12972] word "recal" -> mask "00110"

step #2
remaining words = 203
insert word (press ENTER to make a guess):

```

The program will halt if a solution is found in under 6 steps or an error occurs.

## Unattended mode

The program can also be launched in unattended mode by setting the flag `unattended`.
```
node index.js --unattended --strategy=1
```

For any iteration the program will pick a solution from the dictionay and then challenge itself by using the guessing strategy defined in the command line.

This is very useful for e.g. comparing different strategies in terms of speed, success rate and average steps needed to solve.

When the program ends it will present an useful summary.

```
total iterations	 = 2315
solved avg steps	 = 4.59
errors 			     = 0
solved %		     = 89.91%
unsolved %		     = 10.09%
```

## Setting a target solution

You can set a target solution by passing the argument `--answer`.

```
node index.js --answer=paper
```

By setting an answer the program will auto-evaluate the result mask in interactive mode and will use only that answer in unattended mode.

```
node index.js --answer=paper --unattended
```

## Strategies

- `0` : random guess among the remaining words

This works surprsingly well, with a success rate of 88.6% in 4.6 average steps. Of course it is the quickest strategy.

- `1` : pick words with the higest number of distinct chars

It has a success rate of 92.5% in 4.4 average steps. It executes in reasonable time.

- `2`: pick words with the most frequent chars among the remaining words

This strategy proved to be very poor. It has a success rate of 79.3% in 5.0 average steps. It also is very slow, since it needs to re-calculate chars frequency at each step.

- `3`: mix 1 and 2, picking words with the most frequent *distinct* chars

It has a success rate of 93% with 4.3 average steps needed. However it is as slow as `2`.

- `4`: similar to `3`, but pick words with the most frequent distinct chars in a *specific position*

It has a success rate of 94.6% with 4.2 average steps needed.

- `5`: refine `4`, by picking the most common english word among the candidates selected by strategy `4`

It has a success rate of 97.1% in 4.1 average steps.

- `6`: refine `5`, when remaining solutions set is very small does not evaluate the strategy `4` metric and just picks the most common english word

It has a success rate of 98.3% in 4.1 average steps.

This is the default strategy.