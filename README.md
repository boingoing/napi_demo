# N-API demo
This project is a simple npm module http server which uses the N-API port of leveldown in order to test Node.js with N-API. 

**Setup**<br/>
Before building, you will need to clone a repo containing Node.js with N-API. This is needed in order to get the headers required to build N-API-enabled modules. A sample command to clone the release for Node V8 8.x + N-API 0.1.0 (https://github.com/nodejs/abi-stable-node/releases/tag/8.x_napi_0.1.0):

```
git clone git://github.com/nodejs/abi-stable-node.git --branch 8.x_napi_0.1.0
```

To execute the N-API-enabled module code, you will also need to run the demo app with a version of Node.js which supports N-API. The simplest way to get this running is via NVS (https://github.com/jasongin/nvs). Sample commands to switch to a version of Node.js supporting N-API:

```
nvs remote napi-node8-v8 https://github.com/nodejs/abi-stable-node/releases/#node-v8.*-v8
nvs add napi-node8-v8
nvs use napi-node8-v8
```

There are additional remotes for other versions of Node.js in the abi-stable-node repo:

```
nvs remote napi-node6-v8 https://github.com/nodejs/abi-stable-node/releases/#node-v6.*-v8
nvs remote napi-node8-v8 https://github.com/nodejs/abi-stable-node/releases/#node-v8.*-v8
nvs remote napi-node8-chakracore https://github.com/nodejs/abi-stable-node/releases/#node-v8.*-chakracore
```

**Building**<br/>
```
npm install --nodedir=[path-to-abi-stable-node]
```

**Running**<br/>
```
node app.js
```

**Using**<br/>
This module starts an http server on the localhost by default listening on port 1338. 
