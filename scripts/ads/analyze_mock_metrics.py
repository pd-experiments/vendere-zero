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

    # Calculate the median CTR for each category_label_pair
    median_ctr = (
        df.groupby("category_label_pair")["ctr"].median().sort_values(ascending=False)
    )

    # Order the category_label_pair based on median CTR
    df["category_label_pair"] = pd.Categorical(
        df["category_label_pair"], categories=median_ctr.index, ordered=True
    )

    plt.figure(figsize=(12, 6))
    sns.boxplot(x="category_label_pair", y="ctr", data=df, showfliers=False)
    plt.xticks(rotation=90, ha="right")
    plt.title("CTR by Category and Location (Outliers Removed)")
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    box_plot_ctr_by_category()
