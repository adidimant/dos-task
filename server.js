require('dotenv').config();
const express = require('express');
const os = require('os');
const cluster = require('cluster');
const cron = require('node-cron');
const _ = require('lodash');
const { loadBalancer, validateRequest } = require('./middlewares');
const { loadLimitsConfig, gracefulShutdown, createWorker, createWorkerServerInstance, runEstablishmentTests } = require('./utils');
const { MONITORING_LOGS, STATUS_MESSAGES, INSTANCES_STATUSES, KEYBOARD_SIGNAL, EXTERNAL_PORT } = require('./consts');

const limitsConfig = loadLimitsConfig();
const masterPort = process.env.PORT || EXTERNAL_PORT;
const coresAmount = os.cpus().length;

let clientsRequests = {}, ipRequests = {};
let serverInstancesManager = {
    openForRequests: true,
    currServerIndex: 0,
    instances: {}
};

const activateEventListenersForMaster = () => {
    process.on(KEYBOARD_SIGNAL, gracefulShutdown(cluster, serverInstancesManager));

    cluster.on(INSTANCES_STATUSES.ONLINE, worker => {
        if (!worker.isTestedWorker) {
            console.log(MONITORING_LOGS.workerProcessOnlineMessage(worker.process.pid));
        }
    });

    cluster.on(INSTANCES_STATUSES.DISCONNECTED, (worker) => {
        serverInstancesManager.instances[worker.process.pid].status = INSTANCES_STATUSES.DISCONNECTED;
        if (serverInstancesManager.openForRequests) { // Unplanned disconnect of server instance - terminating current instance & creating new one
            worker.kill();
            delete serverInstancesManager.instances[worker.process.pid];
            if (!worker.isTestedWorker) {
                console.log(MONITORING_LOGS.disconnectedServerMessage(worker.process.pid));
            }
            createWorker(cluster, serverInstancesManager, worker.isTestedWorker);
        } else {
            console.log(MONITORING_LOGS.closedServerMessage(worker.process.pid));
        }
    });
};

const createSingleCoreServer = () => {
    const app = express();
    app.use(express.json());

    app.get('/', (req, res) => {
        if (validateRequest(req, serverInstancesManager, clientsRequests, ipRequests)) {
            res.json(STATUS_MESSAGES.OK);
        } else {
            res.json(STATUS_MESSAGES.SERVICE_UNAVAILABLE);
        }
    });

    app.listen(masterPort, () => console.log(MONITORING_LOGS.generateServerListenMessage(masterPort, null)));
};

const establishServerInstances = async () => {
    if (coresAmount > 1) {
        if (cluster.isMaster) {
            const server = express().get('/', loadBalancer(serverInstancesManager, clientsRequests, ipRequests));
            server.listen(masterPort, () => console.log(MONITORING_LOGS.generateServerListenMessage(masterPort, null)));

            activateEventListenersForMaster();

            for (const i of _.range(0, coresAmount)) {
                createWorker(cluster, serverInstancesManager, false);
            }

            await runEstablishmentTests(cluster, coresAmount);

        } else {
            createWorkerServerInstance(cluster.worker.id);
        }
    } else {
        createSingleCoreServer();
    }
};

establishServerInstances();

const cleanOldRequests = () => {
    const clean = (requests) => { requests = _.pickBy(requests, (requestData) => new Date() - requestData.initTimeFrame < limitsConfig.TIME_UNIT_IN_SEC * 1000); };

    clean(clientsRequests);
    clean(ipRequests);
};

if (cluster.isMaster) {
    // Cron task that runs on the master for cleaning old requests that we shouldn't track anymore
    const task = cron.schedule(`*/${limitsConfig.OLD_REQUESTS_CLEANUP_TIME_IN_SEC} * * * * *`, () => cleanOldRequests());
    task.start();
}