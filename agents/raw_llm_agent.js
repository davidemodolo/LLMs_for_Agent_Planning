import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import axios from "axios";
import OpenAI from "openai";
import fs from "fs";
import tiktoken from "tiktoken";
import { exit } from "process";
const apiKey = fs.readFileSync("key.txt", "utf8").trim();
const openai = new OpenAI({
  apiKey: apiKey,
});
// import { planner, goalParser, mapParser, readDomain } from "./PDDL_planner.js";
// import { findDeliveryPoint } from "./astar_utils.js";

/*
gpt-3.5-turbo-0125 - $0.50 / 1M tokens - $1.50 / 1M tokens
gpt-4o-mini - $0.150 / 1M input tokens - $0.075 / 1M input tokens


*/

const ANTI_LOOP = true; // set to true to avoid the agent to go back and forth
const HELP_THE_BOT = true; // set to true to force the bot to take the parcel if it is below the agent or to ship the parcel if the agent is in the delivery point
const SELECT_ONLY_ACTION = true; // set to true to select the only action if the list of available actions has only one element
const USE_HISTORY = true; // set to true to use the conversation history
const REDUCED_MAP = true; // using the server configuration infos, reduce the dimension of the map given to the LLM depending on the max(PARCELS_OBSERVATION_DISTANCE, AGENTS_OBSERVATION_DISTANCE)
// see this help as "the robot always knows where it started and can always go back to the starting point"
const HELP_FIND_DELIVERY = true; // set to true to add to the prompt the closest delivery point even if it is not in the field of view
const HELP_SIMULATE_NEXT_ACTIONS = false; // set to true to add to the prompt the effect (the resulting environment) of every action

const results = new Map();
results.set("ANTI_LOOP", ANTI_LOOP);
results.set("HELP_THE_BOT", HELP_THE_BOT);
results.set("SELECT_ONLY_ACTION", SELECT_ONLY_ACTION);
results.set("USE_HISTORY", USE_HISTORY);
results.set("REDUCED_MAP", REDUCED_MAP);
results.set("HELP_FIND_DELIVERY", HELP_FIND_DELIVERY);
results.set("HELP_SIMULATE_NEXT_ACTIONS", HELP_SIMULATE_NEXT_ACTIONS);
const conversationHistory = [];
const fullConversationHistory = [];
function addHistory(roleAdd, contentAdd) {
  conversationHistory.push({ role: roleAdd, content: contentAdd });
  fullConversationHistory.push({ role: roleAdd, content: contentAdd });
  if (conversationHistory.length > 5) {
    conversationHistory.splice(0, 2);
  }
}

function simulateActions(mapString, testActions) {
  const simulatedMaps = {};
  for (let action of testActions) {
    // convert back the mapString to a matrix
    const nextMap = mapString.split("\n").map((row) => row.split(" "));
    // get the current position of the agent from the nextMap by finding the A, X or Q character
    let agentPosition = null;
    for (let row in nextMap) {
      for (let col in nextMap[row]) {
        if (
          nextMap[row][col] == "A" ||
          nextMap[row][col] == "X" ||
          nextMap[row][col] == "Q"
        ) {
          agentPosition = [col, row];
          break;
        }
      }
    }
    var newY = agentPosition[1];
    var newX = agentPosition[0];
    nextMap[newY][newX] = mapOriginal[me.y][me.x];
    switch (action) {
      case "U":
        newY--;
        break;
      case "D":
        newY++;
        break;
      case "L":
        newX--;
        break;
      case "R":
        newX++;
        break;
      case "T":
        break;
      case "S":
        break;
      default:
        console.log("Error in action:", action);
    }
    console.log("newX, newY: ", newX, newY);
    const deltaX = newX - agentPosition[0];
    const deltaY = newY - agentPosition[1];
    // these are the coordinates of the agent in the original map when the new action is simulated
    const originalX = me.x + deltaX;
    const originalY = me.y + deltaY;

    var parcelBelowSimul = false;
    for (const parcel of parcels.values()) {
      if (parcel.x == originalX && parcel.y == originalY) {
        parcelBelowSimul = true;
        break;
      }
    }

    nextMap[newY][newX] = parcelBelowSimul
      ? "X"
      : mapOriginal[originalY][originalX] == "" + DELIVERY
      ? "Q"
      : "A";
    simulatedMaps[action] = nextMap;
  }
  return simulatedMaps;
}

