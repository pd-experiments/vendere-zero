from helpers import get_features_and_metrics_from_db
from models import JoinedFeatureMetric
import pandas as pd


if __name__ == "__main__":
    joined_features: list[JoinedFeatureMetric] = get_features_and_metrics_from_db()

    # Convert the list of JoinedFeatureMetric objects to a DataFrame
    df = pd.DataFrame([jf.__dict__ for jf in joined_features])

    # Save the DataFrame to a CSV file
    output_file = "joined_features_and_metrics.csv"
    df.to_csv(output_file, index=False)
    print(f"Data saved to {output_file}")
