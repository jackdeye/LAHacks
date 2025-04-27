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
from tensorflow.keras.layers import LSTM, Dense, Dropout, Input
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.saving import save_model

# Data loading
conn = sqlite3.connect("db/db.sqlite")
query = "SELECT State, Ending_Date, State_WVAL FROM state_timeseries ORDER BY State, Ending_Date"
df = pd.read_sql(query, conn)
conn.close()

df["Ending_Date"] = pd.to_datetime(df["Ending_Date"])
df = df.sort_values(["State", "Ending_Date"])

print(df.isnull().sum())


def create_sequences(data, sequence_length):
    X, y = [], []
    for i in range(len(data) - sequence_length):
        X.append(data[i : i + sequence_length])
        y.append(data[i + sequence_length])
    return np.array(X), np.array(y)


sequence_length = 4
n_features = 1
states = df["State"].unique()
state_data = {}

for state in states:
    state_df = df[df["State"] == state]
    values = state_df["State_WVAL"].values.reshape(-1, 1)

    scaler = MinMaxScaler()
    scaled_values = scaler.fit_transform(values)
    X, y = create_sequences(scaled_values, sequence_length)

    state_data[state] = {"X": X, "y": y, "scaler": scaler}


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


epochs = 200
batch_size = 32
trained_models = {}

for state in states:
    print(f"\nTraining model for {state}")
    X = state_data[state]["X"]
    y = state_data[state]["y"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )

    model = build_improved_model(sequence_length, n_features)

    callbacks = [
        EarlyStopping(patience=10, restore_best_weights=True),
        ModelCheckpoint(
            f"models/best_model_{state}.keras",  # Changed from .h5 to .keras
            save_best_only=True,
        ),
    ]
    history = model.fit(
        X_train,
        y_train,
        epochs=epochs,
        batch_size=batch_size,
        validation_data=(X_test, y_test),
        callbacks=callbacks,
        verbose=1,
    )

    trained_models[state] = {"model": model, "history": history}


def predict_future(model, scaler, last_sequence, steps_ahead):
    predictions = []
    current_sequence = last_sequence.copy()

    for _ in range(steps_ahead):
        pred = model.predict(current_sequence.reshape(1, sequence_length, n_features))[
            0, 0
        ]
        predictions.append(pred)
        current_sequence = np.roll(current_sequence, -1)
        current_sequence[-1] = pred

    return scaler.inverse_transform(np.array(predictions).reshape(-1, 1)).flatten()


# Example usage
state = "Alabama"
model = trained_models[state]["model"]
scaler = state_data[state]["scaler"]
last_sequence = state_data[state]["X"][-1]

future_predictions = predict_future(model, scaler, last_sequence, steps_ahead=4)
print(f"Predicted viral load for {state} for next 4 weeks: {future_predictions}")

# Plot training history
plt.plot(history.history["mae"], label="Train MAE")
plt.plot(history.history["val_mae"], label="Validation MAE")
plt.xlabel("Epoch")
plt.ylabel("MAE")
plt.legend()
plt.show()

# Evaluate on test set
y_pred = model.predict(X_test)
y_pred_actual = scaler.inverse_transform(y_pred)
y_test_actual = scaler.inverse_transform(y_test.reshape(-1, 1))

print(
    f"Actual MAE in original scale: {mean_absolute_error(y_test_actual, y_pred_actual)}"
)