async function knowno_OpenAI(
  prompt,
  tokens_to_check,
  qhat = 0.928,
  temp = 3.0,
  model = MODEL
) {
  const LOGIT_BIAS = 20;
  const logits_bias_dict = createLogitsBiasDict(tokens_to_check);

  addHistory("user", prompt);
  const completion = await openai.chat.completions.create({
    model: model,
    messages: USE_HISTORY
      ? conversationHistory
      : [
          {
            role: "user",
            content: prompt,
          },
        ],
    max_tokens: 1,
    logprobs: true,
    top_logprobs: LOGIT_BIAS,
    logit_bias: logits_bias_dict,
  });
  total_tokens += completion.usage.total_tokens;

  const top_logprobs_full =
    completion.choices[0].logprobs.content[0].top_logprobs;
  /*Top logprobs:  [
  { token: 'D', logprob: -0.0015024792, bytes: [ 68 ] },
  { token: 'R', logprob: -6.5015025, bytes: [ 82 ] },
  { token: 'L', logprob: -16.376503, bytes: [ 76 ] }, */
  const top_tokens = [];
  const top_logprobs = [];
  for (const element of top_logprobs_full) {
    top_tokens.push(element.token);
    top_logprobs.push(element.logprob);
  }

  console.log("Top tokens: ", top_tokens);
  console.log("Top logprobs: ", top_logprobs);

  const results_dict = {};
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
  addHistory("assistant", final[0][0]);
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

async function askLocalLLM(prompt) {
  const url = "http://localhost:11434/api/generate";
  const data = {
    model: "llama3.2",
    prompt: conversationHistory.concat(prompt).join("\n"),
    stream: false,
    options: { num_predict: 100, seed: -1 },
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    const llmResponse = response.data;
    conversationHistory.push(prompt, llmResponse.response);
    return llmResponse;
  } catch (error) {
    console.error("Error in response:", error);
  }
}

const MODEL = "gpt-4o-mini";

const tokens_to_check = ["U", "D", "L", "R", "T", "S"];

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

const logits_bias_dict = createLogitsBiasDict(tokens_to_check);
var total_tokens = 0;

async function getCompletion(
  prompt,
  logits_bias_dictionary = logits_bias_dict
) {
  addHistory("user", prompt);
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: USE_HISTORY
      ? conversationHistory
      : [{ role: "user", content: prompt }],
    max_tokens: 1,
    logprobs: true,
    top_logprobs: 20,
    logit_bias: logits_bias_dictionary,
  });
  addHistory("assistant", completion.choices[0].message.content);
  total_tokens += completion.usage.total_tokens;
  // save the completion to completion.json
  fs.writeFileSync("completion.json", JSON.stringify(completion, null, 2));
  return completion.choices[0].message.content;
}

const client = new DeliverooApi(
  "http://localhost:8080/?name=raw_llm_agent",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc1ZDRlNzhlZDhlIiwibmFtZSI6InJhd19sbG1fYWdlbnQiLCJpYXQiOjE3MzAzODc4Njd9.4EQlPWKgOFGBUn0MpXOZQI2CkPHBjggnDKu76kpPrkI"
);

const DELIVERY = 2;
const BLOCK = 0;
const WALKABLE = 1;
const ENEMY = "E";
const deliveryZones = new Set();
var mapGame;
var heightMax;
var mapOriginal = null;

