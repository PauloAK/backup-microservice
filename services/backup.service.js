"use strict";

const fs = require("fs");
const tar = require("tar");
const nodePath = require('path');
const dateformat = require("dateformat");
const {execute} = require('@getvim/execute');

module.exports = {
    name: "backup",

    actions: {
        async setupPath(ctx) {
            let fileExtension = ctx.params.extension ? ctx.params.extension : "tar.gz";
            let timeFormat = dateformat(new Date, "yyyymmdd-HHMMss");

            let dir = ctx.params.config.backup_folder + `/${ctx.params.app.name}`;
            let path = `${dir}/${ctx.params.app.name}_${timeFormat}_${ctx.params.name}.${fileExtension}`;

            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }

            this.logger.info(`Path generated: "${path}"`);
            return path;
        },

        async directory(ctx) {
            this.logger.info("Backuping directories");
            let path = await ctx.call("backup.setupPath", {
                app: ctx.params.app,
                name: "directories",
                config: ctx.params.config
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
            let path = null;
            let databaseBackups = new Array;

            const promises = ctx.params.app.databases.map(async (database) => {
                this.logger.info(`[${database.driver} - ${database.database}]  Started`);
                path = await ctx.call("backup.setupPath", {
                    app: ctx.params.app,
                    name: `db_${database.driver}_${database.database}`,
                    extension: 'sql',
                    config: ctx.params.config
                });
                await execute(`PGPASSWORD="${database.password}" pg_dump -U ${database.username} -h ${database.host} -p ${database.port} -d ${database.database} > ${path}`,).then(async () => {
                    this.logger.info(`[${database.driver} - ${database.database}] Dump finished, compressing...`);
                    let tarPath = await ctx.call("backup.setupPath", {
                        app: ctx.params.app,
                        name: `db_${database.driver}_${database.database}`,
                        config: ctx.params.config
                    });

                    await tar.create({
                        gzip: true,
                        file: tarPath,
                        cwd: nodePath.dirname(path)
                    }, [nodePath.basename(path)]).then( tar => {
                        fs.unlinkSync(path);
                        databaseBackups.push(tarPath);
                        this.logger.info(`[${database.driver} - ${database.database}] Completed`);
                    });
                });
            });

            await Promise.all(promises);

            return databaseBackups;
        },

        async process(ctx) {
            let backupFiles = new Array;
            let directoryBackupPath = await ctx.call("backup.directory", {
                app: ctx.params.app,
                config: ctx.params.config
            });
            backupFiles.push(directoryBackupPath);

            let databaseBackupPath = await ctx.call("backup.database", {
                app: ctx.params.app,
                config: ctx.params.config
            });
            backupFiles.push(...databaseBackupPath);

            this.logger.info("Merging backups...");
            let path = await ctx.call("backup.setupPath", {
                app: ctx.params.app,
                name: "all",
                config: ctx.params.config
            });

            await tar.create({
                gzip: true,
                file: path,
                cwd: nodePath.dirname(backupFiles[0])
            }, backupFiles.map( backup => { return nodePath.basename(backup); })).then( async tar => {
                backupFiles.forEach( backup => {
                    fs.unlinkSync(backup);
                })
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
                        app: app,
                        config: config
                    });
                    this.logger.info(`[${app.name}] Completed`);
                });
            }
        }
    }
}
