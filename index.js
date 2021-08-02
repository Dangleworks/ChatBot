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
var steam_cache = {};

app.get('/sendmsg', async (req, res) => {
    if (!req.query.msg || !req.query.sid) {
        return res.sendStatus(400).end();
    }
    if (!steam_cache[req.query.sid]) {
        await sapi.getPlayerSummaries({
            steamids: [req.query.sid],
            callback: (err, data) => {
                if (err) {
                    res.sendStatus(500).end();
                    res.end();
                }
                steam_cache[req.query.sid] = {
                    "avatar": data.response.players[0].avatarfull,
                    "name": data.response.players[0].personaname
                }
                hook.send(escapeMarkdown(req.query.msg), {
                    disableMentions: "all",
                    username: escapeMarkdown(steam_cache[req.query.sid].name || "Unknown"),
                    avatarURL: (steam_cache[req.query.sid].avatar || "https://cdn.discordapp.com/embed/avatars/0.png")
                }).then(() => {
                    return res.sendStatus(200).end();
                }).catch((err) => {
                    return res.sendStatus(500).end();
                })
            }
        })
    } else {
        hook.send(escapeMarkdown(req.query.msg), {
            disableMentions: "all",
            username: escapeMarkdown(steam_cache[req.query.sid].name || "Unknown"),
            avatarURL: (steam_cache[req.query.sid].avatar || "https://cdn.discordapp.com/embed/avatars/0.png")
        }).then(() => {
            return res.sendStatus(200).end();
        }).catch((err) => {
            return res.sendStatus(500).end();
        })
    }
});

app.get('/srvmsg', (req, res) => {
    if (!req.query.msg || !req.query.name || !req.query.avatarURL) {
        return res.sendStatus(400).end()
    }
    hook.send(req.query.msg, {
        username: req.query.name,
        avatarURL: req.query.avatarURL
    }).then(() => {
        return res.sendStatus(200).end();
    }).catch((err) => {
        return res.sendStatus(500).end();
    })
});

app.get("/getmsgs", (req, res) => {
    if (messages.length == 0) {
        return res.sendStatus(200).end();
    }
    res.send(messages.shift());
})

app.get("/join", (req, res) => {
    if (!req.query.sid) {
        return res.sendStatus(400).end();
    }
    sapi.getPlayerSummaries({
        steamids: [req.query.sid],
        callback: (err, data) => {
            if (err) {
                res.sendStatus(500).end();
                res.end();
            }
            hook.send({
                disableMentions: "all",
                "username": "Server",
                "content": null,
                "embeds": [{
                    "description": "Joined the server!",
                    "color": 65280,
                    "author": {
                        "url": `http://steamcommunity.com/profiles/${req.query.sid}`,
                        "name": data.response.players[0].personaname,
                        "icon_url": data.response.players[0].avatarfull
                    },
                    "footer": {
                        "text": `steam64: ${req.query.sid}`
                    }
                }]
            }).then(() => {
                return res.sendStatus(200).end();
            }).catch((err) => {
                return res.sendStatus(500).end();
            })
        }
    })
})

app.get("/leave", (req, res) => {
    if (!req.query.sid) {
        return res.sendStatus(400).end();
    }
    sapi.getPlayerSummaries({
        steamids: [req.query.sid],
        callback: (err, data) => {
            if (err) {
                res.sendStatus(500).end();
                res.end();
            }
            hook.send({
                disableMentions: "all",
                "username": "Server",
                "content": null,
                "embeds": [{
                    "description": "Left the server!",
                    "color": 16711680,
                    "author": {
                        "url": `http://steamcommunity.com/profiles/${req.query.sid}`,
                        "name": data.response.players[0].personaname,
                        "icon_url": data.response.players[0].avatarfull
                    },
                    "footer": {
                        "text": `steam64: ${req.query.sid}`
                    }
                }]
            }).then(() => {
                return res.sendStatus(200).end();
            }).catch((err) => {
                return res.sendStatus(500).end();
            })
        }
    })
})

var playercount = -1;
app.get("/setplayers", (req, res) => {
    if (!req.query.p) {
        return res.sendStatus(400).end();
    }
    if(playercount !== req.query.p) {
        playercount = req.query.p;
        bot.user.setPresence({activity: {type: "PLAYING", name: `with ${req.query.p} players`}}).catch(err => {
            return res.sendStatus(500).end();
        }).then(() => {
            return res.sendStatus(200).end();
        })
    } else {
        return res.sendStatus(418)
    }
})

bot.on('message', async (msg) => {
    if (msg.channel.id !== webhook_channelID) return;
    if (msg.author.bot) return;
    if (msg.content === "") return;
    cleanmsg = msg.content.replaceAll(/([^\x00-\x7F]|;|<|>|{|})/g, "");
    cleanmsg = cleanmsg.replaceAll(/\x0A/g, " ");
    if (cleanmsg === "") return;
    cleantag = msg.author.tag.replace(/([^\x00-\x7F]|;|<|>|{|}|\n)/g, "");
    endmsg = cleantag + "\r" + cleanmsg
    messages.push(endmsg);
});

app.listen(config.stormworks.listen_port, "127.0.0.1", () => {
    console.log('server started');
    if (config.discord.token_optional) {
        bot.login(config.discord.token_optional);
    }
});