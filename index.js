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
hook_creds = config.discord.webhook_url.split("/webhooks/")[1].split("/")
const hook = new Discord.WebhookClient(hook_creds[0], hook_creds[1]);

// Little functions i need
function escapeMarkdown(text) {
    var unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1'); // unescape any "backslashed" character
    var escaped = unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1'); // escape *, _, `, ~, \
    return escaped;
}

app.get('/sendmsg', (req, res) => {
    res.set("Connection", "close")
    if(!req.query.name || !req.query.msg) {
        res.sendStatus(400)
        res.end();
    }
    // Needs more string sanitation lol
    hook.send(escapeMarkdown(req.query.msg), {username: escapeMarkdown(req.query.name)}).then(() => {
        res.sendStatus(200);
        res.end();
    }).catch((err) => {
        res.sendStatus(500);
        res.end();
    })
});

app.listen(config.stormworks.listen_port, "127.0.0.1", () => {
    console.log('server started');
  });