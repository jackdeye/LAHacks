import os

os.environ["CUDA_VISIBLE_DEVICES"] = "-1"  # Force CPU mode if GPU issues persist
import sqlite3

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from tensorflow.keras.layers import (
    Dense,  # Changed LSTM to SimpleRNN
    Dropout,
    Input,
    SimpleRNN,
)
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.saving import (
    save_model,
)  # Note: save_model might not be needed if using ModelCheckpoint with .keras

conn = sqlite3.connect("db/db.sqlite")
query = "SELECT State, Ending_Date, State_WVAL FROM state_timeseries ORDER BY State, Ending_Date"
df = pd.read_sql(query, conn)
conn.close()

df["Ending_Date"] = pd.to_datetime(df["Ending_Date"])
df = df.sort_values(["State", "Ending_Date"])

print("Missing values per column:")
print(df.isnull().sum())


def create_sequences(data, sequence_length):
    X, y = [], []
    if len(data) <= sequence_length:
        return np.array(X), np.array(y)  # Return empty arrays if not enough data
    for i in range(len(data) - sequence_length):
        X.append(data[i : i + sequence_length])
        y.append(data[i + sequence_length])
    return np.array(X), np.array(y)


sequence_length = 4
n_features = 1
states = df["State"].unique()
state_data = {}
processed_states = []  # Keep track of states with enough data

print(f"\nProcessing data for {len(states)} states...")
for state in states:
    state_df = df[
        df["State"] == state
    ].copy()  # Use .copy() to avoid SettingWithCopyWarning
    values = state_df["State_WVAL"].values.reshape(-1, 1)
    if len(values) <= sequence_length:
        print(
            f"Skipping state {state}: Not enough data points ({len(values)}) for sequence length {sequence_length}"
        )
        continue

    scaler = MinMaxScaler()
    try:
        scaled_values = scaler.fit_transform(values)
    except ValueError as e:
        print(f"Skipping state {state}: Scaling error - {e}")
        continue

    X, y = create_sequences(scaled_values, sequence_length)

    # Ensure sequences were actually created
    if X.shape[0] == 0:
        print(f"Skipping state {state}: No sequences created after processing.")
        continue

    state_data[state] = {"X": X, "y": y, "scaler": scaler}
    processed_states.append(
        state
    )  # Add state to the list of successfully processed states

print(f"\nSuccessfully processed data for {len(processed_states)} states.")


def build_simple_rnn_model(sequence_length, n_features):  # Renamed function for clarity
    model = Sequential(
        [
            Input(shape=(sequence_length, n_features)),
            SimpleRNN(
                64, return_sequences=True
            ),  # Keep return_sequences=True for stacking RNNs
            Dropout(0.2),
            SimpleRNN(32),  # Default return_sequences=False is correct here
            Dense(1),
        ]
    )
    model.compile(optimizer=Adam(learning_rate=0.0005), loss="mse", metrics=["mae"])
    return model


epochs = 10
batch_size = 32
trained_models = {}
histories = {}  # Store history separately

if not processed_states:
    print("\nNo states have sufficient data for training. Exiting.")
else:
    print(f"\nStarting training for {len(processed_states)} states...")
    for state in processed_states:
        print(f"\nTraining model for {state}")
        X = state_data[state]["X"]
        y = state_data[state]["y"]

        if len(X) < 2:  # Need at least one sample for train and one for test
            print(
                f"Skipping training for {state}: Not enough sequences ({len(X)}) for train/test split."
            )
            continue

        # Adjust test_size if dataset is very small to ensure training set isn't empty
        test_size = (
            0.2 if len(X) >= 5 else 1 / len(X)
        )  # Ensure at least one test sample

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=test_size,
            shuffle=False,  # Keep shuffle=False for time series
        )

        if X_train.shape[0] == 0 or X_test.shape[0] == 0:
            print(
                f"Skipping training for {state}: Not enough data for non-empty train/test sets after split."
            )
            continue

        model = build_simple_rnn_model(sequence_length, n_features)

        if not os.path.exists("models"):
            os.makedirs("models")

        callbacks = [
            EarlyStopping(
                monitor="val_loss", patience=10, restore_best_weights=True
            ),  # Monitor val_loss
            ModelCheckpoint(
                f"models/best_model_{state}.keras",
                save_best_only=True,
                monitor="val_loss",  # Monitor val_loss
            ),
        ]
        history = model.fit(
            X_train,
            y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=(X_test, y_test),
            callbacks=callbacks,
            verbose=1,  # Set to 1 or 2 for progress, 0 for silent
        )

        trained_models[state] = model  # Store the trained model directly
        histories[state] = history  # Store history

        print(f"\nEvaluating model for {state} on test data...")
        y_pred_scaled = model.predict(X_test)
        scaler = state_data[state]["scaler"]
        try:
            y_pred_actual = scaler.inverse_transform(y_pred_scaled)
            y_test_actual = scaler.inverse_transform(y_test.reshape(-1, 1))
            mae_original = mean_absolute_error(y_test_actual, y_pred_actual)
            print(f"Test MAE for {state} (original scale): {mae_original:.4f}")
        except ValueError as e:
            print(f"Could not evaluate {state} in original scale: {e}")


