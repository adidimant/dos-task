const request = require('request');
const _ = require('lodash');
const { loadLimitsConfig, parseRequestData } = require('./utils');
const { MONITORING_LOGS, STATUS_MESSAGES, INSTANCES_STATUSES, BASE_URL, DISCONNECTION_HANDELED_ERROR_CODES } = require('./consts');
const limitsConfig = loadLimitsConfig();


const validateRequestTimeFrame = (requests, key) => {
    const currentTime = new Date();
    if (!requests[key] || currentTime - requests[key].initTimeFrame > limitsConfig.TIME_UNIT_IN_SEC * 1000) {
        requests[key] = {
            initTimeFrame: currentTime,
            count: 0
        };
    }
    if (requests[key].count < limitsConfig.MAX_REQUESTS_PER_TIME_UNIT) {
        requests[key].count++;
        return true;
    }
    return false;
};

const validateRequestLimiters = (req, clientsRequests, ipRequests) => {
    const { clientId, clientIp } = parseRequestData(req);
    return validateRequestTimeFrame(clientsRequests, clientId) && validateRequestTimeFrame(ipRequests, clientIp);
};

const validateRequest = (req, serverInstancesManager, clientsRequests, ipRequests) => (
    serverInstancesManager.openForRequests && validateRequestLimiters(req, clientsRequests, ipRequests)
);

const loadBalancer = (serverInstancesManager, clientsRequests, ipRequests) => {
    return (req, res) => {
        if (!validateRequest(req, serverInstancesManager, clientsRequests, ipRequests)) {
            res.json(STATUS_MESSAGES.SERVICE_UNAVAILABLE);
            return;
        }

        const currServerIndex = _.values(serverInstancesManager.instances)[serverInstancesManager.currServerIndex].status === INSTANCES_STATUSES.ONLINE ?
            serverInstancesManager.currServerIndex : _.findIndex(_.values(serverInstancesManager.instances), ({ status }) => status === INSTANCES_STATUSES.ONLINE);
        if (currServerIndex !== -1) {
            const slavePort = _.values(serverInstancesManager.instances)[currServerIndex].port;
            const pipedRequest = request({ url: `${BASE_URL}:${slavePort}${req.url}` }).on('error', (error) => {
                if (_.includes(DISCONNECTION_HANDELED_ERROR_CODES, error.code)) {
                    return;
                } else {
                    console.log(MONITORING_LOGS.unHandledDisconnectionErrorMessage(error));
                }
            });
            req.pipe(pipedRequest).pipe(res);
        }
        serverInstancesManager.currServerIndex = (currServerIndex + 1) % _.keys(serverInstancesManager.instances).length;
    };
};


module.exports = { loadBalancer, validateRequest };