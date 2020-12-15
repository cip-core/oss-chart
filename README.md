# What is it about ?

This project is a website that lets users better comprehend and visualize the contributions of numerous tech companies in different open source technologies.

Data is pulled from [DevStats](https://devstats.cncf.io/) and is rendered into graphs.

# Getting Started

## Prerequisites

- NodeJS v10+
- (Optional) PostgreSQL 10+

## Installation

1. Clone the repo
   ```sh
   git clone https://github.com/cengizmurat/grafana-chart.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. If you have a PostgreSQL database running, provide these information in environment variables :

   | Name | Description |
   |------|-------------|
   |`POSTGRESQL_HOST`|PostgreSQL host name|
   |`POSTGRESQL_PORT`|PostgreSQL port|
   |`POSTGRESQL_DATABASE`|PostgreSQL database name|
   |`POSTGRESQL_USER`|PostgreSQL user|
   |`POSTGRESQL_PASSWORD`|PostgreSQL password|

   Or you can provide these information in a `config.json` file at the root of the project :
   
   ```JSON
   {
     "POSTGRESQL_HOST": "127.0.0.1",
     "POSTGRESQL_PORT": 5432,
     "POSTGRESQL_DATABASE": "mydatabase",
     "POSTGRESQL_USER": "user",
     "POSTGRESQL_PASSWORD": "password"
   }
   ```
   
## Usage

### From Local machine

```sh
npm run start
```

The server will be launched and will listen at port 3000 (see http://localhost:3000)

### From CodeReady Workspaces

Create your ready-to-dev environment by clicking [here](https://codeready-cip-crw-common.apps.c1.ocp.dev.sgcip.com/factory?url=https://raw.githubusercontent.com/cengizmurat/grafana-chart/master/devfile.yaml)
