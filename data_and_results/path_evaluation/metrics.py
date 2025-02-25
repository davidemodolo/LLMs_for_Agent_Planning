import json
import networkx as nx
from collections import Counter
import matplotlib.pyplot as plt
import os
import matplotlib.patches as mpatches

width, length = 7, 7

G = nx.grid_2d_graph(width, length)
# Relabel nodes to use integer coordinates
G = nx.convert_node_labels_to_integers(G, first_label=0, ordering="sorted")

# Assign (x, y) coordinates as node attributes
for node in G.nodes():
    G.nodes[node]['pos'] = (node % width, node // width)

# Visualize the graph with node labels as (x, y) coordinates
pos = nx.get_node_attributes(G, 'pos')

# Find all the paths from 0,0 to 6,6 without cycles
def xy_to_node(x, y):
    x_flipped = (length - 1) - x  # Flip the y-axis
    return x_flipped * width + y
source_node = 0
target_node = 48
print(target_node)
print("start finding paths")
paths = list(nx.all_simple_paths(G, source=source_node, target=target_node, cutoff=12))
print("paths found")
# Find the paths with minimum length
min_length = min(len(path) for path in paths)
shortest_paths = [path for path in paths if len(path) == min_length]

with open("data_and_results/path_evaluation/path.json", "r") as f:
    agent_path = json.load(f)

agents_node_path = [xy_to_node(tile["x"], tile["y"]) for tile in agent_path]

H = G.copy()
for node in H.nodes():
    H.nodes[node]['color'] = 'white'

node_counts = Counter(agents_node_path)
for node, count in node_counts.items():
    if count > 1:
        H.nodes[node]['color'] = '#FF7AA0'
    else:
        H.nodes[node]['color'] = '#A0FFA0'

def node_to_xy(node):
    x = node // width
    y = node % width
    return x, y

agent_path_xy = [(tile["x"], tile["y"]) for tile in agent_path]

max_shared_nodes = 0
shared_paths = []
for path in paths:
    path_xy = [node_to_xy(node) for node in path]
    shared_nodes = len(set(path_xy) & set(agent_path_xy))
    if shared_nodes > max_shared_nodes:
        max_shared_nodes = shared_nodes
        shared_paths = [path]
    elif shared_nodes == max_shared_nodes:
        shared_paths.append(path)

best_path = shared_paths[0]
best_path_xy = [node_to_xy(node) for node in best_path]

shared_nodes = len(set(agent_path_xy) & set(best_path_xy))
total_nodes = len(agent_path_xy)
ratio = shared_nodes / total_nodes

best_path = [xy_to_node(tile[0], tile[1]) for tile in best_path_xy]

os.makedirs("data_and_results/path_evaluation", exist_ok=True)

fig, ax = plt.subplots(figsize=(width + 1, length + 1))

# Draw the graph with square nodes
colors = nx.get_node_attributes(H, 'color')
nx.draw(H, pos, ax=ax, node_shape='s', node_size=3500, node_color=[colors[node] for node in H.nodes()], 
        edgecolors='black', with_labels=True, labels={node: f"({abs(y - (width - 1))},{x})" for node, (x, y) in pos.items()})

# Highlight the best path with a different color
best_path_edges = list(zip(best_path[:-1], best_path[1:]))
nx.draw_networkx_edges(H, pos, edgelist=best_path_edges, edge_color='blue', width=2, ax=ax)

# Draw arrows for the agent path
arrows_x = []
arrows_y = []
arrows_dx = []
arrows_dy = []

X_OFFSET = 0.35
Y_OFFSET = 0.35
arrows = {}
for i in range(len(agent_path_xy) - 1):
    x1, y1 = agent_path_xy[i]
    x2, y2 = agent_path_xy[i + 1]
    tmp_x_offset = X_OFFSET
    tmp_y_offset = Y_OFFSET
    if (x1, y1, x2, y2) in arrows:
        print("Repeated")
        tmp_x_offset += (0.1 * arrows[(x1, y1, x2, y2)])
        arrows[(x1, y1, x2, y2)] += 1
    elif (x2, y2, x1, y1) in arrows:
        print("Repeated")
        tmp_x_offset += (0.1 * arrows[(x2, y2, x1, y1)])
        arrows[(x2, y2, x1, y1)] += 1
    else:
        arrows[(x1, y1, x2, y2)] = 1

    if x1 == x2 and y1 == y2:
        # Circle arrow for actions that go to the same cell
        circle = plt.Circle((y1, length - 1 - x1), 0.2+(.05 * arrows[(x1, y1, x2, y2)]) if (x1, y1, x2, y2) in arrows else 0.2, color='red', fill=False, zorder=6)
        ax.add_patch(circle)
    else:
        if y2 > y1:  # Moving right
            arrows_x.append(y1 + Y_OFFSET)  # x-coord with offset for better visibility
        else:  # Moving left
            arrows_x.append(y1 - Y_OFFSET)  # x-coord with offset for better visibility

        if x2 > x1:  # Moving down
            arrows_y.append((length - 1 - x1) - tmp_x_offset)  # y-coord with offset for better visibility
        else:  # Moving up
            arrows_y.append((length - 1 - x1) + tmp_x_offset)  # y-coord with offset for better visibility

        arrows_dx.append(y2 - y1)  # Direction x
        arrows_dy.append((length - 1 - x2) - (length - 1 - x1))  # Direction y

ax.quiver(arrows_x, arrows_y, arrows_dx, arrows_dy, angles='xy', scale_units='xy', scale=1.5, color='red', width=0.004, zorder=5)

# Add legend
green_node = mpatches.Patch(color='#A0FFA0', label='Agent Path')
pink_node = mpatches.Patch(color='#FF7AA0', label='Agent Path (Repeated)')
blue_line = mpatches.Patch(color='blue', label='Optimal Path')
red_arrow = mpatches.Patch(color='red', label='Agent Path Direction')
plt.legend(handles=[green_node, pink_node, blue_line, red_arrow], loc='upper center', bbox_to_anchor=(0.5, -0.05), ncol=4)

title = f"Ratio of shared nodes (path): {ratio*100:.2f}%, Ratio of shared nodes (set): {len(set(best_path_xy))/len(set(agent_path_xy))*100:.2f}%"
model = "gpt-4o-mini"
goal = "pickup"
title += f"\nModel: {model}, Goal: {goal}"
ax.set_title(title, fontsize=12)

fig.tight_layout()
fig.savefig(f"data_and_results/path_evaluation/{model}_{goal}_path.png")
plt.show()
plt.close()
