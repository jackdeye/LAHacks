import logging
import pdb
import sqlite3
from datetime import datetime
from io import StringIO

import pandas as pd
import requests

COUNTY_URL = (
    "https://www.cdc.gov/wcms/vizdata/ncezid_didri/nwsssc2sitemappointsnocoordscsv.csv"
)
STATE_URL = "https://www.cdc.gov/wcms/vizdata/ncezid_didri/SC2StateLevelDownloadCSV.csv"
DB_FILE = "db/dbTest.sqlite"
COUNTY_TABLE = "county_current"
STATE_TABLE = "state_timeseries"

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


def download_csv(url):
    """Downloads a CSV file from the given URL."""
    logging.info(f"Downloading CSV from {url}...")
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        logging.info("Download successful.")
        return response.text
    except requests.exceptions.RequestException as e:
        logging.error(f"Error downloading {url}: {e}")
        return None


def connect_db(db_file):
    """Establishes a connection to the SQLite database."""
    conn = None
    try:
        conn = sqlite3.connect(db_file)
        logging.info(f"Successfully connected to database: {db_file}")
    except sqlite3.Error as e:
        logging.error(f"Error connecting to database {db_file}: {e}")
    return conn


def process_county_data(csv_content, conn):
    """Processes the county-level CSV and appends all data to the county_current table."""
    if not csv_content or not conn:
        logging.warning("Skipping county data processing due to previous errors.")
        return

    logging.info(f"Processing county data for table '{COUNTY_TABLE}'...")
    try:
        csv_file = StringIO(csv_content)
        df = pd.read_csv(csv_file)

        column_mapping = {
            "State/Territory": "State",
            "Sewershed_ID": "Sewershed_ID",
            "Counties_Served": "Counties_Served",
            "Population_Served": "Population_Served",
            "WVAL_Category": "WVAL_Category",
            "Reporting_Week": "Reporting_Week",
        }

        df_to_insert = df[list(column_mapping.keys())].rename(columns=column_mapping)
        df_to_insert["Population_Served"] = pd.to_numeric(
            df_to_insert["Population_Served"], errors="coerce"
        )
        cursor = conn.cursor()

        logging.info(f"Appending {len(df_to_insert)} rows to {COUNTY_TABLE}...")
        df_to_insert.to_sql(COUNTY_TABLE, conn, if_exists="append", index=False)

        conn.commit()
        logging.info("County data successfully appended.")

    except pd.errors.EmptyDataError:
        logging.error("County CSV file is empty.")
    except KeyError as e:
        logging.error(
            f"Column mapping error for county data: Missing column {e}. Check CSV structure and column_mapping."
        )
    except sqlite3.Error as e:
        logging.error(f"Database error during county data insertion: {e}")
        conn.rollback()  # Rollback changes on error
    except Exception as e:
        logging.error(
            f"An unexpected error occurred during county data processing: {e}"
        )
        if conn:
            conn.rollback()


def process_state_data(csv_content, conn):
    """
    Processes the state-level CSV, finds the most recent entry for each state,
    and appends only that data to the state_timeseries table.
    """
    if not csv_content or not conn:
        logging.warning("Skipping state data processing due to previous errors.")
        return

    logging.info(f"Processing state data for table '{STATE_TABLE}'...")
    try:
        csv_file = StringIO(csv_content)
        df = pd.read_csv(csv_file)
        logging.debug(
            f"Original state CSV columns: {df.columns.tolist()}"
        )  # Log original columns

        column_mapping = {
            "State/Territory": "State",
            "Week_Ending_Date": "Ending_Date",  # Source column for date
            "Data_Collection_Period": "Data_Collection_Period",
            "State/Territory_WVAL": "State_WVAL",
            "National_WVAL": "National_WVAL",
            "Regional_WVAL": "Regional_WVAL",
            "WVAL_Category": "WVAL_Category",
            "Coverage": "Coverage",
        }

        missing_cols = [col for col in column_mapping.keys() if col not in df.columns]
        if missing_cols:
            logging.error(f"Missing expected columns in state CSV: {missing_cols}")
            return  # Stop processing if columns are missing

        date_col_csv = "Week_Ending_Date"  # The actual date column in the CSV
        df["Ending_Date_dt"] = pd.to_datetime(df[date_col_csv], errors="coerce")
        df.dropna(subset=["Ending_Date_dt"], inplace=True)
        if df.empty:
            logging.warning(
                "State data is empty after removing rows with invalid dates."
            )
            return

        state_col_csv = "State/Territory"  # The actual state column in the CSV
        latest_idx = df.groupby(state_col_csv)["Ending_Date_dt"].idxmax()
        df_latest = df.loc[latest_idx]
        logging.debug(
            f"Columns in df_latest (before rename): {df_latest.columns.tolist()}"
        )

        df_to_insert = df_latest[list(column_mapping.keys())].rename(
            columns=column_mapping
        )
        logging.debug(
            f"Columns in df_to_insert (after rename): {df_to_insert.columns.tolist()}"
        )

        numeric_cols_db = ["State_WVAL", "National_WVAL", "Regional_WVAL"]
        for col in numeric_cols_db:
            if col in df_to_insert.columns:
                df_to_insert[col] = pd.to_numeric(df_to_insert[col], errors="coerce")
            else:
                # This case shouldn't happen if mapping is correct, but good to check
                logging.warning(
                    f"Column '{col}' not found in df_to_insert for numeric conversion."
                )

        cursor = conn.cursor()
        logging.info(
            f"Appending {len(df_to_insert)} latest state rows to {STATE_TABLE}..."
        )

        df_to_insert.to_sql(STATE_TABLE, conn, if_exists="append", index=False)

        conn.commit()
        logging.info("Latest state data successfully appended.")

    except pd.errors.EmptyDataError:
        logging.error("State CSV file is empty.")
    except KeyError as e:
        logging.error(
            f"Column mapping error for state data: Missing column {e}. Check CSV structure and column_mapping keys."
        )
        logging.error(
            f"Available columns in DataFrame: {df.columns.tolist()}"
        )  # Log available columns
    except sqlite3.Error as e:
        logging.error(f"Database error during state data insertion: {e}")
        conn.rollback()
    except Exception as e:
        logging.error(f"An unexpected error occurred during state data processing: {e}")
        if conn:
            conn.rollback()


if __name__ == "__main__":
    logging.info("Starting batch processing script...")

    connection = connect_db(DB_FILE)

    if connection:
        county_csv_data = download_csv(COUNTY_URL)
        process_county_data(county_csv_data, connection)

        state_csv_data = download_csv(STATE_URL)
        process_state_data(state_csv_data, connection)

        connection.close()
        logging.info("Database connection closed.")
    else:
        logging.error("Could not establish database connection. Exiting.")

    logging.info("Batch processing script finished.")
