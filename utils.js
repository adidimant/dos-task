const _ = require('lodash');
const express = require('express');
const getIP = require('ipware')().get_ip;
const { MONITORING_LOGS, STATUS_MESSAGES, INSTANCES_STATUSES, INTERNAL_PORT_BASE, EXTERNAL_PORT, ESTABLISHMENT_TESTS } = require('./consts');

const masterPort = process.env.PORT || EXTERNAL_PORT;

const loadLimitsConfig = () => {
    const configParams = ['TIME_UNIT_IN_SEC', 'MAX_REQUESTS_PER_TIME_UNIT', 'OLD_REQUESTS_CLEANUP_TIME_IN_SEC'];
    return _.reduce(_.pick(process.env, configParams), (accumulator, value, key) => {
        accumulator[key] = parseInt(value); return accumulator;
    }, {});
};

const parseRequestData = (req) => ({
    clientId: req.query.clientId,
    clientIp: getIP(req).clientIp
});

const gracefulShutdown = (cluster, serverInstancesManager) => async () => {
    if (!serverInstancesManager.openForRequests) {
        return;
    }
    serverInstancesManager.openForRequests = false;
    console.log(MONITORING_LOGS.startingShutdownMessage);

    try {
        await shutdownWorkers(cluster, serverInstancesManager.instances);
        console.log(MONITORING_LOGS.finishedShutdownMessage);
        process.exit(0);
    } catch (err) {
        console.log(MONITORING_LOGS.failedGracefulShutdown(err));
        process.exit(1);
    }
};

const shutdownWorkers = (cluster, serverInstances) => {
    return new Promise((resolve, reject) => {
        if (!cluster.isMaster) {
            return resolve();
        }
        const workers = _.filter(cluster.workers, worker => !!worker); // Filter all the valid workers
        if (_.isEmpty(workers)) {
            return resolve();
        }

        let iterations = 0;
        const workersKiller = () => {  // Count the number of alive workers and keep looping until the number is zero.
            iterations++;
            if (iterations === 1) {
                _.forEach(workers, (worker) => {
                    serverInstances[worker.process.pid].status = INSTANCES_STATUSES.DISCONNECTED;
                    if (!worker.isDead()) {
                        worker.disconnect();
                        worker.kill(); // Will gracefully wait for disconnection to by completed
                    }
                });
            }
            if (_.every(serverInstances, ({ status }) => status === INSTANCES_STATUSES.DISCONNECTED)) { // Clear the interval when all workers are dead
                clearInterval(interval);
                return resolve();
            }
        };
        const interval = setInterval(workersKiller, 1000);
    });
};

const getSlavePortByWorkerId = (workerId) => {
    let slavePort = INTERNAL_PORT_BASE + parseInt(workerId) - 1;
    return slavePort += (slavePort === masterPort ? 1 : 0);
};

const createWorker = (cluster, serverInstancesManager, isTestedWorker) => {
    const serverInstance = cluster.fork();
    serverInstance.isTestedWorker = isTestedWorker;
    serverInstancesManager.instances[serverInstance.process.pid] = {
        port: getSlavePortByWorkerId(serverInstance.id),
        status: INSTANCES_STATUSES.ONLINE
    };
};

const createWorkerServerInstance = (workerId) => {
    const app = express();
    app.use(express.json());

    app.get('/', (req, res) => {
        res.json(STATUS_MESSAGES.OK);
    });

    const slavePort = getSlavePortByWorkerId(workerId);
    app.listen(slavePort, () => console.log(MONITORING_LOGS.generateServerListenMessage(slavePort, process.pid)));
};

const runEstablishmentTests = async (cluster, coresAmount) => {
    const testedWorker = cluster.workers[1];
    testedWorker.isTestedWorker = true;
    const failedTests = [];

    if (_.keys(cluster.workers).length !== coresAmount) {
        failedTests.push(ESTABLISHMENT_TESTS.ALL_WORKERS_ACTIVE);
    }

    testedWorker.kill();
    await new Promise(res => setTimeout(res, 4000));
    if (_.keys(cluster.workers).length !== coresAmount) {
        failedTests.push(ESTABLISHMENT_TESTS.SUDDEN_DISCONNECTION);
    }

    console.log(failedTests.length === 0 ? MONITORING_LOGS.passedAllEstablishmentTests : MONITORING_LOGS.failedEstablishmentTests(_.split(failedTests, ',')));
};


module.exports = { loadLimitsConfig, gracefulShutdown, parseRequestData, createWorker, createWorkerServerInstance, runEstablishmentTests };
