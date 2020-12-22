# Freezer Monitor

This is a monitor and Slack alert app for the raspberry pi freezer thermostat project.

Alerts appear in Slack look like this:

```
wyatts_serviceAPP  11:01 AM
WARNING: :warning: Freezer too warm! Average temperature over last 10 minutes was 30.2°F. Freezer is in cooling phase :snowflake: @channel
```

## Install

Create a file called `config.json`, you can use `config.example.json` as a model. Fill in the api key (see https://api.slack.com/apps/A017VJ2F2D9), you can leave the rest as-is.

Run `npm install && npm start &` to install packages, start the program, and send to background.