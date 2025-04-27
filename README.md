# WasteWatchers

WasteWatchers was created over the span of a 36-hour hackathon, LAHacks 2025.

You can read more about the devlopment process on the DevPost page.

## About
WasteWatchers helps communities stay informed about virus outbreaks before they happen. Our platform utilizes public health efforts to assess risk levels and help make informed decisions.

# Setup

First, clone the project with your favorite method of `git clone`.

## Frontend
Make sure you have an up-to-date version of Node.JS and NPM.
Then, you can navigate into the `frontend` folder and run `npm install`. This will install the necessary packages to run the frontend.

Run `npm run dev` to start the frontend for local development.

## Backend
Make sure you have an up-to-date version of Python 3 and PIP. Now navigate into the `backend` folder. You'll likely want to create a [Python venv](https://docs.python.org/3/library/venv.html) to work in. Then run `pip install -r requirements.txt`. This will install the necessary packages to run the backend. If you want emailing support, you'll need to create a `.env` file, and populate it with the following:
```
EMAIL_HOST=<your_email>
EMAIL_APP_PASS=<your_email_password>
```

Run `python manage.py runserver` to start the backend for local development.