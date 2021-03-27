const getIP = require('ipware')().get_ip;
const _ = require('lodash');
const { loadLimitsConfig, parseRequestData } = require('./utils');
const { STATUS_MESSAGES, INSTANCES_STATUSES } = require('./consts');
const limitsConfig = loadLimitsConfig();

const sendRequestDataToMaster = (req, res, next) => {
    process.send(parseRequestData(req));
    console.log('message sent to parent!');
    next();
};

const validateRequestTimeFrame2 = (requests, key, res, next) => {
    console.log('child requesrs middlewear - ' + JSON.stringify(requests) + ' with key - ' + key);
    if (requests[key].count <= limitsConfig.MAX_REQUESTS_PER_TIME_UNIT) {
        next();
    } else {
        res.json('key not good - ' + key + ' ' + STATUS_MESSAGES.SERVICE_UNAVAILABLE); //TODO - DELETE PREFIX
    }
};

const validateRequestTimeFrame = (requests, key) => { //TODO - change name for key
    console.log('child requesrs middlewear - ' + JSON.stringify(requests) + ' with key - ' + key);
    return !requests[key] || requests[key].count < limitsConfig.MAX_REQUESTS_PER_TIME_UNIT;
};

const updateRequest = (requests, key) => { //TODO - change name
    console.log('Updating requests in master: ' + JSON.stringify(requests));
    const currentTime = new Date();
    //TODO - i have timing issue for the last one
    if (!requests[key] || currentTime - requests[key].initTimeFrame > limitsConfig.TIME_UNIT_IN_SEC * 1000) {
        requests[key] = {
            initTimeFrame: currentTime,
            count: 0
        };
    }
    requests[key].count++;
};

const handleRequestLimiters = (clientsRequests, ipRequests) => {
    return (req, res, next) => {
        const clientId = req.query.clientId;
        const ip = getIP(req);
        console.log('clientsRequests: ' + JSON.stringify(clientsRequests));
        console.log('ipRequests: ' + JSON.stringify(ipRequests));
        validateRequestTimeFrame(clientsRequests, clientId, res, next);
        validateRequestTimeFrame(ipRequests, ip, res, next);
    };
};

const validateIsServerUp2 = (serverInstances) => {
    return (req, res, next) => {
        if (serverInstances[process.pid] && serverInstances[process.pid] === INSTANCES_STATUSES.ONLINE) {
            next();
        } else {
            res.json('serverInstances: ' + JSON.stringify(serverInstances) + ' process.pid: ' + process.pid + ' ' + STATUS_MESSAGES.SERVICE_UNAVAILABLE); //TODO delete prefix
        }
    };
};

const validateIsServerUp = (serverInstances, processId) => {
    return _.isEmpty(serverInstances) || (serverInstances[processId] && serverInstances[processId] === INSTANCES_STATUSES.ONLINE);
};

module.exports = { sendRequestDataToMaster, validateRequestTimeFrame, validateIsServerUp, updateRequest }; //TODO - remove all redundant