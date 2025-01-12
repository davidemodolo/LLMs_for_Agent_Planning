import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import OpenAI from "openai";
import tiktoken from "tiktoken";

import fs from "fs";
const apiKey = fs.readFileSync("key.txt", "utf8").trim();

const openai = new OpenAI({
  apiKey: apiKey,
});

const MODEL = "gpt-4o-mini";
const USE_HISTORY = false;

var GOAL = "deliver";

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
const POSSIBLE_ACTIONS = ["U", "D", "L", "R", "T", "S"];
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
  const top_logprobs_full =
    completion.choices[0].logprobs.content[0].top_logprobs;
  const top_tokens = [];
  const top_logprobs = [];
  for (const element of top_logprobs_full) {
    top_tokens.push(element.token);
    top_logprobs.push(element.logprob);
  }

  // console.log("Top tokens: ", top_tokens);
  // console.log("Top logprobs: ", top_logprobs);

  const results_dict = {};
  // console.log("Tokens to check: ", tokens_to_check);
  top_tokens.forEach((token, i) => {
    const character = token.trim().toUpperCase();
    if (tokens_to_check.includes(character) && !results_dict[character]) {
      results_dict[character] = top_logprobs[i];
    }
  });
  // console.log("Results dict: ", results_dict);

  tokens_to_check.forEach((token) => {
    if (!results_dict[token]) {
      results_dict[token] =
        top_logprobs[top_logprobs.length - 1] +
        top_logprobs[top_logprobs.length - 2];
    }
  });
  // console.log("Results dict: ", results_dict);

  const temperature_softmax = 10; // Define the temperature
  const exp_logprobs = Object.values(results_dict).map((logprob) =>
    Math.exp(logprob / temperature_softmax)
  );
  const sum_exp_logprobs = exp_logprobs.reduce((sum, val) => sum + val, 0);
  const top_logprobs_norm = exp_logprobs.map((val) => val / sum_exp_logprobs);
  // console.log("Top logprobs norm: ", top_logprobs_norm);
  const mc_smx_all = temperatureScaling(top_logprobs_norm);
  // console.log("MC SMX all: ", mc_smx_all);

  const final = Object.keys(results_dict).map((element, i) => [
    element,
    mc_smx_all[i] >= 1 - (qhat || 0.928),
    mc_smx_all[i],
  ]);
  final.sort((a, b) => b[2] - a[2]);
  // console.log("Final: ", final);
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
    if (p.carriedBy == rawOnYou.id) {
      numParcels++;
    }
  }
});

