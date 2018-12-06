const moment = require('moment');

module.exports = {
    // Markets types
    MONTHLY: 0,
    DAILY: 1,
    HOURLY: 2,
    
    // Markets result
    RESULT_NONE: 0,
    RESULT_NOT_DECIDED: 1,
    RESULT_NOT_PLAYED: 2,
    RESULT_PRIZE: 3,
    RESULT_REVENUE: 4,
    RESULT_PENALTY: 5,
    RESULT_CRASH: 6,
    RESULT_DSO_CHEATING: 7,
    RESULT_PLAYER_CHEATING: 8,
    RESULT_CHEATERS: 9,
    
    // Markets states
    STATE_NONE: 0,
    STATE_NOT_RUNNING: 1,
    STATE_WAITING_CONFIRM_TO_START: 2,
    STATE_RUNNING: 3,
    STATE_WAITING_CONFIRM_TO_END: 4,
    STATE_WAITING_FOR_THE_REFEREE: 5,
    STATE_CLOSED: 6,
    STATE_CLOSED_AFTER_JUDGEMENT: 7,
    STATE_CLOSED_NO_PLAYED: 8,

    // Token amounts
    DSO_TOKENS: 20000,
    PLAYER_TOKENS: 20000,
    REFEREE_TOKENS: 1000,
    TOTAL_TOKENS: 20000 + 20000 + 1000,
    ALLOWED_TOKENS: 10000,

    // Market parameters used in the tests

    // Wrong starting time
    WRONG_STARTTIME: moment.utc('2017-12-01 00:00:00').toDate().getTime() / 1000,

    // Lower maximum [kW]
    MAX_LOWER: 10,
    
    // Upper maximum [kW]
    MAX_UPPER: 20,
    
    // Revenue factor [NGT/kW]
    REV_FACTOR: 10,
    
    // Penalty factor [NGT/kW]
    PEN_FACTOR: 20,
    
    // DSO staked NGTs
    DSO_STAKING: 100,
    
    // Player staked NGTs
    PLAYER_STAKING: 200,
    
    // Percentage for referee
    PERC_TKNS_REFEREE: 2,
};
