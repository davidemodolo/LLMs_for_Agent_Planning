async function queryLLM(prompt, logprobs, top_logprobs, logit_bias_dict) {
  const apiUrl = "http://localhost:8000/query"; // Update with the actual server URL

  const requestBody = {
    prompt: prompt,
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
    for (const element in result.log_probs) {
      console.log("Element:", element, "Log Prob:", result.log_probs[element]);
    }
    return result;
  } catch (error) {
    console.error("Error querying LLM:", error);
  }
}

// Example usage:
const prompt = "What is the oldest capital of Italy?";
const logprobs = true;
const top_logprobs = 20;
const logit_bias_dict = {
  35: 100,
  43: 100,
  49: 100,
  50: 100,
  51: 100,
  52: 100,
};

queryLLM(prompt, logprobs, top_logprobs, logit_bias_dict);
