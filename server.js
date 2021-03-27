require('dotenv').config();
const express = require('express');
const os = require('os');
const cluster = require('cluster');
const cron = require('node-cron');
const _ = require('lodash');
const { sendRequestDataToMaster, validateRequestTimeFrame, validateIsServerUp, updateRequest } = require('./middlewares');
const { loadLimitsConfig, gracefulShutdown, parseRequestData } = require('./utils');
const { MONITORING_LOGS, STATUS_MESSAGES, INSTANCES_STATUSES, KEYBOARD_SIGNAL } = require('./consts');

const limitsConfig = loadLimitsConfig();
const port = process.env.PORT || 8080;
const coresAmount = os.cpus().length;

let clientsRequests = {}, ipRequests = {};
let serverInstancesManager = {
    shutdownInProgress: false, //TODO - change to openForRequests
    instances: {}
};

const createServerInstance = async () => {
    const app = express();

    process.on('message', (message) => {
        clientsRequests = message.clientsRequests;
        ipRequests = message.ipRequests;
        serverInstancesManager = message.serverInstancesManager; //TODO - change to isOn or something
        console.log('arrived message from parent, process id - ' + process.pid);
    });

    app.use(sendRequestDataToMaster);

    //app.use(validateIsServerUp(serverInstancesManager.instances));
    app.use(express.json());

    app.get('/', async (req, res) => {
        const { clientId, clientIp } = parseRequestData(req);
        if (validateIsServerUp(serverInstancesManager.instances, process.pid) && validateRequestTimeFrame(clientsRequests, clientId) && validateRequestTimeFrame(ipRequests, clientIp)) {
            res.json(STATUS_MESSAGES.OK + ' process id - ' + process.pid);
        } else {
            res.json('503, process id - ' + process.pid);
        }
    });

    app.listen(port, () => console.log(MONITORING_LOGS.generateServerListenMessage(port, process.pid)));
};

const sendDataToWorkers = () => {
    const requests = {
        serverInstancesManager,
        clientsRequests,
        ipRequests
    };
    _.forEach(cluster.workers, (worker) => {
        worker.send(requests);
    });
};

const createWorker = () => {
    const serverInstance = cluster.fork();
    serverInstancesManager.instances[serverInstance.process.pid] = INSTANCES_STATUSES.ONLINE;
    serverInstance.on('message', (message) => {
        clientsRequests = message.clientsRequests;
        ipRequests = message.ipRequests;
        serverInstancesManager = message.serverInstancesManager; //TODO - change to isOn or something
        console.log('arrived message from parent, process id - ' + process.pid);
    });
};

const establishServerInstances = async () => {
    if (coresAmount > 1) {
        if (cluster.isMaster) {
            for (const i of _.range(0, coresAmount)) {
                createWorker();
            }
            sendDataToWorkers();

            cluster.on('message', (childWorker, requestData) => {
                updateRequest(clientsRequests, requestData.clientId);
                updateRequest(ipRequests, requestData.clientIp);
                console.log('recieved in parent (process id - ' + process.pid + '): ' + JSON.stringify(requestData));
                sendDataToWorkers();
            });

            cluster.on(KEYBOARD_SIGNAL, gracefulShutdown(cluster, serverInstancesManager));

            cluster.on(INSTANCES_STATUSES.ONLINE, worker => {
                console.log(MONITORING_LOGS.workerProcessOnlineMessage(worker.process.pid));
            });

            cluster.on(INSTANCES_STATUSES.DISCONNECTED, (worker) => {
                serverInstancesManager.instances[worker.process.pid] = INSTANCES_STATUSES.DISCONNECTED;
                if (!serverInstancesManager.shutdownInProgress) { // Unplanned disconnect of server instance - terminating current instance & creating new one
                    worker.kill();
                    delete serverInstancesManager.instances[worker.process.pid];
                    createWorker();
                } else {
                    console.log(MONITORING_LOGS.closedServerMessage(worker.process.pid));
                }
            });
        } else {
            await createServerInstance(); //TOOD - consider delete await
        }
    } else {
        await createServerInstance(); //TODO - make sure this is signal for 1 core only!
    }
};

establishServerInstances();

const cleanOldRequests = () => {
    const clean = (requests) => { requests = _.pickBy(requests, (requestData) => new Date() - requestData.initTimeFrame < limitsConfig.TIME_UNIT_IN_SEC * 1000); };

    clean(clientsRequests);
    clean(ipRequests);
    sendDataToWorkers(); //TODO - change name
};

if (cluster.isMaster) {
    const task = cron.schedule(`*/${limitsConfig.OLD_REQUESTS_CLEANUP_TIME_IN_SEC} * * * * *`, () => cleanOldRequests());
    task.start();
}