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
	statusMessage = '';
        const isFreezerRunning = results[1].data.isCooling;
        const tenMinAvg = cToF(average(results[0].data
            .filter(i => i.tempC < 30) // if reading is > 30 celsius, it's probably a sensor error
            .map(i => i.tempC)));
	statusMessage += `10 Min Avg: ${tenMinAvg}°F `;

	const history = results[0].data;
	const t1 = history[history.length - 1].tempC;
	let t2 = t1;
	let t2Idx = history.length - 1;
	while (t1 === t2 || t2Idx < 0) {
            t2 = history[t2Idx--].tempC;
	    console.log(t1, t2, t2Idx);
	}
	if (t1 > t2) {
	   statusMessage += 'Temp is rising, '
           if (tenMinAvg > ALARM_MINIMUM_TEMP_F && temperatureIsIncreasing) {
   	       console.log('Freezer too warm and getting warmer! Posting message to slack...');
               postMessage(`*WARNING*: :warning: Freezer too warm and getting warmer! Average temperature over last 10 minutes was ${tenMinAvg}°F. Freezer is ${isFreezerRunning? 'in cooling phase :snowflake:' : 'in warming phase :zzz:'} @channel`)
	          .then(() => console.log('Sent.'));
	   }
	} else if (t1 < t2) {
           statusMessage += 'Temp is falling, '
	} else {
           statusMessage += 'Temp is constant, '
	}
	statusMessage += `motor state: ${isFreezerRunning ? 'running' : 'not running'}`;
	console.log(statusMessage);
    })
    .catch(error => {
        console.error(error);
        postMessage(`*WARNING*: :warning: Freezer thermostat computer may be down! Check immediately! http://${config.freezerPiHost} -- ${error} @channel`);
        // setTopic(`Last health check :warning: No response from freezer!`);
    })
}

console.log('Freezer monitor running...');

iteration();

const intervalMins = config.checkIntervalMins || 5;

setInterval(iteration, intervalMins * 1000 * 60);
