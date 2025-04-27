import json  # Import the json library for saving history
import os

import tensorflow as tf

print("Num GPUs Available: ", len(tf.config.list_physical_devices("GPU")))
# print(tf.test.gpu_device_name()) # This might cause issues if no GPU is configured

import sqlite3

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from tensorflow.keras.layers import LSTM, Dense, Dropout, Input
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers import Adam

gpus = tf.config.list_physical_devices("GPU")
if gpus:
    try:
        # Currently, memory growth needs to be the same across GPUs
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        logical_gpus = tf.config.list_logical_devices("GPU")
        print(len(gpus), "Physical GPUs,", len(logical_gpus), "Logical GPUs")
    except RuntimeError as e:
        # Memory growth must be set before GPUs have been initialized
        print(e)
else:
    print("No GPU detected. Running on CPU.")


# --- Data Loading ---
print("Loading data...")
conn = sqlite3.connect("db/db.sqlite")  # Ensure db path is correct
query = "SELECT State, Ending_Date, State_WVAL FROM state_timeseries ORDER BY State, Ending_Date"
try:
    df = pd.read_sql(query, conn)
except Exception as e:
    print(f"Error loading data from db/db.sqlite: {e}")
    exit()  # Exit if data cannot be loaded
finally:
    conn.close()

df["Ending_Date"] = pd.to_datetime(df["Ending_Date"])
df = df.sort_values(["State", "Ending_Date"])

print("Missing values per column:")
print(df.isnull().sum())
# Optional: Handle missing values if needed
# df.dropna(inplace=True)
print("-" * 30)


# --- Sequence Creation Function ---
def create_sequences(data, sequence_length):
    X, y = [], []
    if len(data) <= sequence_length:
        return np.array(X), np.array(y)  # Return empty arrays if not enough data
    for i in range(len(data) - sequence_length):
        X.append(data[i : i + sequence_length])
        y.append(data[i + sequence_length])
    return np.array(X), np.array(y)


# --- Data Preprocessing ---
sequence_length = 4
n_features = 1
states = df["State"].unique()
state_data = {}
processed_states = []  # Keep track of states with enough data

print(f"Processing data for {len(states)} states...")
for state in states:
    state_df = df[df["State"] == state].copy()
    values = state_df["State_WVAL"].values.reshape(-1, 1)

    if len(values) <= sequence_length:
        # print(f"Skipping {state}: Not enough data ({len(values)})") # Optional log
        continue

    scaler = MinMaxScaler()
    try:
        scaled_values = scaler.fit_transform(values)
    except ValueError as e:
        # print(f"Skipping {state}: Scaling error - {e}") # Optional log
        continue

    X, y = create_sequences(scaled_values, sequence_length)

    if X.shape[0] == 0:
        # print(f"Skipping {state}: No sequences created.") # Optional log
        continue

    state_data[state] = {"X": X, "y": y, "scaler": scaler}
    processed_states.append(state)

print(f"Successfully processed data for {len(processed_states)} states.")
print("-" * 30)


# --- Model Building Function ---
def build_improved_model(sequence_length, n_features):
    model = Sequential(
        [
            Input(shape=(sequence_length, n_features)),
            LSTM(64, return_sequences=True),
            Dropout(0.2),
            LSTM(32),
            Dense(1),
        ]
    )
    model.compile(optimizer=Adam(learning_rate=0.0005), loss="mse", metrics=["mae"])
    return model


# --- Training Loop ---
epochs = 200  # You might adjust this based on EarlyStopping behavior
batch_size = 32
# trained_models = {} # Storing models in memory might be excessive if many states
model_dir = "models/"
history_dir = "history/"  # Directory to save history files

# --- Create directories if they don't exist ---
os.makedirs(model_dir, exist_ok=True)
os.makedirs(history_dir, exist_ok=True)

if not processed_states:
    print("No states have sufficient data for training. Exiting.")
