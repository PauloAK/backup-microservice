"use strict";

const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const mime = require('mime');
const config = JSON.parse(fs.readFileSync('./backup-config.json'));
const CREDENTIALS = JSON.parse(fs.readFileSync(config.drive.credentials));
const TOKEN_PATH = config.drive.token;
const path = require('path');

module.exports = {
    name: "upload",

    actions: {
        async uploadFileToDrive(ctx) {
            this.setup(uploadFile);
        
            async function uploadFile(auth) {
                const drive = google.drive({ version: 'v3', auth });
                let folders = fs.readdirSync(config.backup_folder);

                folders = folders.filter(function (folder) {
                    return fs.statSync(config.backup_folder + path.sep + folder).isDirectory();
                });

                console.log(`${folders.length} folder(s) found...`);
                folders.forEach( async folder => {
                    console.log(`Folder: ${folder}`);
                    let files = fs.readdirSync(config.backup_folder + path.sep + folder).filter(function (file) {
                        return fs.statSync(config.backup_folder + path.sep + folder + path.sep + file).isFile();
                    });                    
                    console.log(`${files.length} file(s) found in "${folder}" folder`);
                    let current = 0;
                    files.forEach( async file => {
                        getFolderID(folder, (folderID) => {
                            current++;
                            console.log(`File ${current} of ${files.length}`);
                            let filePath = config.backup_folder + path.sep + folder + path.sep + file;
                            let fileMetadata = {
                                name: file,
                                parents: [folderID]
                            };
                            let media = {
                                mimeType: mime.getType(filePath),
                                body: fs.createReadStream(filePath)
                            };

                            drive.files.create({
                                resource: fileMetadata,
                                media: media,
                                fields: 'id'
                            }, function (err, file) {
                                if (err) {
                                    console.log('Error uploading file.')
                                } else {
                                    fs.unlinkSync(filePath);
                                    console.log("Upload Completed");
                                }
                            }); 
                        });
                    });
                })

                console.log("Process completed");

                function createFolder(name, callback) {
                    var fileMetadata = {
                        'name': name,
                        'mimeType': 'application/vnd.google-apps.folder',
                        parents: [config.drive.folder_id]
                    };
                    return drive.files.create({
                        resource: fileMetadata,
                        fields: 'id'
                    }, function (err, folder) {
                        if (err) {
                            console.error("Error creating folder");
                        } else {
                            console.log(`Folder "${name}" created, ID: ${folder.data.id}`, folder.data.id);
                            callback(folder.data.id);
                        }
                    });
                }

                function getFolderID(name, callback) {
                    return drive.files.list({
                        q: `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${config.drive.folder_id}' in parents and trashed = false`,
                        fields: 'files(id,parents,name,mimeType)',
                        spaces: 'drive'
                    }, function (err, res) {
                        if (!err) {
                            if (!res.data.files.length) {
                                createFolder(name, callback);
                            } else {
                                callback(res.data.files[0].id);
                            }
                        } else {
                            console.log("Error getting folders from drive");
                        }
                    });
                }
            }
        }
    },

    methods: {
        // Send an email to recipients
        setup(callback) {
            if (!config.drive.enabled)
                return;

            const SCOPES = ['https://www.googleapis.com/auth/drive'];

            authorize(CREDENTIALS, callback);

            /**
             * Create an OAuth2 client with the given credentials, and then execute the
             * given callback function.
             * @param {Object} credentials The authorization client credentials.
             * @param {function} callback The callback to call with the authorized client.
             */
            function authorize(credentials, callback) {
                const {client_secret, client_id, redirect_uris} = credentials.installed;
                const oAuth2Client = new google.auth.OAuth2(
                    client_id, client_secret, redirect_uris[0]);

                // Check if we have previously stored a token.
                fs.readFile(TOKEN_PATH, (err, token) => {
                    if (err) return getAccessToken(oAuth2Client, callback);
                    oAuth2Client.setCredentials(JSON.parse(token));
                    callback(oAuth2Client);
                });
            }

            /**
             * Get and store new token after prompting for user authorization, and then
             * execute the given callback with the authorized OAuth2 client.
             * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
             * @param {getEventsCallback} callback The callback for the authorized client.
             */
            function getAccessToken(oAuth2Client, callback) {
                const authUrl = oAuth2Client.generateAuthUrl({
                    access_type: 'offline',
                    scope: SCOPES,
                });
                console.log('Authorize this app by visiting this url:', authUrl);
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                rl.question('Enter the code from that page here: ', (code) => {
                    rl.close();
                    oAuth2Client.getToken(code, (err, token) => {
                        if (err) return console.error('Error retrieving access token', err);
                        oAuth2Client.setCredentials(token);
                        // Store the token to disk for later program executions
                        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                            if (err) return console.error(err);
                            console.log('Token stored to', TOKEN_PATH);
                        });
                        callback(oAuth2Client);
                    });
                });
            }
        }
    },

    started() {
        console.log("Upload service started");
        this.setup( () => {
            console.log("Google drive ready!");
        });
    },

    events: {
        "init.upload": {
            async handler(ctx) {
                if (!config.drive.enabled){
                    console.log("Google Drive disabled");
                    return;
                }
                this.logger.info("Upload proccess started");
                ctx.call("upload.uploadFileToDrive");
            }
        }
    }
}