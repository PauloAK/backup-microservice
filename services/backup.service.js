"use strict";

const fs = require("fs");
const dateformat = require("dateformat");
const tar = require("tar");

module.exports = {
    name: "backup",

    actions: {
        setupPath(ctx) {
            let fileExtension = "tar.gz";
            let timeFormat = dateformat(new Date, "yyyymmdd-HHMMss");

            let dir = ctx.backup_folder + `/${ctx.app.name}`;
            let path = `${dir}/${ctx.app.name}_${timeFormat}_${ctx.type}.${fileExtension}`;

            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
            }

            this.logger.info(`Path generated: "${path}"`);
            return path;
        },

        directory(ctx) {
            this.logger.info("Backuping directories");
            let path = await ctx.call("backup.setupPath", {
                app: ctx.app,
                type: "directories"
            });

            await tar.create({
                gzip: true,
                file: path
            }, ctx.directories).then( tar => {
                this.logger.info("Directories backup completed.");
            });

            return path;
        },

        database(ctx) {
            this.logger.info("Backuping databases");
            // TODO
        },

        process(ctx) {
            let directoryBackupPath = await ctx.call("backup.directory", {
                app: ctx.app
            });

            let databaseBackupPath = await ctx.call("backup.database", {
                app: ctx.app
            });

            this.logger.info("Merging backups...");
            let path = await ctx.call("backup.setupPath", {
                app: ctx.app,
                type: "all"
            });

            await tar.create({
                gzip: true,
                file: path
            }, ctx.directories).then( tar => {
                fs.unlinkSync(directoryBackupPath);
                fs.unlinkSync(databaseBackupPath);
                this.logger.info(`Merge completed. Full backup available at: ${path}`);
            });
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
                    await ctx.call("backup.process", {
                        app: app
                    });
                    this.logger.info(`[${app.name}] Completed`);
                });
            }
        }
    }
}