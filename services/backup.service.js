"use strict";

const fs = require("fs");
const dateformat = require("dateformat");

module.exports = {
    name: "backup",

    actions: {
        directory(ctx) {

        },

        database(ctx) {

        },

        process(ctx) {
            let timeFormat = dateformat(new Date, "yyyymmdd-HHMMss");
            let baseFilename = `${app.name}_${timeFormat}_`;
        }
    },

    events: {
        "init.backup": {
            handler(ctx) {
                this.logger.info("Backup proccess started");
                let config = JSON.parse(fs.readFileSync('./backup-config.json'));
                this.logger.info("Config loaded...");

                config.apps.forEach(function(app){
                    this.logger.info(`[${app.name}] Starting`);
                    ctx.call("backup.process", app);
                });
            }
        }
    }
}