//TODO: add base64 encoding
function generateText(filePath, variables) {
  try {
    let data = fs.readFileSync(filePath, "utf8");

    // Replace placeholders with actual values
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{${key}}`, "g"); // Create a regex for {key}
      data = data.replace(placeholder, value);
    }

    return data;
  } catch (err) {
    console.error("Error reading file:", err);
    return null;
  }
}

//node agents/heatmap.js
function getRawPrompt() {
  // TODO: prepare all the variables for all the blueprints
  const agentX = Math.abs(rawOnYou.y - (rawOnMap.height - 1));
  const agentY = rawOnYou.x;

  const parcels = [];
  for (let parcel of rawOnParcelsSensing) {
    const newParcel = { x: parcel.x, y: parcel.y };
    newParcel.x = Math.abs(parcel.y - (rawOnMap.height - 1));
    newParcel.y = parcel.x;
    parcels.push(newParcel);
  }

  var tiles = rawOnMap.tiles.map((tile) => ({
    x: Math.abs(tile.y - (rawOnMap.height - 1)),
    y: tile.x,
    delivery: tile.delivery,
  }));
  // the tile x = 4, y = 1 must be modified to have delivery = "blocked"
  tiles = tiles.filter((tile) => !(tile.x == 4 && tile.y == 1));
  // still going up

  tiles.sort((a, b) => {
    if (a.x == b.x) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });
  tiles = JSON.stringify(tiles);
  // from tiles replace },{ with a space
  tiles = tiles.replace(/},{/g, "\n- ");
  // from tiles remove the following character: ", {, }, [, ]"
  tiles = tiles.replace(/"|{|}|[|]/g, "");

  // TODO: choose the prompt blueprint
  //GOAL = "best_tile";
  const promptBlueprint = `prompts/${GOAL}.txt`;
  var variables = null;
  if (GOAL == "deliver") {
    // (width, height, tiles, agentX, agentY)
    variables = {
      width: rawOnMap.width,
      height: rawOnMap.height,
      tiles: tiles,
      agentX: agentX,
      agentY: agentY,
    };
  } else if (GOAL == "pickup") {
    //(width, height, tiles, parcelX, parcelY, agentX, agentY)
    variables = {
      width: rawOnMap.width,
      height: rawOnMap.height,
      tiles: tiles,
      parcelX: parcels[0].x,
      parcelY: parcels[0].y,
      agentX: agentX,
      agentY: agentY,
      parcels: JSON.stringify(parcels),
    };
  } else if (GOAL == "best_tile") {
    const possibleTiles = [];
    // add the left, right, up, down tiles wrt the agent position, if they exist
    if (agentY > 0) {
      possibleTiles.push({ val: "L) ", x: agentX, y: agentY - 1 });
    }
    if (agentY < rawOnMap.width - 1) {
      possibleTiles.push({ val: "R) ", x: agentX, y: agentY + 1 });
    }
    if (agentX > 0) {
      possibleTiles.push({ val: "U) ", x: agentX - 1, y: agentY });
    }
    if (agentX < rawOnMap.height - 1) {
      possibleTiles.push({ val: "D) ", x: agentX + 1, y: agentY });
    }
    const possibleTilesText = possibleTiles.map(
      (tile) => `${tile.val}(${tile.x}, ${tile.y})\n`
    );
    // console.log("Possible tiles: ", possibleTilesText);
    // (width, height, tiles, parcels, agentX, agentY, possibleTiles)
    variables = {
      width: rawOnMap.width,
      height: rawOnMap.height,
      tiles: tiles,
      numParcel: numParcels,
      parcels: JSON.stringify(parcels),
      agentX: agentX,
      agentY: agentY,
      possibleTiles: possibleTilesText,
    };
  } else {
    console.log("Error: the goal is not valid.");
  }

  const prompt = generateText(promptBlueprint, variables);
  console.log("Prompt: ", prompt);
  // if (PARCEL_CATEGORIZATION) {
  //   for (let parcel of rawOnParcelsSensing) {
  //     const parcelIdNumber = parseInt(parcel.id.substring(1));
  //     parcel.food = parcelIdNumber % 2 === 0 ? "banana" : "pineapple";
  //   }
  // }
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
const TIMER = 80;
const heatmapJson = [];
async function agentLoop() {
  while (!rawOnMap) {
    await client.timer(100);
  }
  // FOR TOMORROW FIX HERE
  for (let i = 0; i < rawOnMap.height; i++) {
    for (let j = 0; j < rawOnMap.width; j++) {
      var response = await knowno_OpenAI(getRawPrompt(), POSSIBLE_ACTIONS);
      if (
        !heatmapJson.some(
          (entry) =>
            entry.x === Math.abs(rawOnYou.y - (rawOnMap.height - 1)) &&
            entry.y === rawOnYou.x
        )
      ) {
        heatmapJson.push({
          x: Math.abs(rawOnYou.y - (rawOnMap.height - 1)),
          y: rawOnYou.x,
          values: response,
        });
      }
      console.log(
        `${Math.abs(rawOnYou.y - (rawOnMap.height - 1))}, ${
          rawOnYou.x
        } - response: ${response[0][0]}`
      );
      if (i % 2 == 0 && j < rawOnMap.width - 1) {
        console.log("Moving horizontally");
        await client.move("right");
      } else if (i % 2 == 1) {
        console.log("Moving horizontally");
        await client.move("left");
      }
      await client.timer(TIMER);
    }
    console.log("Moving vertically");
    await client.move("down");
    await client.timer(TIMER);
  }
  heatmapJson.push({
    goal: GOAL,
  });
  heatmapJson.push({
    model: MODEL,
  });

  heatmapJson.push({
    w: rawOnMap.width,
  });
  heatmapJson.push({
    h: rawOnMap.height,
  });
  if (GOAL == "pickup") {
    heatmapJson.push({
      goal: `(${Math.abs(rawOnParcelsSensing[0].y - (rawOnMap.height - 1))},${
        rawOnParcelsSensing[0].x
      })`,
    });
  } else if (GOAL == "deliver") {
    // find the delivery tile
    const deliveryTile = rawOnMap.tiles.find((tile) => tile.delivery == true);
    heatmapJson.push({
      goal: `(${Math.abs(deliveryTile.y - (rawOnMap.height - 1))},${
        deliveryTile.x
      })`,
    });
  }

  // save the heatmapJson to a file
  fs.writeFileSync("heatmap.json", JSON.stringify(heatmapJson));
  // end the program
  process.exit();
}

agentLoop();
