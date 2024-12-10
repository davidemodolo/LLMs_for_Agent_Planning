def find_paths(matrix, start, goal):
    def dfs(current, path):
        if current == goal:
            paths.append(path)
            return
        for direction in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            next_cell = (current[0] + direction[0], current[1] + direction[1])
            if next_cell in matrix and next_cell not in path:
                dfs(next_cell, path + [next_cell])

    paths = []
    dfs(start, [start])
    return paths

def compare_paths(optimal_paths, given_path):
    def count_common_arcs(path1, path2):
        return sum(1 for arc in zip(path1, path1[1:]) if arc in zip(path2, path2[1:]))

    max_common_arcs = 0
    best_path = None
    for optimal_path in optimal_paths:
        common_arcs = count_common_arcs(optimal_path, given_path)
        if common_arcs > max_common_arcs:
            max_common_arcs = common_arcs
            best_path = optimal_path

    accuracy = max_common_arcs / (len(given_path) - 1)
    return accuracy, best_path

# Example usage
matrix = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2)]
start = (0, 0)
goal = (2, 2)
optimal_paths = find_paths(matrix, start, goal)
print(f"Optimal Paths: {optimal_paths}")
given_path = [(0, 0), (1, 0), (2, 0), (2, 1), (2, 0), (2, 1), (2, 2)]
accuracy, best_path = compare_paths(optimal_paths, given_path)
print(f"Given Path: {given_path}")
print(f"Best Path: {best_path}")
print(f"Accuracy: {accuracy:.2f}")

import matplotlib.pyplot as plt

def plot_paths(matrix, best_path, given_path):
    matrix_set = set(matrix)
    fig, ax = plt.subplots()
    
    # Plot the matrix
    for cell in matrix:
        ax.plot(cell[1], cell[0], 's', color='lightgrey', markersize=20)
    
    # Plot the best optimal path
    if best_path:
        x, y = zip(*best_path)
        ax.plot(y, x, 'o-', label='Optimal Path', color='green')
    
    # Plot the given path
    x, y = zip(*given_path)
    ax.plot(y, x, 'o-', label='Given Path', color='red')
    
    # Highlight start and goal
    ax.plot(start[1], start[0], 'go', markersize=10, label='Start')
    ax.plot(goal[1], goal[0], 'ro', markersize=10, label='Goal')
    
    ax.set_xlim(-1, max(cell[1] for cell in matrix_set) + 1)
    ax.set_ylim(-1, max(cell[0] for cell in matrix_set) + 1)
    ax.invert_yaxis()
    ax.set_aspect('equal')
    ax.legend()
    plt.show()

plot_paths(matrix, best_path, given_path)