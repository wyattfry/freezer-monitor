const axios = require('axios').default;
const config = require('./config.json');

const ALARM_MINIMUM_TEMP_F = process.env.ALARM_MINIMUM_TEMP_F || 15;

// [{"datetime":"2020-12-07T23:34:53.000Z","tempC":-11.2}]

// axios.get('http://10.0.1.55:3000/state')
// {"isCooling":true}

function cToF(number) {
    const res = Number.parseFloat( (number * 9/5 + 32).toFixed(1) );

    return res;
}

function getTemperatureHistory() {
    return axios.get(`http://${config.freezerPiHost}/temperature-history?minutes=10`);
}

function getRunningState() {
    return axios.get(`http://${config.freezerPiHost}/state`);
}

function postMessage(text) {
    const body = {
        text,
        channel: config.channelId,
        parse: "full",
    }
    return postToSlack(body, "chat.postMessage");
}

function setTopic(topic) {
    const body = {
        topic,
        channel: config.channelId,
    }
    return postToSlack(body, "conversations.setTopic");
}

function postToSlack(body, method) {
    return axios.post(`https://slack.com/api/${method}`, body, {
            headers: {
                'content-type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${config.accessToken}`
            }
        })
}

function average(nums) {
    return nums.reduce((a, b) => (a + b)) / nums.length;
}

function iteration() {
    Promise.all([getTemperatureHistory(), getRunningState()])
    .then(results => {
        const isFreezerRunning = results[1].data.isCooling;
        const tenMinAvg = cToF(average(results[0].data
            .filter(i => i.tempC < 30) // if reading is > 30 celsius, it's probably a sensor error
            .map(i => i.tempC)))
        if (tenMinAvg > ALARM_MINIMUM_TEMP_F) {
            postMessage(`*WARNING*: :warning: Freezer too warm! Average temperature over last 10 minutes was ${tenMinAvg}°F. Freezer is ${isFreezerRunning? 'in cooling phase :snowflake:' : 'in warming phase :zzz:'} @channel`)
            setTopic(`Last health check :warning:. Average temperature 10 min temp: ${tenMinAvg}°F. Freezer is ${isFreezerRunning? 'in cooling phase :snowflake:' : 'in warming phase :zzz:'}`)
        } else {
            // setTopic(`Last health check :heavy_check_mark: at ${new Date()}. 10m Avg T: ${tenMinAvg}°F. Freezer is ${isFreezerRunning? 'in cooling phase :snowflake:' : 'in warming phase :zzz:'}`)
        }
    })
    .catch(error => {
        console.error(error);
        postMessage(`*WARNING*: :warning: Freezer thermostat computer may be down! Check immediately! http://${config.freezerPiHost} -- ${error} @channel`);
        setTopic(`Last health check :warning: No response from freezer!`);
    })
}

iteration();

const intervalMins = config.checkIntervalMins || 5;

setInterval(iteration, intervalMins * 1000 * 60);