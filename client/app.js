const io = require('console-read-write');
const _ = require('lodash');
const { callServer } = require('./serverApi');


const attack = async (clientsAmount) => {
    const clientTask = async (clientId) => {
        let isTaskOn = true;
        process.on('SIGINT', () => {
            console.info(`Closing task for clientId - ${clientId}.`);
            isTaskOn = false;
        });

        while (isTaskOn) {
            io.write(await callServer(clientId));
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    };

    const requests = _.map(_.range(1, clientsAmount + 1), async (clientId) => await clientTask(clientId));

    await Promise.all(requests);
};

async function main() {
    io.write(`Hello Amir!`);
    io.write('How many clients do you want for performing DoS attack?');
    let clientsAmount = parseInt(await io.read());

    while (_.isNaN(clientsAmount)) {
        io.write('Recieved NaN value, try enter client amounts again!');
        clientsAmount = parseInt(await io.read());
    }

    await attack(clientsAmount);

    await new Promise(resolve => setTimeout(resolve, 1000));
    io.write('Attack attempts finished. Thanks!');
}

main();