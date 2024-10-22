Started with raw input and raw output with llama 3.2 and Mistral.

1. The idea is to give the raw output as seen in the prompt [prompt] and parse the raw
   output to get the action selected by the LLM.

2. inside the prompt, filter out the actions in two ways:

   - by a priori removing non-legal actions

   - by performing the action and checking if the state changed, if not, repurpose the
     prompt without that action.
