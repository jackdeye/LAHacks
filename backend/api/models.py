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
        managed = false
        db_table = "state_timeseries"
