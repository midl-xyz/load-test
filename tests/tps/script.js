import http from 'k6/http';
import {check, fail, sleep} from 'k6';
import {SharedArray} from 'k6/data';
import exec from 'k6/execution';

const RPC_URL = "http://localhost:8545";
const HEADERS = {'Content-Type': 'application/json'};
const rawTxs = new SharedArray('txs', function () {
    return JSON.parse(open('./payloads.json'));
});

export const options = {
    vus: 500,
    duration: '2m',
};

export default function () {
    const tx = rawTxs[exec.scenario.iterationInTest];
    if (tx === undefined) {
        fail("No more transactions to send");
    }
    let res = http.post(RPC_URL, JSON.stringify(tx), {headers: HEADERS});
    console.log(res.body.toString(), res.error, res.error_code);
    check(res,
        {
            "status is 200": (res) => res.status === 200,
            "response does not contain an error": (res) => !res.body.toString().includes("error"),
            "existing response body": (res) => res.body.toString() !== "",
        }
    );
    sleep(1);
}
