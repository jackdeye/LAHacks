from .models import CountyCurrent, StateTimeseries, EmailList, FuturePrediction
from django.core.mail import send_mail
from django.forms.models import model_to_dict

# Send email if:
# - If wcat is High+
# - If wcat increased/a set % increased from last week
# - If AI Model predicts outbreak

def send_email():

    unique_states = StateTimeseries.objects.values_list(
                "state_territory", flat=True
            ).distinct()

    if not unique_states:
        return

    for state in unique_states:
        state_history = StateTimeseries.objects.filter(
                            state_territory=state
                        ).order_by("-ending_date")

        seen = set()
        unique_state_history = []
        for entry in state_history:
            key = entry.ending_date
            if key not in seen:
                seen.add(key)
                unique_state_history.append(entry)

        print(f"Checking {state}")

        latest_record = unique_state_history[0]
        previous_record = unique_state_history[1]

        if not latest_record or not previous_record:
            print(f"Need two records to make analysis - {state}")
            continue

        if not latest_record.state_territory_wval or not latest_record.wval_category:
            print(f"No current records - {state}")
            continue

        if not previous_record.state_territory_wval or not previous_record.wval_category:
            print(f"No previous records - {state}")
            continue

        latest_wval = latest_record.state_territory_wval
        latest_cat = latest_record.wval_category

        previous_wval = previous_record.state_territory_wval
        previous_cat = previous_record.wval_category
    
        create_email = False
        email_reason = 0
        # Check category condition
        if latest_cat == 'High' or latest_cat == 'Very High':
            create_email = True
            email_reason = 1
        elif latest_cat == 'Moderate' and (previous_cat == 'Low' or previous_cat == 'Very Low'):
            create_email = True
            email_reason = 2
        
        if create_email == False:
            perc_change = abs(latest_wval - previous_wval) / previous_wval
            if perc_change > 0.325 and latest_cat not in 'Very Low':
                create_email = True
                email_reason = 3
        
        if create_email == False and latest_cat not in 'Very Low':
            prediction = model_to_dict(FuturePrediction.objects.filter(state=state).first())
            print(prediction)
            pred1 = prediction['week_1_prediction']
            pred2 = prediction['week_2_prediction']
            pred3 = prediction['week_3_prediction']
            pred4 = prediction['week_4_prediction']

            if pred1 and abs(pred1 - latest_wval) / latest_wval > 0.325:
                create_email = True
                email_reason = 4
            elif pred2 and abs(pred2 - latest_wval) / latest_wval > 0.325:
                create_email = True
                email_reason = 4
            elif pred3 and abs(pred3 - latest_wval) / latest_wval > 0.325:
                create_email = True
                email_reason = 4
            elif pred4 and abs(pred4 - latest_wval) / latest_wval > 0.325:
                create_email = True
                email_reason = 4


        if create_email and email_reason <= 3:
            print(f"Sending emails for {state}:")
            email_body = f"""\
Hello.
We are emailing you in regard to COVID risk in {state}.

The current week's CDC WVal Category is {latest_cat}.
The CDC WVal Category for last week was {previous_cat}.

The current week's CDC WVal is {latest_wval}.
The CDC WVal for last week is {previous_wval}.

Current Week - {latest_record.ending_date}
Last Week - {previous_record.ending_date}

Based on these values, we recommend taking extra caution in avoiding COVID.
Wearing a mask outdoors, social distancing, and making sure you're vaccinated are 
all recommended steps you can take. 

Please visit the following World Health Organization site to learn more:
https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public

Thank you for staying informed."""

            print(email_body)

            emails = EmailList.objects.filter(
                            location=state
            )

            for email in list(emails.values()):
                print(email)

                send_mail(
                    'Recent COVID Trends',
                    email_body,
                    'noreply@wastewatchers.com',
                    [email['email']],
                    fail_silently=False,
                )
        elif create_email and email_reason >= 4:
            print(f"Sending emails for {state}:")
            email_body = f"""\
Hello.
We are emailing you in regard to COVID risk in {state}.

The current week's CDC WVal Category is {latest_cat}.
The CDC WVal Category for last week was {previous_cat}.

The current week's CDC WVal is {latest_wval}.
The CDC WVal for last week is {previous_wval}.

Using an AI model, we are able to predict the potential future CDC WVal.
The predicted CDC WVal one week from now is {pred1}.
The predicted CDC WVal two week from now is {pred2}.
The predicted CDC WVal three week from now is {pred3}.
The predicted CDC WVal four week from now is {pred4}.

Current Week - {latest_record.ending_date}
Last Week - {previous_record.ending_date}

Based on these predicted values, we recommend taking extra caution in avoiding COVID.
Wearing a mask outdoors, social distancing, and making sure you're vaccinated are 
all recommended steps you can take. 

Please visit the following World Health Organization site to learn more:
https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public

Thank you for staying informed."""

            print(email_body)

            emails = EmailList.objects.filter(
                            location=state
            )

            for email in list(emails.values()):
                print(email)

                send_mail(
                    'Recent COVID Trends',
                    email_body,
                    'noreply@wastewatchers.com',
                    [email['email']],
                    fail_silently=False,
                )