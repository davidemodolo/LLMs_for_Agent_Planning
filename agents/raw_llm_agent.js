import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import axios from "axios";
// import { planner, goalParser, mapParser, readDomain } from "./PDDL_planner.js";
// import { findDeliveryPoint } from "./astar_utils.js";

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
async function askLLM(prompt) {
  const url = "http://localhost:11434/api/generate";
  const data = {
    model: "llama3.2",
    prompt: prompt,
    stream: false,
    options: { num_predict: 100, seed: -1 },
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    // console.log("Response from LLM:", response.data);
    return response.data;
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
      ? "Q"
      : "A";
  return newMap.map((row) => row.join(" ")).join("\n");
}

async function agentLoop() {
  while (true) {
    var prompt = `
You are a delivery agent in a web-based game and I want to test your ability. You are in a grid world (represented with a matrix) with some obstacles and some parcels to deliver.
- you are in position (${me.x}, ${me.y}) (A in the matrix);
- parcels are in positions marked with P in the matrix; You can pickup parcels only if you are in the same cell of the parcel and in that case the letter displayed is X;
- you can move in any cell that is 2 or 1 in the matrix (1 is walkable, 2 is any place you can deliver);
- cells marked with 0 are obstacles, you CAN'T move there;
- if you are in a cell that is a delivery zone, the letter displayed is Q;
The list of actions you can perform are: up (U), down (D), left (L), right (R), pickup (P), shipped (S).
The matrix is the following:
${buildMap()}
You want to maximize your score.  You can ship parcels only if you are in the same cell of the delivery point.
Answer with only the letter of best action to perform between U, D, L, R, P, S. Put the letter between parentheses, like (U) for up.
Don't explain your reasoning.
Example: (D)
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