def predict_future(
    model, scaler, last_sequence, steps_ahead, sequence_length, n_features
):
    predictions_scaled = []
    current_sequence = last_sequence.copy().reshape(
        1, sequence_length, n_features
    )  # Reshape for prediction

    for _ in range(steps_ahead):
        pred_scaled = model.predict(current_sequence)[0, 0]
        predictions_scaled.append(pred_scaled)

        next_step_scaled = np.array([[pred_scaled]])  # Shape (1, 1)
        new_sequence_step = next_step_scaled.reshape(
            1, 1, n_features
        )  # Shape (1, 1, n_features)

        current_sequence = np.roll(
            current_sequence, -1, axis=1
        )  # Roll along the time axis
        current_sequence[0, -1, :] = new_sequence_step  # Update the last time step

    try:
        future_predictions = scaler.inverse_transform(
            np.array(predictions_scaled).reshape(-1, 1)
        ).flatten()
        return future_predictions
    except ValueError as e:
        print(f"Error during inverse transform for future predictions: {e}")
        return np.array([])  # Return empty array on error


if trained_models:  # Check if any models were trained
    last_trained_state = processed_states[-1] if processed_states else None

    if last_trained_state and last_trained_state in trained_models:
        print(f"\n--- Example Prediction for {last_trained_state} ---")
        model = trained_models[last_trained_state]
        scaler = state_data[last_trained_state]["scaler"]
        X = state_data[last_trained_state]["X"]

        if len(X) > 0:  # Check if there is data to predict from
            last_sequence = X[-1]  # Shape (sequence_length, n_features)
            future_predictions = predict_future(
                model,
                scaler,
                last_sequence,
                steps_ahead=4,
                sequence_length=sequence_length,
                n_features=n_features,
            )
            if future_predictions.size > 0:
                print(
                    f"Predicted 'State_WVAL' for {last_trained_state} for next 4 steps: {future_predictions}"
                )
            else:
                print(
                    f"Could not generate future predictions for {last_trained_state}."
                )

            # Plot training history for the last trained state
            print(f"\n--- Plotting Training History for {last_trained_state} ---")
            history = histories[last_trained_state]
            plt.figure(figsize=(10, 6))  # Create a new figure for each plot
            plt.plot(history.history["mae"], label="Train MAE")
            plt.plot(history.history["val_mae"], label="Validation MAE")
            plt.title(f"Training History (MAE) for {last_trained_state}")
            plt.xlabel("Epoch")
            plt.ylabel("MAE")
            plt.legend()
            plt.grid(True)
            plt.show()

            plt.figure(figsize=(10, 6))  # Create a new figure for loss plot
            plt.plot(history.history["loss"], label="Train Loss (MSE)")
            plt.plot(history.history["val_loss"], label="Validation Loss (MSE)")
            plt.title(f"Training History (Loss) for {last_trained_state}")
            plt.xlabel("Epoch")
            plt.ylabel("Loss (MSE)")
            plt.legend()
            plt.grid(True)
            plt.show()
        else:
            print(
                f"No sequences available for {last_trained_state} to perform prediction or plotting."
            )

    else:
        print(
            "\nCould not find the model or data for the last processed state for prediction/plotting."
        )
else:
    print("\nNo models were trained, skipping prediction and plotting.")
