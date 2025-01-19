import json



with open('data_and_results/path_evaluation/path.json') as f:
    path = json.load(f)

print(path)

# TODO: Implement the function dfs(matrix, x, y, path, paths, visited) that will find all possible paths from the start to the end of the matrix (without going multiple times in the same cell).
def dfs(matrix, x, y, path, paths, visited):
    pass

w, l = 7, 7

# TODO: keep only the paths with the shortest length