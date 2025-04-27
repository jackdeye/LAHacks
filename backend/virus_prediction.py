import os
import json # Import the json library for saving history
import csv # Import csv for saving results

import tensorflow as tf

print("Num GPUs Available: ", len(tf.config.list_physical_devices("GPU")))
# print(tf.test.gpu_device_name()) # This might cause issues if no GPU is configured

# Rest of your imports...
import sqlite3

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error # Corrected import name if needed
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from tensorflow.keras.layers import LSTM, Dense, Dropout, Input
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers import Adam
# from tensorflow.keras.saving import save_model # Not explicitly used here

# --- Configuration ---
DB_PATH = "db/db.sqlite"
MODEL_DIR = "models/"
HISTORY_DIR = "history/"
RESULTS_CSV = "training_results.csv" # CSV for training metrics
PREDICTIONS_CSV = "future_predictions.csv" # CSV for future predictions
SEQUENCE_LENGTH = 4
N_FEATURES = 1
EPOCHS = 200 # You might adjust this based on EarlyStopping behavior
BATCH_SIZE = 32
PREDICT_STEPS = 4 # Number of future weeks to predict

# --- Configure GPU ---
gpus = tf.config.list_physical_devices("GPU")
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        logical_gpus = tf.config.list_logical_devices("GPU")
        print(len(gpus), "Physical GPUs,", len(logical_gpus), "Logical GPUs")
    except RuntimeError as e:
        print(f"GPU Memory Growth Error: {e}")
else:
    print("No GPU detected. Running on CPU.")

# --- Create directories if they don't exist ---
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(HISTORY_DIR, exist_ok=True)
print("-" * 30)

# --- Data Loading ---
print("Loading data...")
conn = sqlite3.connect(DB_PATH) # Ensure db path is correct
query = "SELECT State, Ending_Date, State_WVAL FROM state_timeseries ORDER BY State, Ending_Date"
try:
    df = pd.read_sql(query, conn)
except Exception as e:
    print(f"Error loading data from {DB_PATH}: {e}")
    exit() # Exit if data cannot be loaded
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
        return np.array(X), np.array(y) # Return empty arrays if not enough data
    for i in range(len(data) - sequence_length):
        X.append(data[i : i + sequence_length])
        y.append(data[i + sequence_length])
    return np.array(X), np.array(y)

# --- Prediction Function ---
def predict_future(model, scaler, last_sequence, steps_ahead, sequence_length, n_features):
     predictions_scaled = []
     current_sequence = last_sequence.copy().reshape(1, sequence_length, n_features)
     for _ in range(steps_ahead):
          # Ensure the input shape is correct for model.predict
          pred_scaled = model.predict(current_sequence, verbose=0)[0, 0]
          predictions_scaled.append(pred_scaled)
          # Prepare the next input sequence
          next_step_scaled = np.array([[pred_scaled]]).reshape(1, 1, n_features)
          # Roll the sequence and append the prediction
          current_sequence = np.roll(current_sequence, -1, axis=1) # Shift elements left
          current_sequence[0, -1, :] = next_step_scaled # Add prediction at the end
     # Inverse transform the scaled predictions
     return scaler.inverse_transform(np.array(predictions_scaled).reshape(-1, 1)).flatten()

# --- Data Preprocessing ---
states = df["State"].unique()
state_data = {}
processed_states = [] # Keep track of states with enough data

print(f"Processing data for {len(states)} states...")
for state in states:
    state_df = df[df["State"] == state].copy()
    values = state_df["State_WVAL"].values.reshape(-1, 1)

    if len(values) <= SEQUENCE_LENGTH:
        # print(f"Skipping {state}: Not enough data ({len(values)})") # Optional log
        continue

    scaler = MinMaxScaler()
    try:
        scaled_values = scaler.fit_transform(values)
    except ValueError as e:
        # print(f"Skipping {state}: Scaling error - {e}") # Optional log
        continue

    X, y = create_sequences(scaled_values, SEQUENCE_LENGTH)

    if X.shape[0] == 0:
         # print(f"Skipping {state}: No sequences created.") # Optional log
         continue

    # Store the last sequence needed for prediction *before* splitting
    last_sequence_scaled = scaled_values[-SEQUENCE_LENGTH:]
    state_data[state] = {"X": X, "y": y, "scaler": scaler, "last_sequence_scaled": last_sequence_scaled}
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
    model.compile(optimizer=Adam(learning_rate=0.0005), loss="mse", metrics=["mae"]) # Use 'mae' for Mean Absolute Error
    return model

# --- Initialize CSV files ---
# Write header for training results CSV if it doesn't exist
if not os.path.exists(RESULTS_CSV):
    with open(RESULTS_CSV, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['State', 'Test_Loss_MSE', 'Test_MAE'])

