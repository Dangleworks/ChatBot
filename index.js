const fs = require("fs");
// Do a quick check if the config exists, if not, copy the default and exit telling the end user to configure it
if(!fs.existsSync("./config.json")){
    fs.copyFileSync("./config.default.json", "config.json");
    console.error("Please set up config.json then restart!");
    process.exit(1);
}

const express = require('express');
const Discord = require("discord.js");
const config  = require("./config.json")
const app = express();
