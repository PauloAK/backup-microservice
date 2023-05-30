[![Moleculer](https://badgen.net/badge/Powered%20by/Moleculer/0e83cd)](https://moleculer.services)

# backup-microservice
This is a [Moleculer](https://moleculer.services/)-based microservices project.
Created to do simple backups of folders and postgres databases.

## Usage

Clone the repository<br>
`git clone`<br>
<br>
`cd backup-microservice`<br>
<br>
Install dependencies<br>
`npm install`<br>
<br>
Copy the example config file<br>
`cp backup-config-example.json backup-config.json`<br>
<br>
Edit `backup-config.json` and define your apps directories and databases to backup.<br>
<br>
Currently, the service does the backup every day at 2:00 AM<br>
<br>
Run the service<br>
`npm run dev`<br><br>
In production, you can use `pm2` with the command<br>
`pm2 start npm --name "backup" -- run "start"`<br>
(`pm2 list` to see the running services and `pm2 logs` to see applications logs)
