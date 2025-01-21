import json
import networkx as nx
from collections import Counter
import matplotlib.pyplot as plt

width, length = 7, 7

G = nx.grid_2d_graph(width, length)
# Relabel nodes to use integer coordinates
G = nx.convert_node_labels_to_integers(G, first_label=0, ordering="sorted")

# Assign (x, y) coordinates as node attributes
for node in G.nodes():
    G.nodes[node]['pos'] = (node % width, node // width)

# Print the nodes with their (x, y) values
for node in G.nodes(data=True):
    print(node)

# Visualize the graph with node labels as (x, y) coordinates
pos = nx.get_node_attributes(G, 'pos')
# nx.draw(G, pos, with_labels=True, labels={node: f"({abs(y - (width - 1))},{x})" for node, (x, y) in pos.items()})
# plt.show()

# find all the paths from 0,0 to 6,6 without cycles
source_node = 0
target_node = width * length - 1
paths = list(nx.all_simple_paths(G, source=source_node, target=target_node, cutoff=width + length - 2))

# print the paths with minimum length
min_length = min(len(path) for path in paths)
shortest_paths = [path for path in paths if len(path) == min_length]
print(f"Shortest path length: {min_length}")
print(f"Number of shortest paths: {len(shortest_paths)}")
for path in shortest_paths:
    print(path)


with open("data_and_results\path_evaluation\path.json", "r") as f:
    agent_path = json.load(f)

# function to convert x,y to node number, (0,0 ) will be 37, (6,6) will be 6
def xy_to_node(x, y):
    x_flipped = (length - 1) - x  # Flip the y-axis
    return x_flipped * width + y


# Convert the agent's path from (x, y) to node numbers
agents_node_path = [xy_to_node(tile["x"], tile["y"]) for tile in agent_path]
print(agents_node_path)
# Create a new graph with the agent's path highlighted
H = G.copy()
for node in H.nodes():
    H.nodes[node]['color'] = 'white'

node_counts = Counter(agents_node_path)
for node, count in node_counts.items():
    if count > 1:
        H.nodes[node]['color'] = '#FF7AA0' 
    else:
        H.nodes[node]['color'] = '#A0FFA0'

# Find the paths that share the most nodes with the agent's path
max_shared_nodes = 0
shared_paths = []

# convert a path to x,y coordinates
def node_to_xy(node):
    x = node // width
    y = node % width
    return x, y

agent_path_xy = [(tile["x"], tile["y"]) for tile in agent_path]
for path in paths:
    path_xy = [node_to_xy(node) for node in path]
    shared_nodes = len(set(path_xy) & set(agent_path_xy))
    if shared_nodes > max_shared_nodes:
        max_shared_nodes = shared_nodes
        shared_paths = [path]
        print("New path found")
        print(agent_path_xy)
        print(path_xy)
    elif shared_nodes == max_shared_nodes:
        shared_paths.append(path)

print(f"Maximum shared nodes: {max_shared_nodes}")
best_path = shared_paths[0]
best_path_xy = [node_to_xy(node) for node in best_path]
print("Path found:\t",best_path_xy)
print("Agent's path:\t",agent_path_xy)

# Calculate the ratio of shared nodes between the agent's path and the best path
shared_nodes = len(set(agent_path_xy) & set(best_path_xy))
total_nodes = len(agent_path_xy)
ratio = shared_nodes / total_nodes

print(f"Ratio of shared nodes between agent's path and best path: {ratio:.2f}")
print(f"Ratio of shared nodes between agent's set and best set: {len(set(agent_path_xy))/len(set(best_path_xy))}")

best_path = [xy_to_node(tile[0], tile[1]) for tile in best_path_xy]
# Draw the graph with the agent's path highlighted
import os
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

# Ensure the directory exists
os.makedirs("data_and_results/path_evaluation", exist_ok=True)

# Create a figure and axes explicitly
fig, ax = plt.subplots(figsize=(width+1, length+1))

# Draw the graph with the agent's path highlighted
colors = nx.get_node_attributes(H, 'color')
nx.draw(H, pos, ax=ax, node_color=[colors[node] for node in H.nodes()], with_labels=True,
    labels={node: f"({abs(y - (width - 1))},{x})" for node, (x, y) in pos.items()})

# Highlight the best path with a different color
best_path_edges = list(zip(best_path[:-1], best_path[1:]))
nx.draw_networkx_edges(H, pos, edgelist=best_path_edges, edge_color='blue', width=2, ax=ax)

# Add legend
blue_line = mpatches.Patch(color='blue', label='Optimal Path')
green_node = mpatches.Patch(color='#A0FFA0', label='Agent Path')
pink_node = mpatches.Patch(color='#FF7AA0', label='Agent Path (Repeated)')
plt.legend(handles=[blue_line, green_node, pink_node], loc='upper center', bbox_to_anchor=(0.5, -0.05), ncol=3)

title = f"Ratio of shared nodes (path): {ratio*100:.2f}%, Ratio of shared nodes (set): {len(set(agent_path_xy))/len(set(best_path_xy))*100:.2f}%"
model = "gpt-4o-mini"
goal = "deliver"
title += f"\nModel: {model}, Goal: {goal}"
ax.set_title(title, fontsize=12)

fig.tight_layout()

# Save and display the plot
fig.savefig(f"data_and_results/path_evaluation/{model}_{goal}_path.png")
# plt.show()
plt.close()