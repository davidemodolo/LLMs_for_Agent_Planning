import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import axios from "axios";
import OpenAI from "openai";
import fs from "fs";
import tiktoken from "tiktoken";
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
const USE_HISTORY = true; // TODO: use the history of the conversation to improve the response

async function knowno_OpenAI(
  prompt,
  tokens_to_check,
  qhat = 0.928,
  temp = 3.0,
  model = MODEL
) {
  const LOGIT_BIAS = 20;
  const logits_bias_dict = createLogitsBiasDict(tokens_to_check);

  const completion = getCompletion(prompt, logits_bias_dict); // TODO: change so that it returns the raw completion

  const top_logprobs_full = completion.choices[0].logprobs.top_logprobs[0];
  const top_tokens = Object.keys(top_logprobs_full).slice(0, LOGIT_BIAS);
  const top_logprobs = Object.values(top_logprobs_full).slice(0, LOGIT_BIAS);

  const results_dict = {};
  top_tokens.forEach((token, i) => {
    const character = token.trim().toUpperCase();
    if (tokens_to_check.includes(character) && !results_dict[character]) {
      results_dict[character] = top_logprobs[i];
    }
  });

  tokens_to_check.forEach((token) => {
    if (!results_dict[token]) {
      results_dict[token] =
        top_logprobs[top_logprobs.length - 1] +
        top_logprobs[top_logprobs.length - 2];
    }
  });

  const top_logprobs_norm = Object.values(results_dict).map((logprob) =>
    Math.exp(logprob / 10)
  );
  const sum_exp = top_logprobs_norm.reduce((a, b) => a + b, 0);
  const normalized_probs = top_logprobs_norm.map((prob) => prob / sum_exp);

  const mc_smx_all = normalized_probs.map(
    (prob) =>
      Math.exp(prob / temp) /
      normalized_probs.reduce((a, b) => a + Math.exp(b / temp), 0)
  );

  const final = Object.keys(results_dict).map((element, i) => [
    element,
    mc_smx_all[i] >= 1 - qhat,
    mc_smx_all[i],
  ]);
  final.sort((a, b) => b[2] - a[2]);

  return final;
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

  elements.forEach((element) => {
    logitsBiasDict[encoding.encode(element)[0]] = 100;
  });
  console.log("Logits bias dictionary: ", logitsBiasDict);

  return logitsBiasDict;
}

const logits_bias_dict = createLogitsBiasDict(tokens_to_check);

async function getCompletion(
  prompt,
  logits_bias_dictionary = logits_bias_dict
) {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 1,
    logprobs: true,
    top_logprobs: 20,
    logit_bias: logits_bias_dictionary,
  });
  return completion.choices[0].message.content;
}

const client = new DeliverooApi(
  "http://localhost:8080/?name=god",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImM1NzY4ZGQwZGU2IiwibmFtZSI6ImdvZCIsImlhdCI6MTcyODY3MzMyOH0.XB9dASMeXdgTYemUXmjBc7uBUA6kj5RPkzyFUjz0h2s"
);

const DELIVERY = 2;
const BLOCK = 0;
const WALKABLE = 1;
var mapGame;
var heightMax;
var mapOriginal = null;
client.onMap((width, height, tiles) => {
  // create a matrix wxh
  heightMax = height;
  mapGame = new Array(width)
    .fill(BLOCK)
    .map(() => new Array(height).fill(BLOCK));
  for (var tile of tiles) {
    const adjustedY = height - 1 - tile.y;
    mapGame[adjustedY][tile.x] = tile.delivery ? DELIVERY : WALKABLE;
  }
  mapOriginal = mapGame.map((row) => row.slice());
});
setTimeout(() => {}, 2000);

const me = {};

client.onYou(({ id, name, x, y, score }) => {
  me.id = id;
  me.name = name;
  me.x = x;
  me.y = heightMax - 1 - y; // Adjust the y coordinate
  me.score = score;
});

var numParcels = 0;
var parcelBelow = false;

// add the parcel sensing method to remember the list of parcels
const parcels = new Map();
client.onParcelsSensing(async (perceived_parcels) => {
  numParcels = 0;
  parcelBelow = false;
  for (const p of perceived_parcels) {
    if (!p.carriedBy) {
      parcels.set(p.id, p);
    }
    if (p.carriedBy == me.id) {
      numParcels++;
    } else {
      if (p.x == me.x && heightMax - 1 - p.y == me.y) {
        parcelBelow = true;
      }
    }
  }
});

const enemyAgents = new Map();
client.onAgentsSensing(async (perceived_agents) => {
  // reset all the enemy agents coordinates as the original values
  for (const a of enemyAgents.values()) {
    mapGame[heightMax - 1 - a[1]][a[0]] =
      mapOriginal[heightMax - 1 - a[1]][a[0]];
  }
  for (const a of perceived_agents) {
    a.x = Math.round(a.x);
    a.y = Math.round(a.y);
    enemyAgents.set(a.id, [a.x, a.y]);
    // set a block in the position of the agent
    mapGame[heightMax - 1 - a.y][a.x] = BLOCK;
  }
});

