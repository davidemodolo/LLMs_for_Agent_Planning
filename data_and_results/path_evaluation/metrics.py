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
nx.draw(G, pos, with_labels=True, labels={node: f"({abs(y - (width - 1))},{x})" for node, (x, y) in pos.items()})
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

# Draw the graph with the agent's path highlighted
colors = nx.get_node_attributes(H, 'color')
nx.draw(H, pos, node_color=[colors[node] for node in H.nodes()], with_labels=True, labels={node: f"({abs(y - (width - 1))},{x})" for node, (x, y) in pos.items()})
plt.show()