# Write header for predictions CSV if it doesn't exist
if not os.path.exists(PREDICTIONS_CSV):
    with open(PREDICTIONS_CSV, 'w', newline='') as f:
        writer = csv.writer(f)
        headers = ['State'] + [f'Week_{i+1}_Prediction' for i in range(PREDICT_STEPS)]
        writer.writerow(headers)


# --- Training Loop ---
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
        scaler = state_data[state]["scaler"]
        last_sequence_scaled = state_data[state]["last_sequence_scaled"] # Get the last sequence for prediction

        # Ensure data is sufficient for split
        if len(X) < 2:
             print(f"Skipping training for {state}: Not enough sequences ({len(X)}) for train/test split.")
             continue

        # Adjust test_size dynamically if dataset is small
        test_size = 0.2 if len(X) >= 5 else 1/len(X) # Ensure at least one test sample

        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, shuffle=False # Keep shuffle=False for time series
            )
        except ValueError as e:
            print(f"Skipping training for {state}: Error during split - {e}")
            continue

        if X_train.shape[0] == 0 or X_test.shape[0] == 0:
            print(f"Skipping training for {state}: Empty train or test set after split.")
            continue

        # Build model
        model = build_improved_model(SEQUENCE_LENGTH, N_FEATURES)

        # Define file paths
        model_filepath = os.path.join(MODEL_DIR, f"best_model_{state}.keras")
        history_filepath = os.path.join(HISTORY_DIR, f"history_{state}.json") # History file path

        # Callbacks
        callbacks = [
            EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True, verbose=1),
            ModelCheckpoint(
                filepath=model_filepath,
                save_best_only=True,
                monitor='val_loss',
                verbose=0
            ),
        ]

        # Train the model
        print(f"Fitting model for {state}...")
        history = model.fit(
            X_train,
            y_train,
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            validation_data=(X_test, y_test),
            callbacks=callbacks,
            verbose=1, # Set to 1 or 2 for progress
        )

        # Save the training history
        print(f"Saving training history to {history_filepath}")
        history_dict = {key: [float(val) for val in values] for key, values in history.history.items()}
        try:
            with open(history_filepath, 'w') as f:
                json.dump(history_dict, f, indent=4)
            print(f"Successfully saved history for {state}.")
        except Exception as e:
            print(f"Error saving history for {state}: {e}")

        # Evaluate the final (best) model
        print(f"Evaluating final (best) model for {state} on test data...")
        loss = -1.0 # Default values in case evaluation fails
        mae = -1.0
        try:
            # Ensure the best model is loaded (restore_best_weights=True should do this,
            # but loading explicitly is safer if checkpoint exists)
            if os.path.exists(model_filepath):
                 best_model = tf.keras.models.load_model(model_filepath)
                 loss, mae = best_model.evaluate(X_test, y_test, verbose=0)
                 print(f"Test Loss (MSE) for {state}: {loss:.4f}")
                 print(f"Test MAE for {state}: {mae:.4f}") # Ensure metric name matches compile()
            else:
                 print(f"Warning: Best model file not found at {model_filepath}. Using the model from the end of training.")
                 # Evaluate the model currently in memory (last epoch if early stopping didn't restore)
                 loss, mae = model.evaluate(X_test, y_test, verbose=0)
                 print(f"Test Loss (MSE) for {state} (end of training): {loss:.4f}")
                 print(f"Test MAE for {state} (end of training): {mae:.4f}") # Ensure metric name matches compile()

        except Exception as e:
             print(f"Could not evaluate the model for {state}: {e}")

        print(f"Appending results to {RESULTS_CSV}")
        try:
            with open(RESULTS_CSV, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([state, loss, mae])
        except Exception as e:
            print(f"Error appending results to {RESULTS_CSV} for {state}: {e}")


        print(f"Predicting next {PREDICT_STEPS} weeks for {state}...")
        try:
            # Use the evaluated best_model if available, otherwise the model in memory
            model_to_predict = best_model if 'best_model' in locals() and os.path.exists(model_filepath) else model

            # Reshape last_sequence_scaled correctly for predict_future
            last_sequence_input = last_sequence_scaled.reshape(SEQUENCE_LENGTH, N_FEATURES)

            future_predictions = predict_future(
                model_to_predict,
                scaler,
                last_sequence_input, # Use the correctly shaped last sequence
                steps_ahead=PREDICT_STEPS,
                sequence_length=SEQUENCE_LENGTH,
                n_features=N_FEATURES
            )
            print(f"Predicted 'State_WVAL' for {state} for next {PREDICT_STEPS} steps: {future_predictions}")

            # Append predictions to CSV
            print(f"Appending predictions to {PREDICTIONS_CSV}")
            with open(PREDICTIONS_CSV, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([state] + future_predictions.tolist()) # Convert numpy array to list

        except Exception as e:
            print(f"Error during prediction or saving predictions for {state}: {e}")

        # Clean up best_model variable to avoid using the wrong one in the next loop iteration if loading failed
        if 'best_model' in locals():
            del best_model


print("\nTraining and prediction script finished.")
