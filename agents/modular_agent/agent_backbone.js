import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import OpenAI from "openai";
import tiktoken from "tiktoken";

import fs from "fs";
const apiKey = fs.readFileSync("key.txt", "utf8").trim();

const openai = new OpenAI({
  apiKey: apiKey,
});

const MODEL = "gpt-4o-mini";
const USE_HISTORY = true;
const POSSIBLE_LOGICS = ["raw", "random", "threshold"];
const LOGIC = POSSIBLE_LOGICS[1];

var GOAL = "pickup";
var OLD_GOAL = "pickup";

const conversationHistory = [];
function addHistory(roleAdd, contentAdd) {
  conversationHistory.push({ role: roleAdd, content: contentAdd });
}

function createLogitsBiasDict(elements) {
  if (elements.length == 0) {
    return {};
  }
  const encoding = tiktoken.encoding_for_model(MODEL);
  const logitsBiasDict = {};

  elements.forEach((element) => {
    logitsBiasDict[encoding.encode(element)[0]] = 100;
  });
  console.log("Logits bias dictionary: ", logitsBiasDict);

  return logitsBiasDict;
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

var total_tokens = 0;
async function knowno_OpenAI(
  prompt,
  tokens_to_check,
  max_tokens = 1,
  qhat = 0.928
) {
  const LOGIT_BIAS = 20;
  addHistory("user", prompt);
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: USE_HISTORY
      ? conversationHistory
      : [
          {
            role: "user",
            content: prompt,
          },
        ],
    max_tokens: max_tokens,
    logprobs: true,
    top_logprobs: LOGIT_BIAS,
    logit_bias: createLogitsBiasDict(tokens_to_check),
  });
  total_tokens += completion.usage.total_tokens;
  fs.writeFileSync("completion.json", JSON.stringify(completion, null, 2));

  const top_logprobs_full =
    completion.choices[0].logprobs.content[0].top_logprobs;
  const top_tokens = [];
  const top_logprobs = [];
  for (const element of top_logprobs_full) {
    top_tokens.push(element.token);
    top_logprobs.push(element.logprob);
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

const AgentLink = "http://localhost:8080/?name=raw_llm_agent";
const AgentKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc1ZDRlNzhlZDhlIiwibmFtZSI6InJhd19sbG1fYWdlbnQiLCJpYXQiOjE3MzAzODc4Njd9.4EQlPWKgOFGBUn0MpXOZQI2CkPHBjggnDKu76kpPrkI";
const client = new DeliverooApi(AgentLink, AgentKey);

var rawOnMap = null;
client.onMap((width, height, tiles) => {
  rawOnMap = { width, height, tiles };
});
setTimeout(() => {}, 2000);

var rawOnYou = null;
client.onYou(({ id, name, x, y, score }) => {
  rawOnYou = { id, name, x, y, score };
});

var numParcels = 0;
var rawOnParcelsSensing = null;
client.onParcelsSensing(async (perceived_parcels) => {
  rawOnParcelsSensing = perceived_parcels;
  numParcels = 0;
  for (const p of perceived_parcels) {
    if (p.carriedBy == me.id) {
      numParcels++;
    }
  }
});

function getRawPrompt() {
  GOAL = numParcels > 0 ? "deliver" : "pickup";
  const CUSTOM_ORIENTATION = true;
  const PARCEL_CATEGORIZATION = false;
  var prompt = "";
  // repeat the prompt every 5 steps
  if (
    conversationHistory.length == 0 ||
    !USE_HISTORY ||
    GOAL != OLD_GOAL ||
    conversationHistory.length % 16 == 0
  ) {
    prompt = `You are a delivery agent in a web-based delivery game where the map is a matrix.\nI am going to give you the raw information I receive from the server and the possible actions.`;
    if (GOAL == "deliver") {
      prompt += `\nYour current goal is to go to a tile with delivery == true.`;
    }
    OLD_GOAL = GOAL;
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
    // save the tiles to map.txt as a list of (x, y) coordinates
    fs.writeFileSync(
      "map.txt",
      noParcelSpawnerTiles.map((tile) => `(${tile.x}, ${tile.y})`).join(", ")
    );

    // raw onMap
    prompt += `\nMap width: ${rawOnMap.width}\nMap height: ${
      rawOnMap.height
    }\nTiles are arranged as ${rawOnMap.height} rows in ${
      rawOnMap.width
    } columns:${JSON.stringify(noParcelSpawnerTiles, null, 3)}\n`;
  }

  var agentX = rawOnYou.x;
  var agentY = rawOnYou.y;
  if (CUSTOM_ORIENTATION) {
    console.log("Before: ", rawOnYou);
    const tmp = agentX;
    agentX = Math.abs(agentY - (heightMax - 1));
    agentY = tmp;
    console.log("After: ", rawOnYou);
  }

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

  if (PARCEL_CATEGORIZATION) {
    for (let parcel of rawOnParcelsSensing) {
      const parcelIdNumber = parseInt(parcel.id.substring(1));
      parcel.food = parcelIdNumber % 2 === 0 ? "banana" : "pineapple";
    }
  }
  // raw onParcelsSensing
  if (GOAL == "pickup") {
    prompt += `\nThe parcel you need to take is in the spot (${parcels[0].x}, ${parcels[0].y}).\n`;
  }

  // open the file path.txt (create it if it doesn't exist) and append (agentX, agentY) to it
  fs.appendFileSync("path.txt", `(${agentX}, ${agentY}), `);
  prompt += `\nYou are in the spot (${agentX}, ${agentY}).\n`;
  prompt += `\nACTIONS you can do:\n${buildActionsText(POSSIBLE_ACTIONS)}\n\n`;
  if (GOAL == "pickup") {
    prompt += `Your final goal is to go to a tile with the parcel and (T)ake it, `;
  } else if (GOAL == "deliver") {
    prompt += `You have a parcel to ship, your final goal is to go to the delivery zone (delivery = true) and (S)hip the parcel, `;
  }
  prompt += `I need the best action that will get you there, if you are in the goal tile, Take or Ship based on the current goal. Don't explain the reasoning and don't add any comment, just provide the action. What is your next action?`;
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
  var num_actions = 0;
  // get current time
  const start = new Date().getTime();
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
    if (!rawOnMap) {
      await client.timer(100);
      continue;
    }
    var response = await knowno_OpenAI(getRawPrompt(), POSSIBLE_ACTIONS);
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

    num_actions++;
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
