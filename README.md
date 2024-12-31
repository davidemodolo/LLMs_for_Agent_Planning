# MASTER THESIS PROJECT - LLM uncertainty with log-probability as Agent in Deliveroo.js

March 2025

## Deliveroo.js code

[Deliveroo Agent](https://github.com/unitn-ASA/DeliverooAgent.js)

[Deliveroo Server](https://github.com/unitn-ASA/Deliveroo.js)

## TODO README, now just a list of notes

**Idea**: we give an agent the atomic actions, let's see if it is able to solve a goal without giving instructions.
Generative AI solving general problem with not previous information.

Started with raw input and raw output with llama 3.2 and Mistral.

1. The idea is to give the raw output as seen in the prompt [prompt] and parse the raw
   output to get the action selected by the LLM.

2. inside the prompt, filter out the actions in two ways:

   - by a priori removing non-legal actions

   - by performing the action and checking if the state changed, if not, repurpose the
     prompt without that action.

Selecting only the top choice is called “greedy sampling” and actually doesn’t produce language that seems as human, despite being more reliable.

DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead. -> IGNORED

Cannot use batch API (50% discount) since I need to perform everything and I need to check the state of the environment after each action.

Add prompt caching - not under 1000 tokens prompt, but used when using conversation history.

TODO in order:

- [x] parametrize helping levels
- [x] use chat history (parametrize)
- [x] using the server configuration infos, reduce the dimension of the map given to the LLM depending on the max(PARCELS_OBSERVATION_DISTANCE, AGENTS_OBSERVATION_DISTANCE)
- [x] using the server configuration infos, better map the parcel reward to H, M, L
- [x] if no delivery point in sight, append the distance and the direction to the nearest one
- [x] use server output as raw input for the LLM
- [ ] test uncertainty in obvious situations
- [x] random weighted choice
- [ ] DFS to find the best path to the goal given the map
- [ ] test as steps vs DFS steps
- [ ] basic RAG implementation to add preferences (randomly assign ["pears", "apples", "bananas"] to the parcels and give a preference to the agent, to be recalled via RAG)
- [ ] custom server to select where to put the parcel (maybe using "god" mode)
- [ ] Add the image to the prompt

POSSIBLE TITLE: "Using LLM as choice selector for an agent in a web-based game environment, at different level of freedom, weighted by confidence"

Add cost in $$$ and token of every run

Expand with RAG

LAST NOTES:
if full raw, impossible, random weighted goes to the goal

check attention when map in the prompt https://github.com/jessevig/bertviz

When generating goal keep in mind something

find the closest cell and give me the action to go there (plot as the bigger distance between the goal is source fo uncertainty)

test with a shortest description of the map "di bocca buona" -> test with some kind of compression (base64?)

also try step1: closest cell>? -> step 2: action to go to closest cell?

Write about multi-choice benchmark for LLMs

This approach is like "Statelss" prompt
