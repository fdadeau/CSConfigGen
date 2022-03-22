"use strict";

const distance = require("./distance");

const fs = require("fs");

const DEBUG = false;

const outputName = "output_" + Date.now() + ".json";

const ALPHA = {
    "Vehicle": 5,
    "Road": 3,
    "Platoon": 4, 
    "Station": 2 
}
const INTERFACE_CONNECTION_COMPLEXITY = {
    "moving,connV": 0.2,
    "moving,leader": 0.2,
    "connV,leader": 0.15,
    "next,connV": 0.1
}

fs.readFile(process.argv[2] ? process.argv[2] : "../data/VANET.2configs.json", (err, data) => {
    if (err) {
        console.error(err)
        return
    }
    // console.log(data);
    go(data)
});



function go(data) {
    let tabConfigs;
    try {
        tabConfigs = JSON.parse(data);
    }
    catch (err) {
        console.log(err);
        return;
    }
    let t = tabConfigs.map(function(c) {
        return { 
            "complexity": distance.complexity(c, null, ALPHA, INTERFACE_CONNECTION_COMPLEXITY), 
            "score": distance.score(c)
        };
    });
    console.log(t);

    let clusters = distance.KMeans(t, 4, "c-only");
    console.log(clusters);

    return t;
}



