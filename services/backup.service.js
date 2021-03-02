"use strict";

const fs = require("fs");
const dateformat = require("dateformat");
const tar = require("tar");

module.exports = {
    name: "backup",

    actions: {
        async setupPath(ctx) {
            let fileExtension = "tar.gz";
            let timeFormat = dateformat(new Date, "yyyymmdd-HHMMss");

            let dir = /*ctx.params.backup_folder*/ '/tmp' + `/${ctx.params.app.name}`;
            let path = `${dir}/${ctx.params.app.name}_${timeFormat}_${ctx.params.type}.${fileExtension}`;

            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
            }

            this.logger.info(`Path generated: "${path}"`);
            return path;
        },

        async directory(ctx) {
            this.logger.info("Backuping directories");
            let path = await ctx.call("backup.setupPath", {
                app: ctx.params.app,
                type: "directories"
            });

            await tar.create({
                gzip: true,
                file: path
            }, ctx.params.app.directories).then( tar => {
                this.logger.info("Directories backup completed.");
            });

            return path;
        },

        async database(ctx) {
            this.logger.info("Backuping databases");
            // TODO
        },

        async process(ctx) {
            let directoryBackupPath = await ctx.call("backup.directory", {
                app: ctx.params.app
            });

            /*let databaseBackupPath = await ctx.call("backup.database", {
                app: ctx.params.app
            });*/

            this.logger.info("Merging backups...");
            let path = await ctx.call("backup.setupPath", {
                app: ctx.params.app,
                type: "all"
            });

            await tar.create({
                gzip: true,
                file: path
            }, [ directoryBackupPath /*, databaseBackupPath*/ ]).then( async tar => {
                fs.unlinkSync(directoryBackupPath);
                //fs.unlinkSync(databaseBackupPath);
                this.logger.info(`Merge completed. Full backup available at: ${path}`);
            });
        }
    },

    events: {
        "init.backup": {
            async handler(ctx) {
                this.logger.info("Backup proccess started");
                let config = JSON.parse(fs.readFileSync('./backup-config.json'));
                this.logger.info("Config loaded...");

                config.apps.forEach(async app => {
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
