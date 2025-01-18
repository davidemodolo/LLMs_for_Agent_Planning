This folder contains the prompts' blueprint that are called in the agents' code.

**Prompts**:

- `deliver` (width, height, tiles, agentX, agentY): next action when the goal is to go to a delivery tile and deliver;
- `pickup` (width, height, tiles, parcelX, parcelY, agentX, agentY): next action when the goal is to pickup a parcel;
- `choose_goal`: TODO prompt to make the LLM decide between pickup and deliver
- `best_tile` (width, height, tiles, numParcel, parcels, agentX, agentY, possibleTiles): tile that will get the agent closer to the final goal;
- `action_given_tile` (width, height, tiles, agentX, agentY, goalX, goalY, RAG): action to go to the goal tile;
- `rag_blocked_tile`: TODO prompt that will list the preference on the workaround to a blocked tile;
- `path_finding` (width, height, tiles, agentX, agentY, goalX, goalY): basic implementation, to find the action to reach a cell.
