from django.urls import path

from . import views

urlpatterns = [
    path("national", views.get_national),
    path("regional", views.get_regional),
    path("state", views.get_state),
    path("county", views.get_county),
]