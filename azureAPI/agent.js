import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import OpenAI from "openai";
import fs from "fs";
import tiktoken from "tiktoken";
// import { Agent } from "openai/_shims/node-types.mjs";
const apiKey = fs.readFileSync("key.txt", "utf8").trim();
const openai = new OpenAI({
  apiKey: apiKey,
});

/*
gpt-3.5-turbo-0125 - $0.50 / 1M tokens - $1.50 / 1M tokens
gpt-4o-mini - $0.150 / 1M input tokens - $0.075 / 1M input tokens
gpt-4o - $2.50 / 1M input tokens

*/

const USE_HISTORY = true; // set to true to use the conversation history
const MODEL = "gpt-4o-mini";
const POSSIBLE_LOGICS = ["raw", "random", "threshold"];
const LOGIC = POSSIBLE_LOGICS[0];
var GOAL = "pickup";
var OLD_GOAL = "pickup";
const conversationHistory = [];
const fullConversationHistory = [];
function addHistory(roleAdd, contentAdd) {
  conversationHistory.push({ role: roleAdd, content: contentAdd });
  fullConversationHistory.push({ role: roleAdd, content: contentAdd });
  // if (conversationHistory.length > 5) {
  //   conversationHistory.splice(0, 2);
  // }
}
async function queryAzureLLM(prompt, logprobs, top_logprobs, logit_bias_dict) {
  const apiUrl = "http://localhost:8000/query"; // Update with the actual server URL
  var promptString = JSON.stringify(prompt);
  //remove the \ns
  promptString = promptString.replace(/\\n/g, " ");
  promptString = promptString.replace(/\\"/g, '"');
  console.log("Prompt: ", promptString);
  console.log("Logprobs: ", logprobs);
  console.log("Top logprobs: ", top_logprobs);
  console.log("Logit bias dict: ", logit_bias_dict);
  const requestBody = {
    prompt: promptString,
    logprobs: logprobs,
    top_logprobs: top_logprobs,
    logit_bias_dict: logit_bias_dict,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    console.log("Log Probs Result:", result.log_probs);
    console.log("Total Tokens:", result.total_tokens);
    return result;
  } catch (error) {
    console.error("Error querying LLM:", error);
  }
}
async function knowno_OpenAI(prompt, tokens_to_check, qhat = 0.928) {
  const LOGIT_BIAS = 20;
  const logits_bias_dict = createLogitsBiasDict(tokens_to_check);
  // if prompt == null, exit and print
  addHistory("user", prompt);
  const completion = await queryAzureLLM(
    USE_HISTORY
      ? conversationHistory
      : [
          {
            role: "user",
            content: prompt,
          },
        ],
    true,
    LOGIT_BIAS,
    logits_bias_dict
  );
  total_tokens += completion.total_tokens;
  fs.writeFileSync("completion.json", JSON.stringify(completion, null, 2));

  const top_logprobs_full = completion.log_probs;
  const top_tokens = [];
  const top_logprobs = [];
  for (const element in top_logprobs_full) {
    top_tokens.push(element);
    top_logprobs.push(top_logprobs_full[element]);
  }

  console.log("Top tokens: ", top_tokens);
  console.log("Top logprobs: ", top_logprobs);

  const results_dict = {};
  console.log("Tokens to check: ", tokens_to_check);
  top_tokens.forEach((token, i) => {
    const character = token.trim().toUpperCase();
    if (tokens_to_check.includes(character) && !results_dict[character]) {
      results_dict[character] = top_logprobs[i];
    }
  });
  console.log("Results dict: ", results_dict);

  tokens_to_check.forEach((token) => {
    if (!results_dict[token]) {
      results_dict[token] =
        top_logprobs[top_logprobs.length - 1] +
        top_logprobs[top_logprobs.length - 2];
    }
  });
  console.log("Results dict: ", results_dict);

  const temperature_softmax = 10; // Define the temperature
  const exp_logprobs = Object.values(results_dict).map((logprob) =>
    Math.exp(logprob / temperature_softmax)
  );
  const sum_exp_logprobs = exp_logprobs.reduce((sum, val) => sum + val, 0);
  const top_logprobs_norm = exp_logprobs.map((val) => val / sum_exp_logprobs);
  console.log("Top logprobs norm: ", top_logprobs_norm);
  const mc_smx_all = temperatureScaling(top_logprobs_norm);
  console.log("MC SMX all: ", mc_smx_all);

  const final = Object.keys(results_dict).map((element, i) => [
    element,
    mc_smx_all[i] >= 1 - (qhat || 0.928),
    mc_smx_all[i],
  ]);
  final.sort((a, b) => b[2] - a[2]);
  console.log("Final: ", final);
  return final;
}

function temperatureScaling(logits, temperature = 0.1) {
  // Scale logits by temperature
  logits = logits.map((logit) => logit / temperature);

  // Subtract max to avoid numerical overflow
  const maxLogit = Math.max(...logits);
  logits = logits.map((logit) => logit - maxLogit);

  // Calculate softmax
  const expLogits = logits.map((logit) => Math.exp(logit));
  const sumExpLogits = expLogits.reduce((a, b) => a + b, 0);
  const softmax = expLogits.map((expLogit) => expLogit / sumExpLogits);

  return softmax;
}

function createLogitsBiasDict(elements) {
  const encoding = tiktoken.encoding_for_model(MODEL);
  const logitsBiasDict = {};
  if (elements.length == 0) {
    return logitsBiasDict;
  }

  elements.forEach((element) => {
    logitsBiasDict[encoding.encode(element)[0]] = 100;
  });
  console.log("Logits bias dictionary: ", logitsBiasDict);

  return logitsBiasDict;
}

var total_tokens = 0;

const AgentLink = "http://localhost:8080/?name=raw_llm_agent";
const AgentKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc1ZDRlNzhlZDhlIiwibmFtZSI6InJhd19sbG1fYWdlbnQiLCJpYXQiOjE3MzAzODc4Njd9.4EQlPWKgOFGBUn0MpXOZQI2CkPHBjggnDKu76kpPrkI";
const client = new DeliverooApi(AgentLink, AgentKey);

const DELIVERY = 2;
const BLOCK = 0;
const WALKABLE = 1;
const ENEMY = "E";
const deliveryZones = new Set();
var mapGame;
var heightMax;
var mapOriginal = null;

var rawOnMap = null;

client.onMap((width, height, tiles) => {
  //console.log("Map received: ", width, height, tiles);
  // create a matrix wxh
  rawOnMap = { width, height, tiles };
  heightMax = height;
  mapGame = new Array(height)
    .fill(BLOCK)
    .map(() => new Array(width).fill(BLOCK));

  for (var tile of tiles) {
    const tileX = tile.x;
    const tileY = height - 1 - tile.y;
    //console.log("Tile: ", tileX, tileY, tile.delivery);
    mapGame[tileY][tileX] = tile.delivery ? DELIVERY : WALKABLE;
    if (tile.delivery) {
      deliveryZones.add([tileX, tileY]);
    }
  }
  mapOriginal = mapGame.map((row) => row.slice());
});
setTimeout(() => {}, 2000);

function getClosestDeliveryPoint() {
  let closestDeliveryPoint = null;
  let minDistance = Number.MAX_VALUE;
  for (const deliveryPoint of deliveryZones) {
    const [deliveryX, deliveryY] = deliveryPoint;
    const manhattanDistance =
      Math.abs(me.x - deliveryX) + Math.abs(me.y - deliveryY);
    if (manhattanDistance < minDistance) {
      minDistance = manhattanDistance;
      closestDeliveryPoint = [deliveryY, deliveryX];
    }
  }
  return closestDeliveryPoint;
}

var AGENTS_OBSERVATION_DISTANCE = null;
var PARCELS_OBSERVATION_DISTANCE = null;
var PARCEL_REWARD_AVG = null;
var ACTION_DELAY = null;
client.onConfig((conf) => {
  AGENTS_OBSERVATION_DISTANCE = conf.AGENTS_OBSERVATION_DISTANCE; //Agent observation distance
  PARCELS_OBSERVATION_DISTANCE = conf.PARCELS_OBSERVATION_DISTANCE; //Parcel observation distance
  PARCEL_REWARD_AVG = conf.PARCEL_REWARD_AVG; //Parcel reward average
  ACTION_DELAY = conf.MOVEMENT_DURATION;
});
setTimeout(() => {}, 1000);

const me = {};
var rawOnYou = null;

client.onYou(({ id, name, x, y, score }) => {
  rawOnYou = { id, name, x, y, score };
  me.id = id;
  me.name = name;
  me.x = Math.round(x);
  me.y = heightMax - 1 - Math.round(y); // Adjust the y coordinate
  me.score = score;
});

var numParcels = 0;
var parcelBelow = false;

// add the parcel sensing method to remember the list of parcels
const parcels = new Map();
var rawOnParcelsSensing = null;
client.onParcelsSensing(async (perceived_parcels) => {
  rawOnParcelsSensing = perceived_parcels;
  numParcels = 0;
  parcelBelow = false;
  // reset parcels
  parcels.clear();
  for (const p of perceived_parcels) {
    const parcelX = Math.round(p.x);
    const parcelY = heightMax - 1 - Math.round(p.y);

    if (!p.carriedBy) {
      parcels.set(p.id, p);
    }
    if (p.carriedBy == me.id) {
      numParcels++;
    } else {
      if (parcelX == me.x && parcelY == me.y) {
        parcelBelow = true;
      }
    }
  }
});

const enemyAgents = new Map();
var rawOnAgentsSensing = null;
client.onAgentsSensing(async (perceived_agents) => {
  rawOnAgentsSensing = perceived_agents;
  // reset all the enemy agents coordinates as the original values
  for (const a of enemyAgents.values()) {
    mapGame[a[0]][a[1]] = mapOriginal[a[0]][a[1]];
  }
  for (const a of perceived_agents) {
    a.x = Math.round(a.x);
    a.y = heightMax - 1 - Math.round(a.y);
    enemyAgents.set(a.id, [a.y, a.x]);
    // set a block in the position of the agent
    mapGame[a.y][a.x] = ENEMY;
  }
});

const POSSIBLE_ACTIONS = ["U", "D", "L", "R", "T", "S"];
const POSSIBLE_ACTIONS_DESCRIPTION = {
  U: "move up (decrease your x by 1)",
  D: "move down (increase your x by 1)",
  L: "move left (decrease your y by 1)",
  R: "move right (increase your y by 1)",
  T: "take the parcel that is in your tile",
  S: "ship a parcel (you must be in a delivery=true tile)",
};
function buildActionsText(allowedActions) {
  return POSSIBLE_ACTIONS.filter((a) => allowedActions.includes(a))
    .map((a) => `${a}): ${POSSIBLE_ACTIONS_DESCRIPTION[a]}`)
    .join("\n");
}

function getRawPrompt() {
  GOAL = numParcels > 0 ? "deliver" : "pickup";
  const CUSTOM_ORIENTATION = true;
  const PARCERL_CATEGORIZATION = false;
  var prompt = "";
  // repeat the prompt every 5 steps
  if (conversationHistory.length == 0 || !USE_HISTORY || GOAL != OLD_GOAL) {
    OLD_GOAL = GOAL;
    prompt = `You are a delivery agent in a web-based delivery game where the map is a matrix.\nI am going to give you the raw information I receive from the server and the possible actions.`;
    if (GOAL == "deliver") {
      prompt += `\nYour current goal is to go to a tile with delivery == true.`;
    }
    const noParcelSpawnerTiles = [];
    for (let tile of rawOnMap.tiles) {
      var tileX = tile.x;
      var tileY = tile.y;
      if (CUSTOM_ORIENTATION) {
        const tmp = tileX;
        tileX = Math.abs(tileY - (heightMax - 1));
        tileY = tmp;
      }
      tile = { x: tileX, y: tileY, delivery: tile.delivery };
      noParcelSpawnerTiles.push(tile);
    }
    // sort the tiles first by x and then by y
    noParcelSpawnerTiles.sort((a, b) => {
      if (a.x == b.x) {
        return a.y - b.y;
      }
      return a.x - b.x;
    });

    // raw onMap
    prompt += `\nMap width: ${rawOnMap.width}\nMap height: ${
      rawOnMap.height
    }\nTiles are arranged as ${rawOnMap.height} rows in ${
      rawOnMap.width
    } columns:${JSON.stringify(noParcelSpawnerTiles, null, 3)}\n`;
  }

  // remove the parcelSpawned property from the tiles, tiles are {"x":0,"y":0,"delivery":false,"parcelSpawner":true}

  // work on the coordinates of the agent
  var agentX = rawOnYou.x;
  var agentY = rawOnYou.y;
  if (CUSTOM_ORIENTATION) {
    console.log("Before: ", rawOnYou);
    const tmp = agentX;
    agentX = Math.abs(agentY - (heightMax - 1));
    agentY = tmp;
    console.log("After: ", rawOnYou);
  }

  // raw onYou
  //prompt += `\nRaw 'onYou' response: ${JSON.stringify(rawOnYou)}\n`;

  // work on the coordinates of the parcels

  const parcels = [];

  for (let parcel of rawOnParcelsSensing) {
    const newParcel = { x: parcel.x, y: parcel.y };
    var parcelX = parcel.x;
    var parcelY = parcel.y;
    if (CUSTOM_ORIENTATION) {
      const tmp = parcelX;
      parcelX = Math.abs(parcelY - (heightMax - 1));
      parcelY = tmp;
    }
    newParcel.x = parcelX;
    newParcel.y = parcelY;
    parcels.push(newParcel);
  }

  if (PARCERL_CATEGORIZATION) {
    for (let parcel of rawOnParcelsSensing) {
      const parcelIdNumber = parseInt(parcel.id.substring(1));
      parcel.food = parcelIdNumber % 2 === 0 ? "banana" : "pineapple";
    }
  }
  // raw onParcelsSensing
  if (GOAL == "pickup") {
    prompt += `\nThe parcel you need to take is in the spot (${parcels[0].x}, ${parcels[0].y}).\n`;
  }

  // work on the coordinates of the agents
  if (rawOnAgentsSensing.length > 0) {
    if (CUSTOM_ORIENTATION) {
      for (let agent of rawOnAgentsSensing) {
        const tmp = agent.x;
        agent.x = Math.abs(agent.y - (heightMax - 1));
        agent.y = tmp;
      }
    }
    // raw onAgentsSensing
    prompt += `\nRaw 'onAgentsSensing' response: ${JSON.stringify(
      rawOnAgentsSensing
    )}\n`;
  }
  prompt += `\nYou are in the spot (${agentX}, ${agentY}).\n`;
  prompt += `\nACTIONS you can do:\n${buildActionsText(POSSIBLE_ACTIONS)}\n\n`;
  if (GOAL == "pickup") {
    prompt += `Your final goal is to go to a tile with the parcel and (T)ake it, `;
  } else if (GOAL == "deliver") {
    prompt += `You have a parcel, your final goal is to go to a delivery zone and (S)hip the parcel, `;
  }
  prompt += `I need the best action that will get you there. Don't explain the reasoning and don't add any comment, just provide the action. What is your next action?`;
  // save the prompt to prompt.txt
  //fs.writeFileSync(`prompt${fullConversationHistory.length}.txt`, prompt);
  fs.writeFileSync(`promptOBS.txt`, prompt);
  return prompt;
}

function getWeightedRandomIndex(weights) {
  const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i]) {
      return i;
    }
    random -= weights[i];
  }
}

