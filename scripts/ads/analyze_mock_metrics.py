from matplotlib import pyplot as plt
from helpers import get_features_and_metrics_from_db
from models import JoinedFeatureMetric
import pandas as pd
import seaborn as sns


def open_and_save_csv():
    joined_features: list[JoinedFeatureMetric] = get_features_and_metrics_from_db()

    # Convert the list of JoinedFeatureMetric objects to a DataFrame
    df = pd.DataFrame([jf.__dict__ for jf in joined_features])

    # Save the DataFrame to a CSV file
    output_file = "joined_features_and_metrics.csv"
    df.to_csv(output_file, index=False)
    print(f"Data saved to {output_file}")


def box_plot_ctr_by_category():
    joined_features: list[JoinedFeatureMetric] = get_features_and_metrics_from_db()

    df = pd.DataFrame([jf.__dict__ for jf in joined_features])

    df["category_label_pair"] = df["category"] + " " + df["location"]
    df["category_only"] = df["category_label_pair"].str.split().str[0]

    # Set the minimum number of data points required for a category
    min_data_points = 2

    # Filter categories with sufficient data
    category_counts = df["category_label_pair"].value_counts()
    categories_with_sufficient_data = category_counts[
        category_counts >= min_data_points
    ].index

    # Filter the dataframe to include only categories with sufficient data
    df_filtered = df[df["category_label_pair"].isin(categories_with_sufficient_data)]

    # Calculate the median CTR for each category_label_pair
    median_ctr = df_filtered.groupby("category_label_pair")["ctr"].median()

    # Sort by category, then by median CTR within each category
    sorted_categories = (
        df_filtered.groupby("category_only")
        .apply(
            lambda x: x.sort_values(
                by="category_label_pair", key=lambda y: median_ctr[y], ascending=False
            )
        )
        .reset_index(drop=True)["category_label_pair"]
        .unique()
    )

    # Order the category_label_pair based on the new sorting
    df_filtered["category_label_pair"] = pd.Categorical(
        df_filtered["category_label_pair"], categories=sorted_categories, ordered=True
    )

    # Create a color palette for main categories
    unique_categories = df_filtered["category_only"].unique()
    color_palette = sns.color_palette("husl", n_colors=len(unique_categories))
    color_dict = dict(zip(unique_categories, color_palette))

    # Create a list of colors for each box
    box_colors = [
        color_dict[cat]
        for cat in df_filtered["category_label_pair"].cat.categories.str.split().str[0]
    ]

    plt.figure(figsize=(12, 14))  # Adjust figure size for better visibility
    ax = sns.boxplot(
        x="ctr",
        y="category_label_pair",
        data=df_filtered,
        showfliers=False,
        palette=box_colors,
    )
    plt.title(
        f"CTR by Category and Location (Outliers Removed, Min {min_data_points} data points)"
    )

    # Add a legend for main categories
    handles = [
        plt.Rectangle((0, 0), 1, 1, color=color_dict[cat]) for cat in unique_categories
    ]
    plt.legend(
        handles,
        unique_categories,
        title="Categories",
        bbox_to_anchor=(1.05, 1),
        loc="upper left",
    )

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    box_plot_ctr_by_category()
