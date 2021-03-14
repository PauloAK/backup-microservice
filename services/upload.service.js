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
        uploadFileToDrive(ctx) {
            const SCOPES = ['https://www.googleapis.com/auth/drive'];

            authorize(CREDENTIALS, uploadFile);

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
        
            function uploadFile(auth) {
                const drive = google.drive({ version: 'v3', auth });
                let files = fs.readdirSync(config.backup_folder);

                console.log(`${files.length} file(s) found...`);
                let current = 1;
                files.forEach( file => {
                    console.log(`File ${current} of ${files.length}`);
                    let filePath = config.backup_folder + path.sep + file;
                    let fileMetadata = {
                        name: file,
                        parents: [config.drive.folder_id]
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
                            console.error(err);
                            console.log('Make sure you shared your drive folder with service email/user.')
                        } else {
                            console.log("Upload Completed");
                        }
                    });
                });
            }
        }
    },

    events: {
        "init.upload": {
            async handler(ctx) {
                this.logger.info("Upload proccess started");
                ctx.call("upload.uploadFileToDrive");
            }
        }
    }
}