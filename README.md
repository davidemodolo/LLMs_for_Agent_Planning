Started with raw input and raw output with llama 3.2 and Mistral.

1. The idea is to give the raw output as seen in the prompt [prompt] and parse the raw
   output to get the action selected by the LLM.

2. inside the prompt, filter out the actions in two ways:

   - by a priori removing non-legal actions

   - by performing the action and checking if the state changed, if not, repurpose the
     prompt without that action.

Selecting only the top choice is called “greedy sampling” and actually doesn’t produce language that seems as human, despite being more reliable.

https://github.com/unitn-ASA/DeliverooAgent.js

DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead. -> IGNORED

Cannot use batch API (50% discount) since I need to perform everything and I need to check the state of the environment after each action.

TODO: Add prompt caching

POSSIBLE TITLE: "Using LLM as choice selector for an agent in a web-based game environment, at different level of freedom, weighted by confidence"