function uncertaintyLogic(response, threshold = null, logic = LOGIC) {
  // if the logic is raw, return the response[0][0]
  if (logic == "raw") {
    return response[0][0];
  }
  const filteredResponse = response.filter((r) => r[1] == true);
  if (filteredResponse.length == 1) {
    return filteredResponse[0][0];
  }
  // if the logic is random, return a random element from the response elements having response[x][1] == true
  if (logic == "random") {
    const weights = filteredResponse.map((r) => r[2]);
    // acc is the accumulator, weight is the current weight
    const weightedRandomIndex = getWeightedRandomIndex(weights);
    if (!threshold) {
      return filteredResponse[weightedRandomIndex][0];
    } else {
      const filteredResponseT = filteredResponse.filter(
        (r) => r[2] >= threshold
      );
      const weightsT = filteredResponseT.map((r) => r[2]);
      const weightedRandomIndexT = getWeightedRandomIndex(weightsT);
      return filteredResponseT[weightedRandomIndexT][0];
    }
  }
  if (logic == "help") {
    const question = `The model is uncertain about the next action. The possible actions are: ${filteredResponse}`;
    console.log(question);
    var answer = null;
    while (answer == null) {
      answer = readline.question("What is your next action? ");
      if (!POSSIBLE_ACTIONS.includes(answer)) {
        console.log("Error: the action is not valid.");
        answer = null;
      }
    }
    return answer;
  }
}

