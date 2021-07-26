const fs = require("fs");
// Do a quick check if the config exists, if not, copy the default and exit telling the end user to configure it
if (!fs.existsSync("./config.json")) {
    fs.copyFileSync("./config.default.json", "config.json");
    console.error("Please set up config.json then restart!");
    process.exit(1);
}

var steam = require('steam-web');
const express = require('express');
const Discord = require("discord.js");
const config = require("./config.json")
const app = express();
hook_creds = config.discord.webhook_url.split("/webhooks/")[1].split("/")
const hook = new Discord.WebhookClient(hook_creds[0], hook_creds[1]);
const bot = new Discord.Client();
const sapi = new steam({
    apiKey: config.steam.api_key,
    format: 'json'
});
// Little functions i need
function escapeMarkdown(text) {
    var unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1'); // unescape any "backslashed" character
    var escaped = unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1'); // escape *, _, `, ~, \
    var escaped = escaped.replace(/\[.+\]\(.+\)/g, '\\$&')
    return escaped;
}

bot.on('ready', () => {
    console.log(`Logged into Discord as ${bot.user.tag}`);
    bot.fetchWebhook(hook.id).then((webhook) => {
        webhook_channelID = webhook.channelID;
    });
})

// Define global variables
var messages = [];
var webhook_channelID;

app.get('/sendmsg', (req, res) => {
    res.set("Connection", "close")
    if (!req.query.msg || !req.query.sid) {
        res.sendStatus(400)
        res.end();
    }
    sapi.getPlayerSummaries({
        steamids: [req.query.sid],
        callback: (err, data) => {
            if (err) {
                res.sendStatus(500);
                res.end();
            }
            hook.send(escapeMarkdown(req.query.msg), {
                disableMentions: "all",
                username: escapeMarkdown(data.response.players[0].personaname),
                avatarURL: data.response.players[0].avatarfull
            }).then(() => {
                res.sendStatus(200);
                res.end();
            }).catch((err) => {
                res.sendStatus(500);
                res.end();
            })
        }
    })
});

app.get('/srvmsg', (req, res) => {
    res.set("Connection", "close");
    if (!req.query.msg || !req.query.name || !req.query.avatarURL) {
        res.sendStatus(400)
        res.end();
    }
    hook.send(req.query.msg, {
        username: req.query.name,
        avatarURL: req.query.avatarURL
    }).then(() => {
        res.sendStatus(200);
        res.end();
    }).catch((err) => {
        res.sendStatus(500);
        res.end();
    })
});

app.get("/getmsgs", (req, res) => {
    res.set("Connection", "close");
    if(messages.length == 0) {
        res.send("");
        res.end();
    }
    res.send(messages.shift());
})

bot.on('message', async (msg) => {
    if(msg.channel.id !== webhook_channelID) return;
    if(msg.content === "") return;
    cleanmsg = msg.content.replace(/([^\x00-\x7F]|;|<|>|{|})/g, "");
    cleanmsg = cleanmsg.replace(/\x0A/, " ");
    if(cleanmsg === "") return;
    cleantag = msg.author.tag.replace(/([^\x00-\x7F]|;|<|>|{|}|\n)/g, "");
    endmsg   = cleantag + "\r" + cleanmsg
    messages.push(endmsg);
});

app.listen(config.stormworks.listen_port, "127.0.0.1", () => {
    console.log('server started');
    if(config.discord.token_optional) {
        bot.login(config.discord.token_optional);
    }
});