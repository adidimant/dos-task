const axios = require('axios');
const baseURL = 'http://localhost:8080/';

const callServer = async (clientId) => {
    try {
        return (await axios.get(`${baseURL}?clientId=${clientId}`)).data;
    } catch (err) {
        return err.response ? (err.response.data || err.response.statusText) : 'Server Communication Error';
    }
};

module.exports = { callServer };