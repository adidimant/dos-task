const rateLimit = require('express-rate-limit');
const { loadLimitsConfig } = require('./utils');
const { STATUS_MESSAGES } = require('./consts');
const limitsConfig = loadLimitsConfig();

const ipLimiter = rateLimit({
    windowMs: limitsConfig.TIME_UNIT_IN_SEC * 1000,
    max: limitsConfig.MAX_REQUESTS_PER_TIME_UNIT,
    message: STATUS_MESSAGES.SERVICE_UNAVAILABLE
});

const clientLimiter = (clientsRequests) => {
    return (req, res, next) => {
        const clientId = req.query.clientId;
        const currentTime = new Date();

        if (!clientsRequests[clientId] || currentTime - clientsRequests[clientId].initTimeFrame > limitsConfig.TIME_UNIT_IN_SEC * 1000) {
            clientsRequests[clientId] = {
                initTimeFrame: currentTime,
                count: 0
            };
        }
        if (clientsRequests[clientId].count < limitsConfig.MAX_REQUESTS_PER_TIME_UNIT) {
            clientsRequests[clientId].count++;
            next();
        } else {
            res.json(STATUS_MESSAGES.SERVICE_UNAVAILABLE);
        }
    };
};

const validateIsServerUp = (req, res, next) => {
    if (process.env.OPEN_FOR_REQUESTS === 'true') {
        next();
    } else {
        res.json(STATUS_MESSAGES.SERVICE_UNAVAILABLE);
    }
};

module.exports = { ipLimiter, clientLimiter, validateIsServerUp };