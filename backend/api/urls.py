from django.urls import path

from . import views

urlpatterns = [
    path("nation", views.get_national),
    path("region", views.get_regional),
    path("state", views.get_state),
    path("county", views.get_county),
]