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
const MODEL = "gpt-4o-mini";
// async function askGPT(prompt) {
//   const completion = await openai.chat.completions.create({
//     model: MODEL,
//     messages: [
//       { role: "system", content: "You are a helpful assistant." },
//       {
//         role: "user",
//         content: prompt,
//       },
//     ],
//     max_tokens: 1,
//     logprobs: true,
//     top_logprobs: 256,
//   });
//   return completion;
// }
var prompt = `You are a delivery agent in a web-based game and I want to test your ability. You are in a grid world (represented with a matrix) with some obstacles and some parcels to deliver.
MAP:
0 2 0 1 2 1 1 1 1 2
0 1 1 P 0 1 P 0 0 0
0 A 0 0 0 1 1 0 0 0
1 1 1 1 1 1 1 1 1 1
0 1 0 0 0 1 1 0 1 0
1 1 1 1 1 1 1 0 1 1
0 1 0 0 0 1 1 0 0 2
P 1 P 1 1 1 P 1 1 1
0 1 0 0 0 1 1 0 0 0
0 2 0 0 0 2 1 0 0 0
LEGEND:
- A: you (the Agent) are in this position;
- 1: you can move in this position;
- 2: you can deliver a parcel in this position (and also move there);
- 0: is blocked, you cannot move in this position;
- P: a parcel is in this position;
- X: you are in the same position of a parcel;
- Q: you are in the delivery/shipping point;

ACTIONS:
- U: move up;
- D: move down;
- L: move left;
- R: move right;
- T: take a parcel (only if you are in the same cell of a parcel);
- S: ship a parcel (only if you are in a delivery zone).

You want to maximize your score by delivering the most possible number of parcels. You can pickup multiple parcels and deliver them in the same delivery point.
Don't explain the reasoning and don't add any comment, just provide the action.
Example: if you want to go down, just answer 'D'.
What is your next action?`;
const encoding = tiktoken.encoding_for_model("gpt-3.5-turbo-0125");
const tokens_to_check = ["U", "D", "L", "R", "T", "S"];
const logits_bias_dict = {};

tokens_to_check.forEach((element) => {
  logits_bias_dict[encoding.encode(element)[0]] = 100;
});

console.log(logits_bias_dict);
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    {
      role: "user",
      content: prompt, //"Write a haiku about recursion in programming.",
    },
  ],
  max_tokens: 1,
  logprobs: true,
  top_logprobs: 20,
  logit_bias: logits_bias_dict,
});

console.log("-- CONTENT --");
console.log(completion.choices[0].message.content);
console.log("-- LOGPROBS --");
console.log(completion.choices[0].logprobs);
console.log("-- LOGPROBS first --");
console.log(completion.choices[0].logprobs.content[0].top_logprobs);
console.log("-- RESPONSE --");
console.log(completion);
// save the entire completion on a file
fs.writeFileSync("completion.json", JSON.stringify(completion, null, 2));
process.exit(0);

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

// add the parcel sensing method to remember the list of parcels
const parcels = new Map();
client.onParcelsSensing(async (perceived_parcels) => {
  for (const p of perceived_parcels) {
    parcels.set(p.id, p);
  }
});

// use llm to select next action
const conversationHistory = [];

async function askLLM(prompt) {
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

function buildMap() {
  // check if the map is not defined
  if (!mapGame) {
    return "The map is still in the making, answer with (P) for now."; // E is the error
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
      ? "A" // "Q"
      : "A";

  return newMap.map((row) => row.join(" ")).join("\n");
}

async function agentLoop() {
  while (true) {
    var prompt = `
You are a delivery agent in a web-based game and I want to test your ability. You are in a grid world (represented with a matrix) with some obstacles and some parcels to deliver.
MAP:
${buildMap()}
LEGEND:
- A: you (the Agent) are in this position;
- 1: you can move in this position;
- 2: you can deliver a parcel in this position (and also move there);
- 0: is blocked, you cannot move in this position;
- P: a parcel is in this position;
- X: you are in the same position of a parcel;
- Q: you are in the delivery/shipping point;

ACTIONS:
- U: move up;
- D: move down;
- L: move left;
- R: move right;
- T: take a parcel (only if you are in the same cell of a parcel);
- S: ship a parcel (only if you are in a delivery zone).

You want to maximize your score by delivering the most possible number of parcels. You can pickup multiple parcels and deliver them in the same delivery point.
Don't explain the reasoning and don't add any comment, just provide the action between parentheses.
Example: if you want to go down, just answer '(D)'.
What is your next action?
`;
    console.log(prompt);

    //using regex to get the action from the response
    const action = await askLLM(prompt);
    console.log("Action from LLM:", action["response"]);
    const match = action["response"].match(/\((.)\)/);
    const decidedAction = match ? match[1] : "P";
    console.log("Decided action:", decidedAction);
    // map the action to the deliveroo api
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
      case "P":
        await client.pickup();
        break;
      case "S":
        await client.putdown();
        break;
      default:
        console.log("Error in action:");
    }
    await client.timer(500);
  }
  // var previous = "right";

  // while (true) {
  //   await client.putdown();

  //   await client.pickup();

  //   let tried = [];

  //   while (tried.length < 4) {
  //     let current = { up: "down", right: "left", down: "up", left: "right" }[
  //       previous
  //     ]; // backward

  //     if (tried.length < 3) {
  //       // try haed or turn (before going backward)
  //       current = ["up", "right", "down", "left"].filter((d) => d != current)[
  //         Math.floor(Math.random() * 3)
  //       ];
  //     }

  //     if (!tried.includes(current)) {
  //       if (await client.move(current)) {
  //         console.log("moved", current);
  //         previous = current;
  //         break; // moved, continue
  //       }

  //       tried.push(current);
  //     }
  //   }

  //   if (tried.length == 4) {
  //     console.log("stucked");
  //     await client.timer(1000); // stucked, wait 1 sec and retry
  //   }
  // }
}

agentLoop();
