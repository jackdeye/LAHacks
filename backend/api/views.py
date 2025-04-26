from django.http import JsonResponse
from .models import CountyCurrent, StateTimeseries
from django.db.models import Avg
from django.forms.models import model_to_dict

def get_county(request):
    if request.method == "GET":
        state = request.GET.get("state")
        county = request.GET.get("county")
        historical = request.GET.get('history', 'false').lower() == 'true'

        if historical:
            return JsonResponse({"error": "Historical data not available on a per-county basis"}, status=400)
        
        if not state or not county:
            return JsonResponse({"error": "Missing 'state' or 'county' parameter"}, status=400)
        
        try:
            records = CountyCurrent.objects.filter(
                state_territory__icontains=state,
                counties_served__icontains=county
            )

            if not records:
                return JsonResponse({"error": "No matching counties found"}, status=404)

            result = list(records.values())
            return JsonResponse(result, safe=False)


        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "GET request required"}, status=405)

def get_state(request):
    if request.method == "GET":
        state = request.GET.get("state")
        val = request.GET.get('val')
        historical = request.GET.get('history', 'false').lower() == 'true'

        if not state:
            return JsonResponse({"error": "Missing 'state' parameter"}, status=400)

        if historical:
            # Historical query from StateTimeseries
            records = StateTimeseries.objects.filter(
                state_territory__icontains=state,
            ).order_by('ending_date')

            if not records:
                return JsonResponse({"error": "No matching states found"}, status=404)

            result = list(records.values())
            return JsonResponse(result, safe=False)
        else:
            # Current query from StateTimeseries
            record = StateTimeseries.objects.filter(
                state_territory__icontains=state,
            ).order_by('-ending_date').first()

            if not record:
                return JsonResponse({"error": "No matching states found"}, status=404)

            return JsonResponse(model_to_dict(record), safe=False)

    return JsonResponse({"error": "GET request required"}, status=405)

def get_regional(request):
    # Each state in a region has the same wval_regional,
    # So we can just return one of the states in that region
    if request.method == "GET":
        region = request.GET.get("region").upper()
        historical = request.GET.get('history', 'false').lower() == 'true'

        state = ''

        match region:
            case 'S': # South
                state = 'Alabama'
            case 'W': # West
                state = 'California'
            case 'MW': # Midwest
                state = 'Illinois'
            case 'NE': # Northeast
                state = 'New York'

        if not state:
            return JsonResponse({"error": "Missing 'state' parameter"}, status=400)

        if historical:
            # Historical query from StateTimeseries
            records = StateTimeseries.objects.filter(
                state_territory__icontains=state,
            ).order_by('ending_date')

            if not records:
                return JsonResponse({"error": "No matching states found"}, status=404)

            result = list(records.values())
            return JsonResponse(result, safe=False)
        else:
            # Current query from StateTimeseries
            record = StateTimeseries.objects.filter(
                state_territory__icontains=state,
            ).order_by('-ending_date').first()

            if not record:
                return JsonResponse({"error": "No matching states found"}, status=404)

            return JsonResponse(model_to_dict(record), safe=False)

    return JsonResponse({"error": "GET request required"}, status=405)

def get_national(request):
    # Each state in the nation has the same wval_national,
    # So we can just return one of the states in that region
    if request.method == "GET":
        historical = request.GET.get('history', 'false').lower() == 'true'

        state = 'California'

        if not state:
            return JsonResponse({"error": "Missing 'state' parameter"}, status=400)

        if historical:
            # Historical query from StateTimeseries
            records = StateTimeseries.objects.filter(
                state_territory__icontains=state,
            ).order_by('ending_date')

            if not records:
                return JsonResponse({"error": "No matching states found"}, status=404)

            result = list(records.values())
            return JsonResponse(result, safe=False)
        else:
            # Current query from StateTimeseries
            record = StateTimeseries.objects.filter(
                state_territory__icontains=state,
            ).order_by('-ending_date').first()

            if not record:
                return JsonResponse({"error": "No matching states found"}, status=404)

            return JsonResponse(model_to_dict(record), safe=False)

    return JsonResponse({"error": "GET request required"}, status=405)
