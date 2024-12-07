import matplotlib.pyplot as plt
import matplotlib.patches as patches
import math

def create_square_pie(ax, data, color):
    """
    Create a square pie chart within the provided Axes object.

    Parameters:
    ax: Matplotlib Axes object
    data: Dictionary of labels and values for the pie chart
    color: Base color for the pie chart
    """
    total = sum(data.values())
    current_pos = 0

    for label, value in data.items():
        sector_size = value / total
        rect = patches.Rectangle((0, current_pos), 1, sector_size, linewidth=1, facecolor=color, alpha=value / total)
        ax.add_patch(rect)

        # Add label in the middle of the sector
        ax.text(0.5, current_pos + sector_size / 2, label, ha='center', va='center', fontsize=8, color='black')

        current_pos += sector_size

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

def create_table_of_square_pies(data_list, width, length, color):
    """
    Create a table of square pie charts.

    Parameters:
    data_list: List of dictionaries, each representing data for a pie chart
    width: Number of columns in the table
    length: Number of rows in the table
    color: Base color for the pie charts
    """
    if len(data_list) > width * length:
        raise ValueError("The number of data dictionaries exceeds the available table cells.")

    fig, axes = plt.subplots(length, width, figsize=(width * 2, length * 2))
    
    # Flatten axes array if more than one row and column exist
    if length > 1 and width > 1:
        axes = axes.flatten()
    elif length == 1 or width == 1:
        axes = [axes]  # Ensure it's always iterable

    # Fill the table cells with square pie charts
    for i, data in enumerate(data_list):
        create_square_pie(axes[i], data, color)

    # Turn off unused axes
    for j in range(len(data_list), width * length):
        axes[j].axis('off')

    plt.tight_layout()
    plt.show()

# Example usage
data_list = [
    {'A': 20, 'B': 30, 'C': 50},
    {'X': 20, 'Y': 80},
    {'P': 50, 'Q': 50},
    {'K': 25, 'L': 25, 'M': 50},
    {'D': 40, 'E': 30, 'F': 30},
    {'GOAL': 100},
    {'P': 50, 'Q': 50},
    {'K': 25, 'L': 25, 'M': 50},
    {'D': 40, 'E': 30, 'F': 30}
]
width = 3
length = 3
color = 'green'
create_table_of_square_pies(data_list, width, length, color)