// use llm to select next action
const conversationHistory = [];

function buildMap() {
  // check if the map is not defined
  if (!mapGame) {
    return null;
  }
  // create a copy of the map
  const newMap = mapGame.map((row) => row.slice());

  // cycle through the parcels and set their parcel.reward at parcel.x, parcel.y position. If a value is higher than 9, set it to 9
  for (const parcel of parcels.values()) {
    newMap[heightMax - 1 - parcel.y][parcel.x] = "P";
  }
  // put an A in the position of the agent, X if there already is a parcel
  newMap[me.y][me.x] =
    newMap[me.y][me.x] == "P"
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

  return newMap.map((row) => row.join(" ")).join("\n");
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
    .map((a) => `- ${a}: ${POSSIBLE_ACTIONS_DESCRIPTION[a]}`)
    .join("\n");
}

function getLegalActions(antiLoop = ANTI_LOOP, helpTheBot = HELP_THE_BOT) {
  // The agent can perform the following actions:
  // - if there is a parcel in the same position of the agent, add T
  // - if there is a delivery point in the same position of the agent and the agent has some parcels (numParcels > 0), add S
  // - if the agent can move up, add U
  // - if the agent can move down, add D
  // - if the agent can move left, add L
  // - if the agent can move right, add R
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
  if (me.y > 0 && mapGame[me.y - 1][me.x] != BLOCK) {
    legalActions.push("U");
  }
  if (me.y < heightMax - 1 && mapGame[me.y + 1][me.x] != BLOCK) {
    legalActions.push("D");
  }
  if (me.x > 0 && mapGame[me.y][me.x - 1] != BLOCK) {
    legalActions.push("L");
  }
  if (me.x < mapGame.length - 1 && mapGame[me.y][me.x + 1] != BLOCK) {
    legalActions.push("R");
  }

  // if antiLoop is true, remove the opposite action of the last action
  if (antiLoop && lastActions.length > 0) {
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

var availableActions = [...POSSIBLE_ACTIONS];
var prevAction = null;
var previousEnvironment = null; // put this inside the loop to test without the filtering

// create a moving window of the last 10 actions
const lastActions = [];
const MAX_ACTIONS = 10;

async function agentLoop() {
  while (true) {
    const currentEnvironment = buildMap();
    // if currentEnvironment is null, wait for the next map
    if (!currentEnvironment) {
      await client.timer(100);
      continue;
    }
    // check if the currentEnvironment is the same as the previous one
    if (currentEnvironment == previousEnvironment) {
      availableActions = availableActions.filter((a) => a != prevAction);
    } else {
      availableActions = getLegalActions(); //[...POSSIBLE_ACTIONS];
    }
    previousEnvironment = currentEnvironment;
    var prompt = `You are a delivery agent in a web-based game and I want to test your ability. You are in a grid world (represented with a matrix) with some obstacles and some parcels to deliver. Parcels are generated at random on random free spots.
MAP:
${currentEnvironment}
LEGEND:
- A: you (the Agent) are in this position;
- 1: you can move in this position;
- 2: you can deliver a parcel in this position (and also move there);
- /: is blocked, you CAN NOT move towards this position;
- P: a parcel is in this position;
- X: you are in the same position of a parcel;
- Q: you are in the delivery/shipping point;

ACTIONS:
${buildActionsText(availableActions)}

You have ${numParcels} parcels to deliver.
If you have zero parcels, you must look for the closest parcel to pick up.
If you are going to deliver a parcel, you should deliver it to the closest delivery point.
If you are going to deliver a parcel and on the way you find a parcel, you should go and pick it up before shipping.
If you have at least 1 parcel, you should deliver them to the closest delivery point. The more parcels you have, the more important it is to deliver them as soon as possible.
If there is no parcel in the map, just move around to explore the map until one parcel spawns, then go and get it.

You want to maximize your score by delivering the most possible number of parcels. You can pickup multiple parcels and deliver them in the same delivery point.
Don't explain the reasoning and don't add any comment, just provide the action.
Example: if you want to go down, just answer 'D'.
What is your next action?
`;
    console.log(prompt);
    // decidedAction depends on wether there are multiple actions available or not
    const decidedAction =
      availableActions.length > 1 || !SELECT_ONLY_ACTION
        ? await getCompletion(prompt, createLogitsBiasDict(availableActions))
        : availableActions[0];
    console.log("Possible actions: ", availableActions);
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
    prevAction = decidedAction;
    lastActions.push(decidedAction);
    if (lastActions.length > MAX_ACTIONS) {
      lastActions
        .splice(0, lastActions.length - MAX_ACTIONS)
        .forEach((action) => availableActions.push(action));
    }
    await client.timer(500);
  }
}

agentLoop();
