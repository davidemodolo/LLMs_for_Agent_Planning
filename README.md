# MASTER THESIS PROJECT - Exploring the Use of LLMs for Agent Planning: Strengths and Weaknesses

Project for the Master Thesis in Artificial Intelligence Systems at the University of Trento, Italy.

# Abstract

With the recent advancements in Large Language Models, there has been a growing interest in developing agents capable of understanding and executing complex tasks. In this work, we explore the use of LLMs as agents that can navigate and complete logistics tasks, primarily focused on picking up and delivering parcels, within a web-based environment.

Our approach aims to evaluate the raw performance of an LLM without integrating additional frameworks or specialized optimization techniques, allowing us to assess its inherent generative capabilities in problem-solving. We analyze how effectively the agent can navigate different map layouts and complete assigned objectives, testing its adaptability across various goal configurations. A key aspect of our evaluation is the use of LLM uncertainty measures, derived from tokens' log probabilities, to gain deeper insights into the model's confidence in its decision-making process. These measures help us understand when the agent is uncertain and how that uncertainty correlates with performance in different parts of the scenario.

We demonstrate that the agent's performance improves when using newer LLM versions, reflecting the continuous advancements in these models. However, we also observe a decline in performance as the map size increases, suggesting that larger environments pose challenges that the model struggles to overcome. To structure our approach effectively, we design the prompt based on established literature, ensuring alignment with best practices in prompt engineering.

Furthermore, we experiment with two distinct agent configurations: a stateless agent, which makes decisions solely based on the current state of the environment, and a stateful agent, which retains memory of past interactions. By comparing
these approaches, we highlight the strengths and limitations of each. The stateless agent benefits from simplicity and avoids memory-related constraints, but it may struggle in scenarios where the environment description requires too much
attention. Conversely, the stateful agent provides improved continuity in decision-making but faces challenges related to context length limitations and potential inconsistencies in stored information.

# Resources

> **Robots That Ask For Help: Uncertainty Alignment for Large Language Model Planners**  
> Allen Z. Ren, Anushri Dixit, Alexandra Bodrova, Sumeet Singh, Stephen Tu, Noah Brown, Peng Xu,  
> Leila Takayama, Fei Xia, Jake Varley, Zhenjia Xu, Dorsa Sadigh, Andy Zeng, Anirudha Majumdar  
> _2023_.  
> [arXiv:2307.01928](https://arxiv.org/abs/2307.01928)

> [Deliveroo Default Agents](https://github.com/unitn-ASA/DeliverooAgent.js)

> [Deliveroo Server](https://github.com/unitn-ASA/Deliveroo.js)
