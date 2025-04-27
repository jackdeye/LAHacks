from django.db import models
from django.db.models import CompositePrimaryKey


class CountyCurrent(models.Model):
    state_territory = models.TextField(db_column="State")
    sewershed_id = models.TextField(db_column="Sewershed_ID", primary_key=True)
    counties_served = models.TextField(db_column="Counties_Served")
    population_served = models.FloatField(db_column="Population_Served")
    wval_category = models.TextField(db_column="WVAL_Category")
    reporting_week = models.TextField(db_column="Reporting_Week")

    class Meta:
        managed = False
        db_table = "county_current"


class StateTimeseries(models.Model):
    pk = CompositePrimaryKey("state_territory", "ending_date")
    state_territory = models.TextField(db_column="State")
    ending_date = models.DateField(db_column="Ending_Date")
    data_collection_period = models.TextField(db_column="Data_Collection_Period")
    state_territory_wval = models.FloatField(db_column="State_WVAL")
    national_wval = models.FloatField(db_column="National_WVAL")
    regional_wval = models.FloatField(db_column="Regional_WVAL")
    wval_category = models.TextField(db_column="WVAL_Category")
    coverage = models.TextField(db_column="Coverage")

    class Meta:
        managed = False
        db_table = "state_timeseries"


class FuturePrediction(models.Model):
    state = models.TextField(db_column="state", primary_key=True)
    week_1_prediction = models.FloatField(db_column="Week_1_Prediction")
    week_2_prediction = models.FloatField(db_column="Week_2_Prediction")
    week_3_prediction = models.FloatField(db_column="Week_3_Prediction")
    week_4_prediction = models.FloatField(db_column="Week_4_Prediction")

    class Meta:
        managed = False
        db_table = "future_predictions"

    def to_dict(self):
        return {
            "state": self.state,
            "week_1_prediction": self.week_1_prediction,
            "week_2_prediction": self.week_2_prediction,
            "week_3_prediction": self.week_3_prediction,
            "week_4_prediction": self.week_4_prediction,
        }
