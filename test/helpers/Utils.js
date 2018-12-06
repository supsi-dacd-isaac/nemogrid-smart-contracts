const moment = require('moment');

function getFirstLastTSNextMonth(ts) {
    var m = moment.utc(ts)
    m = m.add(1, 'months');

    return {
        first: parseInt(m.startOf('month').valueOf()/1000),
        last: parseInt(m.endOf('month').valueOf()/1000)
    };
}

module.exports = {
    getFirstLastTSNextMonth
};
