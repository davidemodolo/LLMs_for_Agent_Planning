async function askLocalLLM(prompt) {
  // first open OLLAMA
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

function simulateActions(
  mapString,
  mapOriginal,
  testActions,
  meX,
  meY,
  parcels
) {
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
    nextMap[newY][newX] = mapOriginal[meY][meX];
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
    const originalX = meX + deltaX;
    const originalY = meY + deltaY;

    var parcelBelowSimulated = false;
    for (const parcel of parcels.values()) {
      if (parcel.x == originalX && parcel.y == originalY) {
        parcelBelowSimulated = true;
        break;
      }
    }

    nextMap[newY][newX] = parcelBelowSimulated
      ? "X"
      : mapOriginal[originalY][originalX] == "" + DELIVERY
      ? "Q"
      : "A";
    simulatedMaps[action] = nextMap;
  }
  return simulatedMaps;
}
