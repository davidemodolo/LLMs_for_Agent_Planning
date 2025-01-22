# Introduction (2/3 pages)

> context, problem, state-of-the-art, specific problem of the thesis, objective/objectives, expected results, structure

## context, problem, state-of-the-art, specific problem of the thesis, objective/objectives

context: AI, Generative systems
problem: Generative AI system are capable of planning and reaching a goal. Are LLM capable?
state-of-the-art: LLM applied to similar problems
specific problem of the thesis:
objective/objectives: show the effectiveness of an LLM of a typical AI problem (logistics)
expected results: a generative system without any reasoning capabilities is able to solve a problem of this type? And to what extent?

Everyone says LLM are incredible for everything.
My thesis: let's try to apply them to the delivery problem. A very simple problem, a classic problem for AI, that is composed by:

- a planing problem
- a reasoning problem
- ...

This can be faced in a classic way with PDDL (time intensive), RL. We want to address this with LLMs.

## structure (to be done at the end of the thesis)

# Chapter 1

> state-of-the-art, background

SOTA: PDDL, RL
bg: uncertainty for LLMs papers, conformal prediction, BD, agents,

# Chapter 2

Experiment setting (deliveroo.js, GPT, no LLAMA)

# Chapter 3

First approach, give everything (no decomposition of the problem)
Stateless & Stateful

# Chapter 4

Attention visualizer
Better prompts
Prompt creation accordingly to papers (give a role, where to put the goal, knowno, few-shot working means the prompt is correct)
Attetion, encoding base64
Last approach, find the closest cell

# Results discussion

This is a generative approach.
Path accuracy
Heatmaps

# Conclusions (2 pages)

> thesis objectives, achieved results, limitations, future developments
> 59 mins

limitation: token for context limit in stateful
