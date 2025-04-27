from collections import defaultdict

from django.db.models import Avg
from django.forms.models import model_to_dict
from django.http import JsonResponse

from .models import CountyCurrent, FuturePrediction, StateTimeseries
from django.views.decorators.csrf import csrf_exempt
from .tasks import *
import json
from collections import defaultdict

from .models import CountyCurrent, StateTimeseries

WVAL_CATEGORY_MAPPING = {
    "Very Low": 1,
    "Low": 2,
    "Medium": 3,
    "High": 4,
    "Very High": 5,
}

REVERSE_WVAL_CATEGORY_MAPPING = {v: k for k, v in WVAL_CATEGORY_MAPPING.items()}


def average_wval_category(values):
    if not values:
        return None
    numeric_values = [
        WVAL_CATEGORY_MAPPING.get(val) for val in values if val in WVAL_CATEGORY_MAPPING
    ]
    if not numeric_values:
        return None
    average = sum(numeric_values) / len(numeric_values)
    closest_category_value = min(
        REVERSE_WVAL_CATEGORY_MAPPING.keys(), key=lambda k: abs(k - average)
    )
    return REVERSE_WVAL_CATEGORY_MAPPING.get(closest_category_value)


def get_county(request):
    if request.method == "GET":
        state = request.GET.get("state")
        county = request.GET.get("county")
        historical = request.GET.get("history", "false").lower() == "true"

        if historical:
            return JsonResponse(
                {"error": "Historical data not available on a per-county basis"},
                status=400,
            )

        if not state:
            return JsonResponse({"error": "Missing 'state' parameter"}, status=400)

        try:
            records = ""
            if not county:
                records = CountyCurrent.objects.filter(state_territory__icontains=state)
            else:
                records = CountyCurrent.objects.filter(
                    state_territory__icontains=state, counties_served__icontains=county
                )

            if not records:
                return JsonResponse({"error": "No matching counties found"}, status=404)

            if not county:
                entries = list(records.values())

                county_groups_categories = defaultdict(list)

                for entry in entries:
                    counties_served = entry.get("counties_served")
                    wval_cat = entry.get("wval_category")

                    if counties_served and wval_cat is not None:
                        county_names = [
                            name.strip()
                            for name in counties_served.split(",")
                            if name.strip()
                        ]
                        for county_name in county_names:
                            if county_name:
                                county_groups_categories[county_name].append(wval_cat)
                            else:
                                print("Empty county name?")

                response = []
                for county_name, wval_list in county_groups_categories.items():
                    if wval_list:
                        averaged_category = average_wval_category(wval_list)
                        response.append(
                            {
                                "state_territory": records.first().state_territory,
                                "counties_served": county_name,
                                "wval_category": averaged_category,
                                "reporting week": records.first().reporting_week,
                            }
                        )

                return JsonResponse(response, safe=False)
            else:
                wval_categories = [record.wval_category for record in records]
                averaged_category = average_wval_category(wval_categories)

                first_record = records.first()

                if averaged_category:
                    result = {
                        "state_territory": first_record.state_territory,
                        "counties_served": first_record.counties_served,
                        "wval_category": averaged_category,
                        "reporting_week": first_record.reporting_week,
                    }
                    return JsonResponse(result)
                else:
                    return JsonResponse(
                        {"error": "Could not average wval_category"}, status=500
                    )

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "GET request required"}, status=405)


def get_state(request):
    if request.method == "GET":
        state = request.GET.get("state")
        historical = request.GET.get("history", "false").lower() == "true"

        if not state:
            return JsonResponse({"error": "Missing 'state' parameter"}, status=400)

        if historical:
            # Historical query from StateTimeseries
            records = StateTimeseries.objects.filter(
                state_territory__icontains=state,
            ).order_by("ending_date")

            if not records:
                return JsonResponse({"error": "No matching states found"}, status=404)

            result = list(records.values())
            return JsonResponse(result, safe=False)
        else:
            # Current query from StateTimeseries
            record = (
                StateTimeseries.objects.filter(
                    state_territory__icontains=state,
                )
                .order_by("-ending_date")
                .first()
            )

            if not record:
                return JsonResponse({"error": "No matching states found"}, status=404)

            return JsonResponse(model_to_dict(record), safe=False)

    return JsonResponse({"error": "GET request required"}, status=405)