else:
    print(f"Starting training for {len(processed_states)} states...")
    for state in processed_states:
        print(f"\n--- Training model for {state} ---")
        if state not in state_data:
            print(f"Error: Data for state {state} not found in state_data. Skipping.")
            continue

        X = state_data[state]["X"]
        y = state_data[state]["y"]

        # Ensure data is sufficient for split
        if len(X) < 2:
            print(
                f"Skipping training for {state}: Not enough sequences ({len(X)}) for train/test split."
            )
            continue

        test_size = 0.2 if len(X) >= 5 else 1 / len(X)

        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, shuffle=False  # Keep shuffle=False
            )
        except ValueError as e:
            print(f"Skipping training for {state}: Error during split - {e}")
            continue

        if X_train.shape[0] == 0 or X_test.shape[0] == 0:
            print(f"Skipping training for {state}: Empty train/test set after split.")
            continue

        # Build model
        model = build_improved_model(sequence_length, n_features)

        # Define file paths
        model_filepath = os.path.join(model_dir, f"best_model_{state}.keras")
        history_filepath = os.path.join(
            history_dir, f"history_{state}.json"
        )  # History file path

        # Callbacks
        callbacks = [
            EarlyStopping(
                monitor="val_loss", patience=10, restore_best_weights=True, verbose=1
            ),  # Monitor val_loss
            ModelCheckpoint(
                filepath=model_filepath,
                save_best_only=True,
                monitor="val_loss",  # Monitor val_loss
                verbose=0,  # Can set to 1 for more feedback
            ),
        ]

        # Train the model
        print(f"Fitting model for {state}...")
        history = model.fit(
            X_train,
            y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=(X_test, y_test),
            callbacks=callbacks,
            verbose=1,  # Set to 1 or 2 for progress, 0 for silent
        )

        # --- MODIFICATION: Save the training history ---
        print(f"Saving training history to {history_filepath}")
        # Convert the history dictionary to a JSON-serializable format
        # (Numpy floats need to be converted to standard Python floats)
        history_dict = {
            key: [float(val) for val in values]
            for key, values in history.history.items()
        }
        try:
            with open(history_filepath, "w") as f:
                json.dump(history_dict, f, indent=4)
            print(f"Successfully saved history for {state}.")
        except Exception as e:
            print(f"Error saving history for {state}: {e}")

        # trained_models[state] = {"model": model, "history": history} # Avoid storing all models/histories in memory

        # Optional: Evaluate immediately after training
        print(f"Evaluating final (best) model for {state} on test data...")
        # ModelCheckpoint restored best weights if EarlyStopping stopped,
        # or the last epoch's weights if epochs completed.
        # If EarlyStopping restored weights, loading the saved model ensures consistency.
        try:
            best_model = tf.keras.models.load_model(
                model_filepath
            )  # Load the best saved model
            loss, mae = best_model.evaluate(X_test, y_test, verbose=0)
            print(f"Test Loss (MSE) for {state}: {loss:.4f}")
            print(f"Test MAE for {state}: {mae:.4f}")
        except Exception as e:
            print(f"Could not load or evaluate the saved model {model_filepath}: {e}")


# --- Example Usage / Plotting (Optional - Modify as needed) ---
# This part used the in-memory 'trained_models', which we removed for scalability.
# If you need prediction/plotting, you'll need to load the model and history
# from the saved files for a specific state.

# Example: Load and predict for one state (e.g., Alabama)
example_state = "Alabama"
example_model_path = os.path.join(model_dir, f"best_model_{example_state}.keras")
example_history_path = os.path.join(history_dir, f"history_{example_state}.json")

if example_state in state_data and os.path.exists(example_model_path):
    print(f"\n--- Example: Loading and Predicting for {example_state} ---")
    try:
        loaded_model = tf.keras.models.load_model(example_model_path)
        scaler = state_data[example_state]["scaler"]
        last_sequence = state_data[example_state]["X"][-1]

        # Prediction function needs to be defined or accessible here
        def predict_future(
            model, scaler, last_sequence, steps_ahead, sequence_length, n_features
        ):
            predictions_scaled = []
            current_sequence = last_sequence.copy().reshape(
                1, sequence_length, n_features
            )
            for _ in range(steps_ahead):
                pred_scaled = model.predict(current_sequence, verbose=0)[0, 0]
                predictions_scaled.append(pred_scaled)
                next_step_scaled = np.array([[pred_scaled]]).reshape(1, 1, n_features)
                current_sequence = np.roll(current_sequence, -1, axis=1)
                current_sequence[0, -1, :] = next_step_scaled
            return scaler.inverse_transform(
                np.array(predictions_scaled).reshape(-1, 1)
            ).flatten()

        future_predictions = predict_future(
            loaded_model,
            scaler,
            last_sequence,
            steps_ahead=4,
            sequence_length=sequence_length,
            n_features=n_features,
        )
        print(
            f"Predicted 'State_WVAL' for {example_state} for next 4 steps: {future_predictions}"
        )

        # Plot history if available
        if os.path.exists(example_history_path):
            with open(example_history_path, "r") as f:
                loaded_history = json.load(f)
            plt.figure(figsize=(10, 5))
            plt.plot(loaded_history["mae"], label="Train MAE")
            plt.plot(loaded_history["val_mae"], label="Validation MAE")
            plt.title(f"Training History (MAE) for {example_state}")
            plt.xlabel("Epoch")
            plt.ylabel("MAE")
            plt.legend()
            plt.grid(True)
            plt.show()
    except Exception as e:
        print(f"Error during example usage for {example_state}: {e}")
else:
    print(f"\nCannot run example for {example_state}: Model or data not found.")

print("\nTraining script finished.")
