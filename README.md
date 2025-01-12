# MASTER THESIS PROJECT - LLM uncertainty with log-probability as Agent in Deliveroo.js

FINAL GOAL: March 2025

## Deliveroo.js code

[Deliveroo Agent](https://github.com/unitn-ASA/DeliverooAgent.js)

[Deliveroo Server](https://github.com/unitn-ASA/Deliveroo.js)

# LIST OF TODOs IMPLEMENTATION:

> bold means ongoing

- [x] rework the agent code to be even more modular -> not much modular, I think it's not needed anymore
- [ ] **prepare the blueprint for all the prompts**
- [x] module for encoded map (base64) -> it uses more tokens, it could work (https://arxiv.org/abs/2305.18396) but it may be outside of the scope of this project since they encode for safe transmission
- [x] ask for best tile to move on -> if it's blocked, should I ignore it or should the LLM infer from tile list?
- [ ] **ask for action to the best tile**
- [x] visualize attention for prompt -> results in `data_and_results\attention_visualizer\attention_visualize.ipynb` -> need to study the plots
- [ ] RAG implementation for artificially added categories to parcels
- [ ] RAG implementation for blocked tiles workaround
  > The last time you were on (5, 1) you tried to move up but the path was blocked.
  > problem: if the map is not necessary, this becomes a trial and error with RAG as history
- [ ] full flow
- [ ] full flow with best cell approach

# LIST OF TODOs EVALUATION (code update):

> bold means ongoing

- [x] automatic heatmap creation
- [ ] metrics for path/best path
- [x] % of time the correct answer is in the topX selected actions
- [ ] uncertainty in non-ambiguous situations
- [x] plot the ratio between distance_to_goal/uncertainty to see if the distance to the goal is source for uncertainty

# MAYBE TODO:

> bold means ongoing

- [ ] add image to the prompt
- [ ] create a parcer for the map response that would work even if the API changes completely, and at the same time it reduces the size in the prompt for the map (keeping it human-readable)

# TESTs TODO:

- [ ] different position of the goal tile to see if its relative position in the prompt gives better or worse performance

# Random Notes

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

_DeprecationWarning_: The `punycode` module is deprecated. Please use a userland alternative instead. -> IGNORED

---

I cannot use batch API (50% discount) since I need to perform everything and I need to check the state of the environment after each action.

Automatic prompt caching - not under 1000 tokens - but when using conversation history it is being used.

OLD TODO:

- [x] parametrize helping levels
- [x] use chat history (parametrize)
- [x] using the server configuration infos, reduce the dimension of the map given to the LLM depending on the max(PARCELS_OBSERVATION_DISTANCE, AGENTS_OBSERVATION_DISTANCE)
- [x] using the server configuration infos, better map the parcel reward to H, M, L
- [x] if no delivery point in sight, append the distance and the direction to the nearest one
- [x] use server output as raw input for the LLM
- [x] random weighted choice
- [ ] ~~test uncertainty in obvious situations~~ Included to metrics todo
- [ ] ~~DFS to find the best path to the goal given the map~~ Included to metrics todo
- [ ] ~~test as steps vs DFS steps~~ Included to metrics todo
- [ ] ~~basic RAG implementation to add preferences (randomly assign ["pears", "apples", "bananas"] to the parcels and give a preference to the agent, to be recalled via RAG)~~ Included in RAG todo
- [ ] ~~custom server to select where to put the parcel (maybe using "god" mode)~~ Already possible in god mode
- [ ] ~~Add the image to the prompt~~ Included in implementation todo
- [x] Add cost in $$$ and token of every run: added token count, will calculate the price automatically **at the end**;

LAST MEETING NOTES:

Using 'full raw' output makes the goal impossible to achieve due to some tiles where the best action is perceived as uniform probability between all actions -> Using the random choice weighted by probability, the agent will reach the goal.

Example on "Attention visualization": https://github.com/jessevig/bertviz - it can be use to see if my idea is correct (the attentions flats out due to the long map description, but it should be needed to keep the project robust even if the Deliveroojs server API response changes).

There are a couple of well known LLM benchmarks that are basically multi-choice quiz answers. This may be included in the thesis.

Information for the _possible title_:

- stateless prompt: if no history is used, the prompt contains all the information for the current request
- LLM as choice selector
- conformal prediction, logprobs based uncertainty
- web-based game environment
- confidence based choice

# Resources

> **Robots That Ask For Help: Uncertainty Alignment for Large Language Model Planners**  
> Allen Z. Ren, Anushri Dixit, Alexandra Bodrova, Sumeet Singh, Stephen Tu, Noah Brown, Peng Xu,  
> Leila Takayama, Fei Xia, Jake Varley, Zhenjia Xu, Dorsa Sadigh, Andy Zeng, Anirudha Majumdar  
> _2023_.  
> [arXiv:2307.01928](https://arxiv.org/abs/2307.01928)