client.onMap((width, height, tiles) => {
  //console.log("Map received: ", width, height, tiles);
  // create a matrix wxh
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
      deliveryZones.add([tileY, tileX]);
    }
  }
  mapOriginal = mapGame.map((row) => row.slice());
});
setTimeout(() => {}, 2000);

function getClosestDeliveryPoint() {
  let closestDeliveryPoint = null;
  let minDistance = Number.MAX_VALUE;
  for (const deliveryPoint of deliveryZones) {
    const distance =
      Math.abs(me.x - deliveryPoint[0]) + Math.abs(me.y - deliveryPoint[1]);
    if (distance < minDistance) {
      minDistance = distance;
      closestDeliveryPoint = deliveryPoint;
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

client.onYou(({ id, name, x, y, score }) => {
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
client.onParcelsSensing(async (perceived_parcels) => {
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
client.onAgentsSensing(async (perceived_agents) => {
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

function getParcelCharacter(parcel) {
  if (parcel.reward > (PARCEL_REWARD_AVG * 2) / 3) {
    return "H";
  } else if (parcel.reward > PARCEL_REWARD_AVG / 2) {
    return "M";
  } else {
    return "L";
  }
}

function reduceMap(bigMap) {
  const radius =
    Math.max(AGENTS_OBSERVATION_DISTANCE, PARCELS_OBSERVATION_DISTANCE) - 1;
  const x = me.x;
  const y = me.y;

  // compute the size on the right of the agent
  const right = Math.min(x + radius, bigMap[0].length - 1);
  // compute the size on the left of the agent
  const left = Math.max(x - radius, 0);
  // compute the size on the top of the agent
  const top = Math.max(y - radius, 0);
  // compute the size on the bottom of the agent
  const bottom = Math.min(y + radius, bigMap.length - 1);

  // create a new map of the right size
  const newMap = [];
  for (let i = top; i <= bottom; i++) {
    newMap.push(bigMap[i].slice(left, right + 1));
  }
  // return the new map as string
  return newMap.map((row) => row.join(" ")).join("\n");
}

function buildMap() {
  // check if the map is not defined
  if (!mapGame) {
    return null;
  }
  // create a copy of the map
  const newMap = mapOriginal.map((row) => row.slice());
  //console.log("newMap: ", newMap);
  // cycle through the parcels and set their parcel.reward at parcel.x, parcel.y position. If a value is higher than 9, set it to 9
  for (const parcel of parcels.values()) {
    console.log("Parcel X and Y: ", parcel.x, parcel.y);
    newMap[heightMax - 1 - parcel.y][parcel.x] = getParcelCharacter(parcel);
    //console.log("newMap: ", newMap);
  }
  // put an A in the position of the agent, X if there already is a parcel
  newMap[me.y][me.x] = parcelBelow
    ? "X"
    : mapGame[me.y][me.x] == DELIVERY
    ? "Q" // if the agent is in the delivery point
    : "A";
  // change every 0 to /
  newMap.forEach((row) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] == BLOCK) {
        row[i] = "/";
      }
    }
  });
  return REDUCED_MAP
    ? reduceMap(newMap)
    : newMap.map((row) => row.join(" ")).join("\n");
}

const POSSIBLE_ACTIONS = ["U", "D", "L", "R", "T", "S"];
const POSSIBLE_ACTIONS_DESCRIPTION = {
  U: "move up",
  D: "move down",
  L: "move left",
  R: "move right",
  T: "take a parcel",
  S: "ship a parcel",
};
function buildActionsText(allowedActions) {
  return POSSIBLE_ACTIONS.filter((a) => allowedActions.includes(a))
    .map((a) => `${a}): ${POSSIBLE_ACTIONS_DESCRIPTION[a]}`)
    .join("\n");
}

function getLegalActions(antiLoop = ANTI_LOOP, helpTheBot = HELP_THE_BOT) {
  const enemyAgentsPositions = Array.from(enemyAgents.values());
  const legalActions = [];
  if (mapGame[me.y][me.x] == DELIVERY && numParcels > 0) {
    legalActions.push("S");
    if (helpTheBot) {
      return legalActions;
    }
  }
  if (parcelBelow) {
    legalActions.push("T");
    if (helpTheBot) {
      return legalActions;
    }
  }
  if (
    me.y > 0 &&
    me.y - 1 < mapGame.length &&
    mapGame[me.y - 1][me.x] != BLOCK
  ) {
    if (!enemyAgentsPositions.some((a) => a[0] == me.x && a[1] == me.y - 1)) {
      legalActions.push("U");
    }
  }
  if (
    me.y < heightMax - 1 &&
    me.y + 1 < mapGame.length &&
    mapGame[me.y + 1][me.x] != BLOCK
  ) {
    if (!enemyAgentsPositions.some((a) => a[0] == me.x && a[1] == me.y + 1)) {
      legalActions.push("D");
    }
  }
  if (
    me.x > 0 &&
    me.x - 1 < mapGame[0].length &&
    mapGame[me.y][me.x - 1] != BLOCK
  ) {
    if (!enemyAgentsPositions.some((a) => a[0] == me.x - 1 && a[1] == me.y)) {
      legalActions.push("L");
    }
  }
  if (
    me.x < mapGame[0].length - 1 &&
    me.x + 1 < mapGame[0].length &&
    mapGame[me.y][me.x + 1] != BLOCK
  ) {
    if (!enemyAgentsPositions.some((a) => a[0] == me.x + 1 && a[1] == me.y)) {
      legalActions.push("R");
    }
  }

  // if antiLoop is true, remove the opposite action of the last action
  if (antiLoop && lastActions.length > 1) {
    const oppositeActions = {
      U: "D",
      D: "U",
      L: "R",
      R: "L",
    };
    const lastAction = lastActions[lastActions.length - 1];
    const oppositeAction = oppositeActions[lastAction];
    if (legalActions.includes(oppositeAction) && legalActions.length > 1) {
      legalActions.splice(legalActions.indexOf(oppositeAction), 1);
    }
  }

  return legalActions;
}

// goal = ["goalType", [x, y]]
function getPrompt(level, goal = [null, null]) {
  var prompt = "";
  if (conversationHistory.length == 0 || !USE_HISTORY) {
    var prompt = `You are a delivery agent in a web-based game and I want to test your ability. You are in a grid world (represented with a matrix) with some obstacles and some parcels to deliver. Parcels are generated at random on random free spots.
The value of the parcels lowers as the time passes, so you should deliver them as soon as possible.
Your view of the world is limited to a certain distance, so you can only see the parcels and the delivery points that are close to you.
LEGEND:
- A: you (the Agent) are in this position;
- 1: you can move in this position;
- 2: you can deliver a parcel in this position (and also move there);
- ${ENEMY}: an enemy agent is blocking this position, this means you cannot move in this position now, but very soon it will move and you will be able to move in this position;
- /: is blocked, you CAN NOT move towards this position;
- H: a parcel with High value is in this position;
- M: a parcel with Medium value is in this position;
- L: a parcel with Low value is in this position, so it could disappear soon and it may be a good idea to ignore it;
- X: you are in the same position of a parcel;
- Q: you are in the delivery/shipping point;

Important rules:
- If you have 0 parcels, you must look for the closest parcel to pick up.
- If you are going to deliver >0 parcels and on the way you find 1 parcel, you should go and pick it up before shipping.
- If you have at least 1 parcel, your goal should be to deliver it/them to the closest delivery point. The more parcels you have, the more important it is to deliver them as soon as possible.
- If you can't see any delivery point, just move around to explore the map until one enters your field of view, then go and deliver the parcels.
- If there is no parcel in the map, just move around to explore the map until one parcel spawns, then go and get it.

You want to maximize your score by delivering the most possible number of parcels. You can pickup multiple parcels and deliver them in the same delivery point.
Don't explain the reasoning and don't add any comment, just provide the action.
Try to not go back and forth, it's a waste of time, so use the conversation history to your advantage.
Example: if you want to go down, just answer 'D'.
`;
  } // end of if chatHistory.length == 0

  const currentEnvironment = buildMap();
  // check if the currentEnvironment is the same as the previous one
  if (currentEnvironment == previousEnvironment) {
    availableActions = availableActions.filter((a) => a != prevAction);
  } else {
    availableActions = getLegalActions(); //[...POSSIBLE_ACTIONS];
  }
  console.log("Possible actions: ", availableActions);
  previousEnvironment = currentEnvironment;
  prompt += `\nMAP:\n${currentEnvironment}\n\n`;
  prompt += `You have ${numParcels} parcels to deliver.`;
  if (HELP_FIND_DELIVERY && numParcels > 0) {
    const closestDeliveryPoint = getClosestDeliveryPoint();
    const deltaX = closestDeliveryPoint[0] - me.x;
    const deltaY = closestDeliveryPoint[1] - me.y;
    let direction = "";

    if (deltaX > 0) {
      direction += "right";
    } else if (deltaX < 0) {
      direction += "left";
    }

    if (deltaY > 0) {
      direction += direction ? " and down" : "down";
    } else if (deltaY < 0) {
      direction += direction ? " and up" : "up";
    }

    prompt += `The closest delivery point is ${direction} from you.`;
  }

  switch (level) {
    case "NO_PLAN":
      prompt += `ACTIONS you can do:\n${buildActionsText(availableActions)}\n`;
      if (HELP_SIMULATE_NEXT_ACTIONS) {
        const simulatedActions = simulateActions(
          currentEnvironment,
          availableActions
        );
        prompt += `\n\nSIMULATED ACTIONS:\n${Object.entries(simulatedActions)
          .map(
            ([action, map]) =>
              `If you do action ${action} you will end up in this situation:\n${map
                .map((row) => row.join(" "))
                .join("\n")}`
          )
          .join("\n\n")}`;
      }
      prompt += `\nWhat is your next action?`;
      return [prompt, null];

    case "ONLY_GOAL":
      var tmpX = me.x;
      var tmpY = me.y;
      console.log("me.x, me.y: ", me.x, me.y);
      if (REDUCED_MAP) {
        tmpX = Math.min(
          me.x,
          Math.max(AGENTS_OBSERVATION_DISTANCE, PARCELS_OBSERVATION_DISTANCE) -
            1
        );
        tmpY = Math.min(
          me.y,
          Math.max(AGENTS_OBSERVATION_DISTANCE, PARCELS_OBSERVATION_DISTANCE) -
            1
        );
      }
      console.log("tmpX, tmpY: ", tmpX, tmpY);
      const goals = new Map();
      prompt += `\nYou are in the spot (${tmpX}, ${tmpY}) as can be seen in map above. These are the available goal you can pursue:\n`;
      const letters = [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
      ];
      var i = 0;
      for (const parcel of parcels.values()) {
        if (!parcel.carriedBy) {
          goals.set(letters[i], parcel);
          prompt += `${letters[i]}) Parcel ${parcel.id} at (${parcel.x}, ${parcel.y}) with reward ${parcel.reward};\n`;
          i++;
        }
      }
      if (numParcels > 0) {
        goals.set(letters[i], "deliver");
        prompt += `${letters[i]}) You have ${numParcels} parcels to deliver.`;
      }
      prompt += `\nWhat is your next goal? Answer only with the letter of the goal you want to pursue. Example, you want to pursue goal A, you have to answer 'A'.`;
      return [prompt, goals];

    case "FULL_PLAN":
      var tmpX = me.x;
      var tmpY = me.y;
      console.log("me.x, me.y: ", me.x, me.y);
      if (REDUCED_MAP) {
        tmpX = Math.min(
          me.x,
          Math.max(AGENTS_OBSERVATION_DISTANCE, PARCELS_OBSERVATION_DISTANCE) -
            1
        );
        tmpY = Math.min(
          me.y,
          Math.max(AGENTS_OBSERVATION_DISTANCE, PARCELS_OBSERVATION_DISTANCE) -
            1
        );
      }
      console.log("tmpX, tmpY: ", tmpX, tmpY);
      prompt += `\nYou are in the spot (${tmpX}, ${tmpY}) as can be seen in map above.\n`;
      prompt += `Your goal is: ${goal[0]} at (${goal[1][0]}, ${goal[1][1]}).`;
      prompt += `\nAvailable actions:\n${buildActionsText(POSSIBLE_ACTIONS)}`;
      prompt += `\n\nReturn the list of actions you want to do to reach the goal. Return them as JavaScript array. They must be in the right order.
Example: if you want to go up, then right, then right again then ship the parcels, you should return ['U', 'R', 'R', 'S']`;
      return [prompt, null];
    default:
      // stop and give an error
      console.log("Error: ", level);
      process.exit(1);
  }
}

const POSSIBLE_LOGICS = ["raw", "random", "threshold"];
function uncertaintyLogic(response, logic) {}

var availableActions = [...POSSIBLE_ACTIONS];
var prevAction = null;
var previousEnvironment = null; // put this inside the loop to test without the filtering

// create a moving window of the last 10 actions
const lastActions = [];
const MAX_ACTIONS = 10;

async function agentLoop() {
  var num_actions = 0;
  // get current time
  const start = new Date().getTime();
  // stop after 5 minutes
  // while (new Date().getTime() - start < 5 * 60 * 1000) {
  while (new Date().getTime() - start < 1 * 60 * 1000) {
    if (me.score > 0) {
      console.log(
        "Time elapsed:",
        (new Date().getTime() - start) / 1000,
        "seconds"
      );
      break;
    }
    if (!buildMap()) {
      await client.timer(100);
      continue;
    }
    const prompt = getPrompt("ONLY_GOAL");
    console.log(prompt[0]);
    process.exit(0);
    //TODO: implement all the "ask for help" logic
    //await knowno_OpenAI(prompt, availableActions);
    // decidedAction depends on wether there are multiple actions available or not
    var decidedAction = null;
    if (SELECT_ONLY_ACTION && availableActions.length == 1) {
      decidedAction = availableActions[0];
      addHistory("user", prompt);
      addHistory("assistant", decidedAction);
    } else {
      var response = await knowno_OpenAI(prompt, availableActions);
      // filter out only the response[x][1] == true
      response = response.filter((r) => r[1] == true);
      console.log("Filtered response: ", response);
      decidedAction = response[0][0];
    }

    // const decidedAction =
    //   availableActions.length > 1 || !SELECT_ONLY_ACTION
    //     ? await getCompletion(prompt, createLogitsBiasDict(availableActions))
    //     : availableActions[0];
    // if (SELECT_ONLY_ACTION) {
    //   // fake the conversation history
    //   addHistory("user", prompt);
    //   addHistory("assistant", decidedAction);
    // }
    // console.log("currentEnvironment: \n", currentEnvironment);
    console.log("Decided action: ", decidedAction);
    switch (decidedAction) {
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
        console.log("Error in action:", decidedAction);
    }
    num_actions++;
    prevAction = decidedAction;
    lastActions.push(decidedAction);
    if (lastActions.length > MAX_ACTIONS) {
      lastActions
        .splice(0, lastActions.length - MAX_ACTIONS)
        .forEach((action) => availableActions.push(action));
    }
    results.set("score", me.score);
    results.set("actions", num_actions);
    results.set("tokens", total_tokens);
    results.set("elapsed_time_seconds", (new Date().getTime() - start) / 1000);
    fs.writeFileSync(
      "results.json",
      JSON.stringify(Object.fromEntries(results), null, 2)
    );

    await client.timer(ACTION_DELAY);
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
