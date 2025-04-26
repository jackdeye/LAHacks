# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class CountyCurrent(models.Model):
    state_territory = models.TextField(db_column="State/Territory")
    sewershed_id = models.TextField(db_column="Sewershed_ID", primary_key=True)
    counties_served = models.TextField(db_column="Counties_Served")
    population_served = models.FloatField(db_column="Population_Served")
    wval_category = models.TextField(db_column="WVAL_Category")
    reporting_week = models.TextField(db_column="Reporting_Week")

    class Meta:
        managed = False
        db_table = "county_current"


class StateTimeseries(models.Model):
    state_territory = models.TextField(db_column="State/Territory")
    week_ending_date = models.TextField(db_column="Week_Ending_Date")
    data_collection_period = models.TextField(db_column="Data_Collection_Period")
    state_territory_wval = models.FloatField(db_column="State/Territory_WVAL")
    national_wval = models.FloatField(db_column="National_WVAL")
    regional_wval = models.FloatField(db_column="Regional_WVAL")
    wval_category = models.TextField(db_column="WVAL_Category")
    coverage = models.TextField(db_column="Coverage")

    class Meta:
        db_table = "state_timeseries"
        unique_together = [["state_territory", "week_ending_date"]]
