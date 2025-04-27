import os

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import load_model


def predict_future(model, scaler, last_sequence, steps_ahead):
    predictions = []
    current_sequence = last_sequence.copy()

    for _ in range(steps_ahead):
        input_data = current_sequence.reshape(1, len(last_sequence), 1)

        pred_scaled = model.predict(input_data, verbose=0)[0, 0]
        predictions.append(pred_scaled)

        current_sequence = np.roll(current_sequence, -1)
        current_sequence[-1] = pred_scaled

    return scaler.inverse_transform(np.array(predictions).reshape(-1, 1)).flatten()


results = []

model_dir = "lstmodels/"
for filename in os.listdir(model_dir):
    if filename.endswith(".keras"):
        state = filename.replace("best_model_", "").replace(".keras", "").strip("'")

        try:
            model = load_model(os.path.join(model_dir, filename))

            history = model.history.history

            last_epoch = {
                "State": state,
                "loss": history["loss"][-1],
                "mae": history["mae"][-1],
                "val_loss": history["val_loss"][-1],
                "val_mae": history["val_mae"][-1],
            }

            scaler = state_data[state]["scaler"]
            last_sequence = state_data[state]["X"][-1]
            future_preds = predict_future(model, scaler, last_sequence, steps_ahead=4)

            # Add predictions to results
            for i, pred in enumerate(future_preds, 1):
                last_epoch[f"week{i}"] = pred

            results.append(last_epoch)

        except Exception as e:
            print(f"Error processing {state}: {str(e)}")
            continue

results_df = pd.DataFrame(results)
results_df.to_csv("lstm_model_metrics.csv", index=False)
print("CSV saved successfully!")
