from django.urls import path

from . import views

urlpatterns = [
    path("nation", views.get_national),
    path("region", views.get_regional),
    path("state", views.get_state),
    path("state/all", views.get_all_states),
    path("county", views.get_county),
    path("force_email", views.force_email),
    path("notifyme", views.notify_me),
]
