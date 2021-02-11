# What is it about ?

This project is a backend server that renders scripts. These scripts will then have to be integrated in websites that lets users better comprehend and visualize the contributions of numerous tech companies in different open source technologies.

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
3. Provide these information in environment variables :

   _(variables starting with `POSTGRESQL_` are needed only if you have a PostgreSQL database running)_

   | Name | Description | Required | Default value |
   |---|---|:-:|:-:|
   |`STACK_PAGE_URL`|URL to redirect after creating a new stack|x||
   |`RESET_DATABASE`|After connecting to database, reset all tables (boolean)||false|
   |`LOG_QUERIES`|Log all queries performed into database (boolean)||false|
   |`CACHE_TIME`|Cache time (in minutes) before it is considered as expired||30|
   |`POSTGRESQL_HOST`|PostgreSQL host name||127.0.0.1|
   |`POSTGRESQL_PORT`|PostgreSQL port||5432|
   |`POSTGRESQL_DATABASE`|PostgreSQL database name|||
   |`POSTGRESQL_USER`|PostgreSQL user|||
   |`POSTGRESQL_PASSWORD`|PostgreSQL password|||

   Or you can provide these information in a `config.json` file at the root of the project :
   
   ```JSON
   {
     "STACK_PAGE_URL": "https://cengizmurat.github.io/grafana-chart-ui/src/stacks",
     "RESET_DATABASE": "false",
     "LOG_QUERIES": "false",
     "CACHE_TIME": "30",
     "POSTGRESQL_HOST": "127.0.0.1",
     "POSTGRESQL_PORT": 5432,
     "POSTGRESQL_DATABASE": "mydatabase",
     "POSTGRESQL_USER": "user",
     "POSTGRESQL_PASSWORD": "password"
   }
   ```
   
## Start server

### From Local machine

```sh
npm run start
```

The server will be launched and will listen at port 3000 (see http://localhost:3000)

### From CodeReady Workspaces

Create your ready-to-dev environment by clicking [here](https://codeready-cip-crw-common.apps.c1.ocp.dev.sgcip.com/factory?url=https://raw.githubusercontent.com/cengizmurat/grafana-chart/master/devfile.yaml)

## Usage

Include these tags in your website's `<head>` tag (replace `http://localhost:3000` with your server URL if it is exposed) :
```HTML
<!-- Style sheet for graphs -->
<link rel="stylesheet" href="http://localhost:3000/graph/styles.css">

<!-- d3js libraries needed for our library -->
<script src="https://d3js.org/d3.v4.js"></script>
<script src="https://d3js.org/d3-scale-chromatic.v1.min.js"></script>

<!-- Graph rendering main module -->
<script src="http://localhost:3000/graph/script.js"></script>
```

Then call the `updateGraphs()` Javascript function wherever in the `body` of your webpage.

The script will look for tags with class `graph` and insert SVG elements into it. These tags can have following custom attributes in order to configure which data should be retrieved :
   
| Attribute | Description | Required |
|---|---|:-:|
|`data-kind`|Kind of data to display. Should be either `companies`, `components` or `stack`|x|
|`data-name`|Name of the data to retrieve (example: `k8s` for Kubernetes component, or `IBM` for IBM company)|x|
|`data-metric`|Metric to retrieve (1)|x|
|`data-periods`|List of periods to retrieve (1), separated by comma (example: `w` for week, `m` for month, `q` for quarter, `y` for year, `y10` for decade)|x|
|`data-components`|If `data-kind` set to `companies`, list of components to retrieve information for the given company in `data-name` (comma-separated values). Can be `all` for all components||
|`data-companies`|If `data-kind` set to `components` or `stack`, list of components to retrieve information for the given company in `data-name` (comma-separated values). Can be `all` for all companies||
|`data-stack`|If `data-kind` set to `companies`, stack to retrieve information for the given company in `data-name` (single stack name)||
|`data-clickable`|Set this attribute if graph should be clickable, then redirect to a detailed view of this element||

(1) : See details at [Devstats website](https://devstats.cncf.io)

Here are some configuration exemples :
- [Stats of a component for 3 companies](https://cengizmurat.github.io/grafana-chart-ui/src/components?dataName=k8s&companies=Amazon%2CIBM%2CMicrosoft+Corporation)
```HTML
<div
     class="graph"
     data-kind="components"
     data-metric="hcomcontributions"
     data-name="k8s"
     data-periods="w,m,q,y,y10"
     data-companies="Amazon,IBM,Microsoft Corporation"
     data-clickable
></div>
```
- [Stats of a component for all companies](https://cengizmurat.github.io/grafana-chart-ui/src/components?dataName=k8s&companies=all)
```HTML
<div
     class="graph"
     data-kind="components"
     data-metric="hcomcontributions"
     data-name="k8s"
     data-periods="w,m,q,y,y10"
     data-companies="all"
     data-clickable
></div>
```
- [Stats of a company for 4 components](https://cengizmurat.github.io/grafana-chart-ui/src/companies?dataName=IBM&components=containerd%2Cfluentd%2Chelm%2Ck8s)
```HTML
<div
     class="graph"
     data-kind="companies"
     data-metric="hcomcontributions"
     data-name="IBM"
     data-periods="w,m,q,y,y10"
     data-components="containerd,fluentd,helm,k8s"
     data-clickable
></div>
```
- [Stats of a company for all components](https://cengizmurat.github.io/grafana-chart-ui/src/companies?dataName=IBM&components=all)
```HTML
<div
     class="graph"
     data-kind="companies"
     data-metric="hcomcontributions"
     data-name="IBM"
     data-periods="w,m,q,y,y10"
     data-components="all"
     data-clickable
></div>
```
- [Stats of a company for a stack](https://cengizmurat.github.io/grafana-chart-ui/src/companies?dataName=IBM&stack=cip)
```HTML
<div
     class="graph"
     data-kind="companies"
     data-metric="hcomcontributions"
     data-name="IBM"
     data-periods="w,m,q,y,y10"
     data-stack="cip"
     data-clickable
></div>
```
- [Stats of a stack for 3 companies](https://cengizmurat.github.io/grafana-chart-ui/src/stacks?dataName=cip&companies=Amazon%2CIBM%2CMicrosoft+Corporation)
```HTML
<div
     class="graph"
     data-kind="stack"
     data-metric="hcomcontributions"
     data-name="cip"
     data-periods="w,m,q,y,y10"
     data-companies="Amazon,IBM,Microsoft Corporation"
     data-clickable
></div>
```
- [Stats of a stack for all companies](https://cengizmurat.github.io/grafana-chart-ui/src/stacks?dataName=cip&companies=all)
```HTML
<div
     class="graph"
     data-kind="stack"
     data-metric="hcomcontributions"
     data-name="cip"
     data-periods="w,m,q,y,y10"
     data-companies="all"
     data-clickable
></div>
```