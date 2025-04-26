from django.shortcuts import render

from django.http import HttpResponse, JsonResponse

import json

# Create your views here.
def get_national(request):
    if request.method == "GET":
        try:
            params = request.GET
            return JsonResponse({"you_sent": params.dict()})
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
    return JsonResponse({"error": "GET required"}, status=405)

def get_regional(request):
    return HttpResponse("Regional")

def get_state(request):
    return HttpResponse("State")

def get_county(request):
    return HttpResponse("County")