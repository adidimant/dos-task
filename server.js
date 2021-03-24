require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const _ = require('lodash');
const { ipLimiter, clientLimiter, validateIsServerUp } = require('./middlewares');
const { loadLimitsConfig, shutdownListener } = require('./utils');
const { STATUS_MESSAGES, MONITORING_LOGS } = require('./consts');

const limitsConfig = loadLimitsConfig();
const port = process.env.PORT || 8080;
let clientsRequests = {};

const app = express();
app.use(validateIsServerUp);
app.use(clientLimiter(clientsRequests));
app.use(ipLimiter);
app.use(express.json());

app.get('/', (req, res) => {
    res.json(STATUS_MESSAGES.OK);
});

const server = app.listen(port, () => console.log(MONITORING_LOGS.generateServerListenMessage(port)));
shutdownListener(server);


const cleanOldRequests = () => {
    const currentTime = new Date();
    clientsRequests = _.pickBy(clientsRequests, (reqDetails) => currentTime - reqDetails.initTimeFrame < limitsConfig.TIME_UNIT_IN_SEC * 1000);
};

const task = cron.schedule(`*/${limitsConfig.OLD_REQUESTS_CLEANUP_TIME_IN_SEC} * * * * *`, () => cleanOldRequests());
task.start();
