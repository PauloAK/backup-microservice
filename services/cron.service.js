"use strict";

const Cron = require("moleculer-cron");

module.exports = {
    name: "cron",
    mixins: [Cron],
    crons: [
        {
            name: "BackupJob",
            cronTime: '0 2 * * *', // Every day at 2:00 AM
            onTick: function(ctx) {
                this.getLocalService("cron").actions.initBackup()
            },
            timeZone: 'America/Sao_Paulo'
        }
    ],

    actions: {

        initBackup: {
            handler(ctx) {
                return ctx.emit("init.backup");
            }
        }

    }
}
