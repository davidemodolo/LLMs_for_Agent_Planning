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
  const encoding = tiktoken.encoding_for_model("gpt-3.5-turbo-0125");
  const logitsBiasDict = {};

  elements.forEach((element) => {
    logitsBiasDict[encoding.encode(element)[0]] = 100;
  });

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
    parcels.set(p.id, p);
    if (p.carriedBy == me.id) {
      numParcels++;
    } else {
      if (p.x == me.x && heightMax - 1 - p.y == me.y) {
        parcelBelow = true;
      }
    }
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
  T: "take a parcel (only if there is an X in the map)",
  S: "ship a parcel (only if there is a Q in the map)",
};
function buildActionsText(allowedActions) {
  return POSSIBLE_ACTIONS.filter((a) => allowedActions.includes(a))
    .map((a) => `- ${a}: ${POSSIBLE_ACTIONS_DESCRIPTION[a]}`)
    .join("\n");
}

function getLegalActions(antiLoop = false) {
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
  }
  if (parcelBelow) {
    legalActions.push("T");
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
var previousEnvironment = null;

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
      availableActions = getLegalActions(true); //[...POSSIBLE_ACTIONS];
    }
    previousEnvironment = currentEnvironment;
    var prompt = `You are a delivery agent in a web-based game and I want to test your ability. You are in a grid world (represented with a matrix) with some obstacles and some parcels to deliver.
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

You have ${numParcels} parcels to deliver. If you have at least 1 parcel, you should deliver it to the closest delivery point (2).

You want to maximize your score by delivering the most possible number of parcels. You can pickup multiple parcels and deliver them in the same delivery point.
Don't explain the reasoning and don't add any comment, just provide the action.
Example: if you want to go down, just answer 'D'.
What is your next action?
`;
    console.log(prompt);

    const decidedAction = await getCompletion(
      prompt,
      createLogitsBiasDict(availableActions)
    );
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