def get_all_states(request):
    if request.method == "GET":
        try:
            unique_states = StateTimeseries.objects.values_list(
                "state_territory", flat=True
            ).distinct()
            all_state_data = {}

            history = request.GET.get("history") == "true"

            for state in unique_states:
                if history:
                    state_history = StateTimeseries.objects.filter(
                        state_territory=state
                    ).order_by("ending_date")
                    all_state_data[state] = [
                        model_to_dict(record) for record in state_history
                    ]
                else:
                    # Retrieve only the latest record for the state
                    latest_record = (
                        StateTimeseries.objects.filter(state_territory=state)
                        .order_by("-ending_date")
                        .first()
                    )
                    if latest_record:
                        all_state_data[state] = model_to_dict(latest_record)

            if not all_state_data:
                return JsonResponse({"error": "No state data found"}, status=404)

            return JsonResponse(all_state_data, safe=False)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "GET request required"}, status=405)


def get_regional(request):
    # Each state in a region has the same wval_regional,
    # So we can just return one of the states in that region
    if request.method == "GET":
        region = request.GET.get("region").upper()
        historical = request.GET.get("history", "false").lower() == "true"

        state = ""

        match region:
            case "S":  # South
                state = "Alabama"
            case "W":  # West
                state = "California"
            case "MW":  # Midwest
                state = "Illinois"
            case "NE":  # Northeast
                state = "New York"

        if not state:
            return JsonResponse({"error": "Missing 'state' parameter"}, status=400)

        if historical:
            # Historical query from StateTimeseries
            records = StateTimeseries.objects.filter(
                state_territory__icontains=state,
            ).order_by("ending_date")

            if not records:
                return JsonResponse({"error": "No matching states found"}, status=404)

            result = list(records.values())
            return JsonResponse(result, safe=False)
        else:
            # Current query from StateTimeseries
            record = (
                StateTimeseries.objects.filter(
                    state_territory__icontains=state,
                )
                .order_by("-ending_date")
                .first()
            )

            if not record:
                return JsonResponse({"error": "No matching states found"}, status=404)

            return JsonResponse(model_to_dict(record), safe=False)

    return JsonResponse({"error": "GET request required"}, status=405)


def get_national(request):
    # Each state in the nation has the same wval_national,
    # So we can just return one of the states in that region
    if request.method == "GET":
        historical = request.GET.get("history", "false").lower() == "true"

        state = "California"

        if not state:
            return JsonResponse({"error": "Missing 'state' parameter"}, status=400)

        if historical:
            # Historical query from StateTimeseries
            records = StateTimeseries.objects.filter(
                state_territory__icontains=state,
            ).order_by("ending_date")

            if not records:
                return JsonResponse({"error": "No matching states found"}, status=404)

            result = list(records.values())
            return JsonResponse(result, safe=False)
        else:
            # Current query from StateTimeseries
            record = (
                StateTimeseries.objects.filter(
                    state_territory__icontains=state,
                )
                .order_by("-ending_date")
                .first()
            )

            if not record:
                return JsonResponse({"error": "No matching states found"}, status=404)

            return JsonResponse(model_to_dict(record), safe=False)

    return JsonResponse({"error": "GET request required"}, status=405)

@csrf_exempt
def notify_me(request):
    print(request)
    if request.method == "POST":
        params = json.loads(request.body)
        print(f"{params}")
        email = params['email']
        location = params['location']

        print(f"email: {email}, loc: {location}")

        if not email or not location:
            return JsonResponse({'message': 'Email and location are required.'}, status=400)

        # Check if the email is already in the database
        if EmailList.objects.filter(email=email).exists():
            return JsonResponse({'message': 'This email is already subscribed.'}, status=400)

        # Save the data to the database
        email_entry = EmailList(email=email, location=location)
        email_entry.save()

        return JsonResponse({'message': 'You will now be informed!'}, status=200)

    else:
        return JsonResponse({"error": "POST request required"}, status=405)


def get_predictions(request):
    predictions = FuturePrediction.objects.all()
    predictions_list = [prediction.to_dict() for prediction in predictions]
    return JsonResponse({"predictions": predictions_list})


def force_email(request):
    if request.method == "GET":
        send_email()
        return JsonResponse({"response": "Emails on the way"}, status=200)
    else:
        return JsonResponse({"error": "GET request required"}, status=405)
