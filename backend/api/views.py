from django.db.models import Avg
from django.forms.models import model_to_dict
from django.http import JsonResponse

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

        if not state or not county:
            return JsonResponse(
                {"error": "Missing 'state' or 'county' parameter"}, status=400
            )

        try:
            records = CountyCurrent.objects.filter(
                state_territory__icontains=state, counties_served__icontains=county
            )

            if not records:
                return JsonResponse({"error": "No matching counties found"}, status=404)

            wval_categories = [record.wval_category for record in records]
            averaged_category = average_wval_category(wval_categories)

            first_record = records.first()

            if averaged_category:
                result = {
                    "state_territory": first_record.state_territory,
                    "counties_served": first_record.counties_served,
                    "wval_category": averaged_category,
                    "reporting_week": "Averaged across available weeks",
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
            all_state_data = []

            for state in unique_states:
                latest_record = (
                    StateTimeseries.objects.filter(state_territory=state)
                    .order_by("-ending_date")
                    .first()
                )
                if latest_record:
                    all_state_data.append(model_to_dict(latest_record))

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
