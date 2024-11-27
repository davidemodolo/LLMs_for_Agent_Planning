import os

from openai import AzureOpenAI
from retry import retry

llm_default_config = {
    "max_tokens": 4096,
    "temperature": 0.0,
    "top_p": 0.0,
    "frequency_penalty": 0.0,
    "presence_penalty": 0.0,
    "stop": None,
    "seed": 42,
}

engine = "gpt-4o"  # The name of the LLM model
with open("key_python.txt", "r") as file:
    API_KEY_NAME = file.read().strip()  # Read the API key from the file
with open("endpoint_python.txt", "r") as file:
    ENDPOINT = file.read().strip()  # Read the endpoint from the file
API_VERSION = "2024-08-01-preview"  # The API version

print("LLM_VERSION: ", engine)
print("API_KEY_NAME: ", API_KEY_NAME)
print("ENDPOINT: ", ENDPOINT)
print("API_VERSION: ", API_VERSION)


def query(prompt, end_when_error=False, max_retry=5) -> tuple:
    conn_success, llm_output = False, ""

    messages = [{"role": "user", "content": prompt}]

    n_retry = 0
    while not conn_success:
        n_retry += 1
        if n_retry >= max_retry:
            break
        try:
            print("[INFO] Connecting to the LLM ...")
            llm_output = __connect_openai(messages)
            conn_success = True
        except Exception as e:
            print(f"[ERROR] LLM error: {e}")
            if end_when_error:
                break

    return conn_success, llm_output


@retry(tries=2, delay=30)
def __connect_openai(messages):
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
        frequency_penalty=llm_default_config["frequency_penalty"],
        presence_penalty=llm_default_config["presence_penalty"],
        seed=llm_default_config["seed"],
        stop=llm_default_config["stop"],
    )

    return response.choices[0].message.content


if __name__ == "__main__":
    prompt = "What is the oldest capital of Italy?"
    succ, output = query(prompt)
    if succ:
        print(output)
    else:
        print("Failed to connect to the LLM.")
