from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import AzureOpenAI
from retry import retry

# Configuration
llm_default_config = {
    "max_tokens": 1,
    "temperature": 0.0,
    "top_p": 0.0,
    "frequency_penalty": 0.0,
    "presence_penalty": 0.0,
    "stop": None,
    "seed": 42,
}

engine = "gpt-4o"
with open("key_python.txt", "r") as file:
    API_KEY_NAME = file.read().strip()
with open("endpoint_python.txt", "r") as file:
    ENDPOINT = file.read().strip()
API_VERSION = "2024-08-01-preview"

# FastAPI app initialization
app = FastAPI()

# Input model for requests
class QueryRequest(BaseModel):
    prompt: str
    logprobs: bool
    top_logprobs: int
    logit_bias_dict: dict

# Utility function for querying LLM
def query(prompt, logprobs, top_logprobs, logit_bias_dict, end_when_error=False, max_retry=5) -> tuple:
    conn_success, llm_output = False, ""

    messages = [{"role": "user", "content": prompt}]
    n_retry = 0
    while not conn_success:
        n_retry += 1
        if n_retry >= max_retry:
            break
        try:
            print("[INFO] Connecting to the LLM ...")
            llm_output = __connect_openai(messages, logprobs, top_logprobs, logit_bias_dict)
            conn_success = True
        except Exception as e:
            print(f"[ERROR] LLM error: {e}")
            if end_when_error:
                break

    return conn_success, llm_output

@retry(tries=2, delay=30)
def __connect_openai(messages, logprobs, top_logprobs, logit_bias_dict):
    client = AzureOpenAI(
        api_key=API_KEY_NAME,
        azure_endpoint=ENDPOINT,
        api_version=API_VERSION,
    )

    response = client.chat.completions.create(
        model=engine,
        messages=messages,
        temperature=llm_default_config["temperature"],
        max_tokens=llm_default_config["max_tokens"],
        top_p=llm_default_config["top_p"],
        logprobs=logprobs,
        top_logprobs=top_logprobs,
        logit_bias=logit_bias_dict,
        frequency_penalty=llm_default_config["frequency_penalty"],
        presence_penalty=llm_default_config["presence_penalty"],
        seed=llm_default_config["seed"],
        stop=llm_default_config["stop"],
    )

    return build_log_probs(response.choices[0].logprobs.content[0].top_logprobs)

def build_log_probs(top_logprobs):
    log_probs = {}
    for logprob in top_logprobs:
        log_probs[logprob.token] = logprob.logprob
    return log_probs

# API endpoint
@app.post("/query")
async def query_llm(request: QueryRequest):
    try:
        succ, output = query(
            request.prompt,
            request.logprobs,
            request.top_logprobs,
            request.logit_bias_dict,
        )
        if succ:
            return {"success": True, "log_probs": output}
        else:
            raise HTTPException(status_code=500, detail="Failed to connect to the LLM.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