async function agentLoop() {
  // get current time
  const start = new Date().getTime();
  // stop after 5 minutes
  // while (new Date().getTime() - start < 5 * 60 * 1000) {
  const MINUTES = 5;
  while (new Date().getTime() - start < MINUTES * 60 * 1000) {
    if (me.score > 0) {
      console.log(
        "Time elapsed:",
        (new Date().getTime() - start) / 1000,
        "seconds"
      );
      break;
    }
    if (!mapGame) {
      await client.timer(100);
      continue;
    }
    const rawPrompt = getRawPrompt();
    console.log("Raw prompt: ", rawPrompt);
    var response = await knowno_OpenAI(rawPrompt, POSSIBLE_ACTIONS);
    response = uncertaintyLogic(response);
    console.log("Action: ", response);
    fs.writeFileSync("action.txt", response);
    switch (response) {
      case "U":
        await client.move("up");
        break;
      case "D":
        await client.move("down");
        break;
      case "L":
        await client.move("left");
        break;
      case "R":
        await client.move("right");
        break;
      case "T":
        await client.pickup();
        break;
      case "S":
        await client.putdown();
        break;
      default:
        console.log("Error in action:", action);
    }
    addHistory("assistant", response);
    // set to false since I'm just testing
    // here we have the full logic
    //await client.timer(ACTION_DELAY);
    await client.timer(2000);
  }
  // save the conversation history to a file
  fs.writeFileSync(
    "conversationHistory.json",
    JSON.stringify(fullConversationHistory, null, 2)
  );
  // end the program
  process.exit();
}

agentLoop();
