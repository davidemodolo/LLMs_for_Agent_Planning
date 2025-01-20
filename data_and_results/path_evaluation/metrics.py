import json
import networkx as nx

# with open('data_and_results/path_evaluation/path.json') as f:
#     path = json.load(f)

# print(path)

width, length = 7, 7

G = nx.grid_2d_graph(width, length)
# Relabel nodes to use integer coordinates
G = nx.convert_node_labels_to_integers(G, first_label=0, ordering="sorted")
# Print the edges to verify the graph
print(list(G.edges))

# visualize the graph
import matplotlib.pyplot as plt
nx.draw(G, with_labels=True)
plt.show()
