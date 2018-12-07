const moment = require('moment');

function getFirstLastTSNextMonth(ts) {
    var m = moment.utc(ts)
    m = m.add(1, 'months');

    return {
        first: parseInt(m.startOf('month').valueOf()/1000),
        last: parseInt(m.endOf('month').valueOf()/1000)
    };
}

function getFirstLastTSNextDay(ts) {
    var m = moment.utc(ts)
    m = m.add(1, 'days');

    return {
        first: parseInt(m.startOf('day').valueOf()/1000),
        last: parseInt(m.endOf('day').valueOf()/1000)
    };
}

function getFirstLastTSNextHour(ts) {
    var m = moment.utc(ts)
    m = m.add(1, 'hour');

    return {
        first: parseInt(m.startOf('hour').valueOf()/1000),
        last: parseInt(m.endOf('hour').valueOf()/1000)
    };
}

module.exports = {
    getFirstLastTSNextMonth,
    getFirstLastTSNextDay,
    getFirstLastTSNextHour
};
